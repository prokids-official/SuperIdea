import { isSupabaseConfigured, supabase } from './supabase'
import type { Idea, IdeaDraft, IdeaStatus, User } from './types'

const scraperUrl = import.meta.env.VITE_LOCAL_SCRAPER_URL ?? 'http://127.0.0.1:8787'

type LocalIdea = Idea & {
  desc: string
}

type SupabaseIdeaRow = {
  id: string
  title: string
  description: string
  status: IdeaStatus
  tags: string[]
  author_id?: string
  author_name: string
  author_avatar: string
  hot: boolean
  market?: Idea['market'] | null
  likes?: number
  saves?: number
  comments?: number
}

type ProfileRow = {
  id: string
  email: string
  name: string
  avatar: string
  role?: 'admin' | 'member'
}

export type IdeaReactionKind = 'like' | 'save'

export type IdeaComment = {
  id: string
  ideaId: string
  authorName: string
  body: string
  createdAt: string
}

export type SignupAllowlistEntry = {
  email: string
  note: string
  createdAt: string
}

export async function login(email: string, password: string): Promise<User> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) throw new Error(error?.message || '登录失败')

    return ensureProfile(data.user.id, data.user.email || email)
  }

  const response = await fetch(`${scraperUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) throw new Error('账号或密码不正确')
  const body = await response.json()
  return body.user
}

export async function signup(email: string, password: string): Promise<User> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('当前未连接 Supabase，暂时不能创建新账号')
  }

  const normalizedEmail = email.trim().toLowerCase()
  const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password })
  if (error || !data.user) throw new Error(error?.message || '注册失败')

  if (!data.session) {
    const signIn = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
    if (signIn.data.user) {
      return ensureProfile(signIn.data.user.id, signIn.data.user.email || normalizedEmail)
    }
    throw new Error('账号已创建，但 Supabase 仍开启邮箱确认。请先在 Supabase Auth 里关闭 Confirm email，再重新注册或登录。')
  }

  return ensureProfile(data.user.id, data.user.email || normalizedEmail)
}

export function isSelfServiceSignupEmail(email: string): boolean {
  return Boolean(email.trim())
}

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured || !supabase) return null

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null

  return ensureProfile(data.user.id, data.user.email || '')
}

export async function logout(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut()
  }
}

export async function listIdeas(): Promise<Idea[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from('ideas_with_counts').select('*').order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map(fromSupabaseIdea)
  }

  const response = await fetch(`${scraperUrl}/api/ideas`)
  if (!response.ok) throw new Error(`点子读取失败：${response.status}`)
  const body = await response.json()
  return body.items ?? []
}

export async function createIdea(draft: IdeaDraft, user: User): Promise<Idea> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('ideas')
      .insert({
        title: draft.title,
        description: draft.desc || '这个点子还没有详细说明，可以在评论区继续补充。',
        author_id: user.id,
        author_name: user.name,
        author_avatar: user.avatar,
      })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return fromSupabaseIdea(data as SupabaseIdeaRow)
  }

  const response = await fetch(`${scraperUrl}/api/ideas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: draft.title,
      desc: draft.desc,
      author: user.name,
      avatar: user.avatar,
    }),
  })
  if (!response.ok) throw new Error(`点子发布失败：${response.status}`)
  const body = await response.json()
  return body.item as LocalIdea
}

export async function toggleIdeaReaction(ideaId: string, kind: IdeaReactionKind, active: boolean): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('当前未连接 Supabase，暂时不能同步互动')
  }

  const user = await requireSupabaseUser()
  if (active) {
    const { error } = await supabase.from('idea_reactions').upsert(
      {
        idea_id: ideaId,
        user_id: user.id,
        kind,
      },
      { onConflict: 'idea_id,user_id,kind' },
    )
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await supabase.from('idea_reactions').delete().eq('idea_id', ideaId).eq('user_id', user.id).eq('kind', kind)
  if (error) throw new Error(error.message)
}

