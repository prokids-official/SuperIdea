import { isSupabaseConfigured, supabase } from './supabase'

export type TrackedAccount = {
  id: string
  platform: 'youtube' | 'tiktok' | 'douyin' | 'bilibili' | 'xiaohongshu'
  displayName: string
  handle?: string
  homepageUrl?: string
  category: string
  enabled: boolean
  scrapeIntervalDays: number
  lastCheckedAt?: string
  nextCheckAt?: string
}

export type TrackedVideo = {
  id: string
  accountId?: string
  accountName: string
  platform: string
  title: string
  url: string
  thumbnailUrl?: string
  description?: string
  creatorName?: string
  publishedAt?: string
  viewCount?: number
  likeCount?: number
  commentCount?: number
  dataSource?: string
  firstSeenAt?: string
  lastSeenAt?: string
  hotScore: number
}

type AccountRow = {
  id: string
  platform: TrackedAccount['platform']
  display_name: string
  handle?: string | null
  homepage_url?: string | null
  category?: string | null
  enabled: boolean
  scrape_interval_days?: number | null
  last_checked_at?: string | null
  next_check_at?: string | null
}

type VideoRow = {
  id: string
  account_id?: string | null
  platform: string
  title: string
  url: string
  thumbnail_url?: string | null
  description?: string | null
  creator_name?: string | null
  published_at?: string | null
  view_count?: number | null
  like_count?: number | null
  comment_count?: number | null
  data_source?: string | null
  first_seen_at?: string | null
  last_seen_at?: string | null
  tracked_accounts?: { display_name?: string | null } | null
}

export async function listTrackedAccounts(): Promise<TrackedAccount[]> {
  if (!isSupabaseConfigured || !supabase) return fallbackAccounts
  const { data, error } = await supabase
    .from('tracked_accounts')
    .select('*')
    .eq('enabled', true)
    .order('platform', { ascending: true })
    .order('display_name', { ascending: true })
  if (error) return fallbackAccounts
  return (data ?? []).map(fromAccountRow)
}

export async function listTrackedVideos(windowDays: 7 | 30): Promise<TrackedVideo[]> {
  if (!isSupabaseConfigured || !supabase) return fallbackVideos(windowDays)
  const since = Date.now() - windowDays * 24 * 60 * 60 * 1000
  const { data, error } = await supabase
    .from('tracked_videos')
    .select('*, tracked_accounts(display_name)')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(240)
  if (error) return fallbackVideos(windowDays)

  return (data ?? [])
    .map(fromVideoRow)
    .filter((item) => {
      const time = new Date(item.publishedAt || item.firstSeenAt || item.lastSeenAt || 0).getTime()
      return Number.isFinite(time) && time >= since
    })
    .sort((a, b) => b.hotScore - a.hotScore)
}

function fromAccountRow(row: AccountRow): TrackedAccount {
  return {
    id: row.id,
    platform: row.platform,
    displayName: row.display_name,
    handle: row.handle ?? undefined,
    homepageUrl: row.homepage_url ?? undefined,
    category: row.category ?? 'children_content',
    enabled: row.enabled,
    scrapeIntervalDays: row.scrape_interval_days ?? 3,
    lastCheckedAt: row.last_checked_at ?? undefined,
    nextCheckAt: row.next_check_at ?? undefined,
  }
}

function fromVideoRow(row: VideoRow): TrackedVideo {
  const view = row.view_count ?? 0
  const like = row.like_count ?? 0
  const comment = row.comment_count ?? 0
  return {
    id: row.id,
    accountId: row.account_id ?? undefined,
    accountName: row.tracked_accounts?.display_name || row.creator_name || '固定账号',
    platform: row.platform,
    title: row.title,
    url: row.url,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    description: row.description ?? undefined,
    creatorName: row.creator_name ?? undefined,
    publishedAt: row.published_at ?? undefined,
    viewCount: row.view_count ?? undefined,
    likeCount: row.like_count ?? undefined,
    commentCount: row.comment_count ?? undefined,
    dataSource: row.data_source ?? undefined,
    firstSeenAt: row.first_seen_at ?? undefined,
    lastSeenAt: row.last_seen_at ?? undefined,
    hotScore: Math.round(view + like * 8 + comment * 20),
  }
}

const fallbackAccounts: TrackedAccount[] = [
  ['youtube', 'BabyBus', '@BabyBus'],
  ['youtube', 'Bebefinn', '@Bebefinn'],
  ['youtube', 'Pinkfong', '@Pinkfong'],
  ['youtube', 'Babyshark', '@BabyShark'],
  ['youtube', 'Doko Demo Jamboree', '@DokoDemoJamboree'],
  ['youtube', 'Super Simple Songs', '@SuperSimpleSongs'],
  ['youtube', '贝乐虎', '@Beilehu'],
  ['youtube', 'Doggyland', '@DoggylandKidsSongs'],
  ['tiktok', 'Pinkfong', '@pinkfong_official'],
  ['tiktok', 'Babyshark', '@babyshark_brooklyn'],
  ['tiktok', 'Doko Demo Jamboree', '@dokojam'],
  ['tiktok', 'Super Simple Songs', '@supersimpleofficial'],
  ['douyin', '周鸿祎（红衣大叔）', ''],
  ['douyin', '洋过探世界', ''],
  ['douyin', '小五狼', ''],
  ['douyin', '贝乐虎儿歌', ''],
  ['douyin', '儿歌多多', ''],
].map(([platform, displayName, handle], index) => ({
  id: `seed-${index}`,
  platform: platform as TrackedAccount['platform'],
  displayName,
  handle,
  category: platform === 'douyin' ? 'content_reference' : 'children_content',
  enabled: true,
  scrapeIntervalDays: 3,
}))

function fallbackVideos(windowDays: 7 | 30): TrackedVideo[] {
  if (windowDays !== 7) return []
  return []
}