export async function listIdeaComments(ideaId: string): Promise<IdeaComment[]> {
  if (!isSupabaseConfigured || !supabase) return []

  const { data, error } = await supabase
    .from('idea_comments')
    .select('id,idea_id,author_name,body,created_at')
    .eq('idea_id', ideaId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id,
    ideaId: row.idea_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  }))
}

export async function addIdeaComment(ideaId: string, body: string, user: User): Promise<IdeaComment> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('当前未连接 Supabase，暂时不能发表评论')
  }

  const authUser = await requireSupabaseUser()
  const { data, error } = await supabase
    .from('idea_comments')
    .insert({
      idea_id: ideaId,
      user_id: authUser.id,
      author_name: user.name,
      body,
    })
    .select('id,idea_id,author_name,body,created_at')
    .single()

  if (error || !data) throw new Error(error?.message || '评论发布失败')
  return {
    id: data.id,
    ideaId: data.idea_id,
    authorName: data.author_name,
    body: data.body,
    createdAt: data.created_at,
  }
}

export async function updateIdeaStatus(ideaId: string, status: IdeaStatus): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('当前未连接 Supabase，暂时不能更新状态')
  }

  const { error } = await supabase.from('ideas').update({ status }).eq('id', ideaId)
  if (error) throw new Error(error.message)
}

export async function listSignupAllowlist(): Promise<SignupAllowlistEntry[]> {
  if (!isSupabaseConfigured || !supabase) return []

  const { data, error } = await supabase.from('signup_allowlist').select('email,note,created_at').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    email: row.email,
    note: row.note,
    createdAt: row.created_at,
  }))
}

export async function addSignupAllowlistEmail(email: string, note = ''): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('当前未连接 Supabase')
  }

  const user = await requireSupabaseUser()
  const { error } = await supabase.from('signup_allowlist').upsert(
    {
      email: email.trim().toLowerCase(),
      note,
      created_by: user.id,
    },
    { onConflict: 'email' },
  )
  if (error) throw new Error(error.message)
}

export async function removeSignupAllowlistEmail(email: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('当前未连接 Supabase')
  }

  const { error } = await supabase.from('signup_allowlist').delete().eq('email', email.trim().toLowerCase())
  if (error) throw new Error(error.message)
}

async function requireSupabaseUser() {
  if (!supabase) throw new Error('Supabase 未配置')

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('请先登录')
  return data.user
}

async function ensureProfile(id: string, email: string): Promise<User> {
  if (!supabase) throw new Error('Supabase 未配置')

  const existing = await supabase.from('profiles').select('id,email,name,avatar').eq('id', id).maybeSingle<ProfileRow>()
  if (existing.data) {
    return {
      id: existing.data.id,
      email: existing.data.email,
      name: existing.data.name,
      avatar: existing.data.avatar,
      role: existing.data.role ?? 'member',
    }
  }

  const name = email.split('@')[0] || '内部账号'
  const profile = {
    id,
    email,
    name,
    avatar: name.slice(0, 1).toUpperCase() || '内',
    role: (email.toLowerCase() === 'loy27felix@gmail.com' ? 'admin' : 'member') as 'admin' | 'member',
  }
  const { error } = await supabase.from('profiles').insert(profile)
  if (error) throw new Error(error.message)
  return profile
}

function fromSupabaseIdea(row: SupabaseIdeaRow): Idea {
  return {
    id: row.id,
    title: row.title,
    author: row.author_name,
    avatar: row.author_avatar,
    desc: row.description,
    status: row.status,
    statusLabel: statusLabel(row.status),
    likes: row.likes ?? 0,
    comments: row.comments ?? 0,
    saves: row.saves ?? 0,
    tags: row.tags ?? ['新点子'],
    hot: row.hot,
    market: row.market ?? undefined,
  }
}

function statusLabel(status: IdeaStatus): string {
  return {
    open: '开放中',
    claimed: '已认领',
    producing: '制作中',
    published: '已发布',
  }[status]
}
