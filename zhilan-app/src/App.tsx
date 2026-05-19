import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  ExternalLink,
  Filter,
  Flame,
  Download,
  Heart,
  Home,
  Lightbulb,
  Link,
  LockKeyhole,
  MessageCircle,
  Moon,
  Newspaper,
  Play,
  Plus,
  Radar,
  Search,
  Sparkles,
  Sun,
  TrendingUp,
} from 'lucide-react'
import './App.css'
import {
  addSignupAllowlistEmail,
  addIdeaComment,
  createIdea as createIdeaRecord,
  listIdeaComments,
  listIdeas,
  listSignupAllowlist,
  getCurrentUser,
  login as loginAccount,
  removeSignupAllowlistEmail,
  signup as signupAccount,
  toggleIdeaReaction,
  updateIdeaStatus,
  type SignupAllowlistEntry,
  type IdeaComment,
} from './lib/appApi'
import { searchContent } from './lib/contentApi'
import { listDailyIssues, type DailyIssueRecord } from './lib/dailyApi'
import {
  buildFollowBuildersDigest,
  generateFrontendSlides,
  type FollowBuildersResponse,
  type FrontendSlidesResponse,
  type SlidesStyle,
} from './lib/toolsApi'
import type { Idea, IdeaDraft, User } from './lib/types'

type View = 'home' | 'radar' | 'daily' | 'ideas' | 'tools' | 'admin'
type SortMode = 'hot' | 'views' | 'new'
type RadarProgress = {
  active: boolean
  percent: number
  label: string
  startedAt?: number
  finishedAt?: number
}

type ContentItem = {
  id: string
  platform: string
  platformName: string
  title: string
  creator: string
  views: string
  likes: string
  comments: string
  time: string
  duration: string
  trend: string
  hue: number
  url: string
  thumbnailUrl?: string
  language: 'zh' | 'en' | 'unknown'
  contentType: string
  topicTags: string[]
  aiSignals: string[]
  negativeSignals: string[]
  relevanceScore: number
  freshnessScore: number
  trendScore: number
  aiConfidence: number
  opportunityScore: number
  passesAiStoryGate: boolean
  rankReason: string
  brief: {
    summary: string
    hook: string
    learn: string
    risk: string
  }
}

type ApiContentItem = {
  id?: string
  platform: string
  title: string
  url: string
  description?: string
  creatorName?: string
  viewCount?: number
  likeCount?: number
  commentCount?: number
  publishedAt?: string
  duration?: string
  dataSource?: string
  briefModel?: string
  thumbnailUrl?: string
  language?: 'zh' | 'en' | 'unknown'
  contentType?: string
  topicTags?: string[]
  aiSignals?: string[]
  negativeSignals?: string[]
  relevanceScore?: number
  freshnessScore?: number
  trendScore?: number
  aiConfidence?: number
  opportunityScore?: number
  passesAiStoryGate?: boolean
  rankReason?: string
  aiBrief?: {
    summary: string
    hook: string
    learn?: string
    takeaway?: string
    risk: string
  }
}

type RadarState = {
  loading: boolean
  error: string
  results: ContentItem[]
  sourceStatus: Record<string, string>
  searchPlan?: {
    originalQuery?: string
    intent?: string
    mustHave?: string[]
    zhTerms?: string[]
    enTerms?: string[]
    topicProbes?: string[]
    platformQueries?: Record<string, string[]>
  }
  insight?: {
    summary?: string
    topTopics?: string[]
    platforms?: Record<string, number>
    languages?: Record<string, number>
    avgOpportunity?: number
    strictGate?: string[]
  }
  progress: RadarProgress
}

const platformDefs = [
  { id: 'youtube', name: 'YouTube', api: 'youtube', count: 142 },
  { id: 'tiktok', name: 'TikTok', api: 'tiktok', count: 98 },
  { id: 'bilibili', name: 'Bilibili', api: 'bilibili', count: 56 },
  { id: 'douyin', name: '抖音', api: 'douyin', count: 76 },
  { id: 'web', name: '网页新闻', api: 'web', count: 24 },
]

const hotSearches = ['AI 漫剧', '格林童话', '儿童睡前故事', '员工梦境短片', 'AI 反转结局']

const seedResults: ContentItem[] = [
  {
    id: 'seed-youtube',
    platform: 'youtube',
    platformName: 'YouTube',
    title: '用 AI 重拍《小红帽》，但结局完全反转',
    creator: 'Pixel Bedtime',
    views: '2,840,000',
    likes: '98K',
    comments: '4.2K',
    time: '3 天前',
    duration: '08:12',
    trend: '+218%',
    hue: 200,
    url: 'https://www.youtube.com/',
    brief: {
      summary: '这条视频用强反转结尾重新包装经典童话，前 5 秒直接抛出冲突。',
      hook: '经典 IP + 反差设定 + 高密度视觉奇观，AI 镜头切换密集。',
      learn: '可以保留儿童友好的角色关系，但把开头做得更像悬念短片。',
      risk: '部分画面偏暗，3-6 岁人群需要二次评估惊吓感。',
    },
    language: 'zh',
    contentType: 'story',
    topicTags: ['fairy tale', 'twist'],
    aiSignals: ['ai', 'ai动画'],
    negativeSignals: [],
    relevanceScore: 92,
    freshnessScore: 86,
    trendScore: 96,
    aiConfidence: 94,
    opportunityScore: 93,
    passesAiStoryGate: true,
    rankReason: 'ai + 童话; twist; trend 96, freshness 86',
  },
  {
    id: 'seed-bili',
    platform: 'bilibili',
    platformName: 'Bilibili',
    title: '3 分钟看完 AI 版格林童话宇宙',
    creator: '童话研究所',
    views: '586,400',
    likes: '32K',
    comments: '1.8K',
    time: '昨天',
    duration: '03:08',
    trend: '+62%',
    hue: 220,
    url: 'https://www.bilibili.com/',
    brief: {
      summary: '把多个童话主角拼成同一时空，用 AI 动画做集体亮相。',
      hook: '群像 + 童年共鸣，弹幕互动密度高。',
      learn: '贝瓦童话 IP 可以借这种群像结构做合集预告。',
      risk: '节奏偏快，低龄用户可能跟不上，需要慢速版本。',
    },
    language: 'zh',
    contentType: 'series',
    topicTags: ['fairy tale', 'series'],
    aiSignals: ['ai', 'ai动画'],
    negativeSignals: [],
    relevanceScore: 88,
    freshnessScore: 76,
    trendScore: 82,
    aiConfidence: 88,
    opportunityScore: 84,
    passesAiStoryGate: true,
    rankReason: 'ai + 剧集; fairy tale; trend 82, freshness 76',
  },
  {
    id: 'seed-douyin',
    platform: 'douyin',
    platformName: '抖音',
    title: '儿童睡前故事正在被 AI 动画重做',
    creator: '睡前故事工厂',
    views: '4,120,000',
    likes: '412K',
    comments: '12K',
    time: '18 小时前',
    duration: '01:24',
    trend: '+540%',
    hue: 12,
    url: 'https://www.douyin.com/',
    brief: {
      summary: '用柔和旁白和稳定镜头包装睡前故事，评论区集中讨论画风和配音。',
      hook: '家长场景明确，封面信息简单，完播友好。',
      learn: '适合拆成睡前 3 分钟系列，强化安全感和重复栏目感。',
      risk: '同质化严重，需要更强的系列识别符号。',
    },
    language: 'zh',
    contentType: 'story',
    topicTags: ['children', 'series'],
    aiSignals: ['ai', 'ai动画'],
    negativeSignals: [],
    relevanceScore: 86,
    freshnessScore: 94,
    trendScore: 98,
    aiConfidence: 86,
    opportunityScore: 91,
    passesAiStoryGate: true,
    rankReason: 'ai + 睡前故事; children; trend 98, freshness 94',
  },
]

const dailyHighlights = [
  '视频生成模型更新密集，适合关注角色一致性和镜头可控性。',
  '多模态工作流继续向低门槛发展，内容团队可沉淀内部 prompt 和模板。',
  'AI 配音和音效工具进入可用阶段，短剧后期流程有机会压缩。',
  '版权和相似风格争议增加，童话改编需要保留自有角色和审美体系。',
]

const ideas: Idea[] = [
  {
    id: 'dreams',
    title: '统计全公司所有人做过的梦，并用 AI 实现',
    author: 'Felix',
    avatar: 'F',
    desc: '全员匿名提交一段最近做过的梦，由 AI 团队批量生成画面，剪成一支 90 秒的荒诞短片。',
    status: 'open',
    statusLabel: '开放中',
    likes: 38,
    comments: 12,
    saves: 9,
    tags: ['实验视频', '团队叙事', 'AI 漫剧'],
    hot: true,
    market: { count: 6, top: '3.5M', chance: '中等' },
  },
  {
    id: 'villain',
    title: '格林童话里的反派开了一家公司',
    author: '内容策划组',
    avatar: '策',
    desc: '把经典童话反派放进现代办公室，用 AI 漫剧做轻喜剧，适合系列化。',
    status: 'claimed',
    statusLabel: '已认领 · 子萱',
    likes: 52,
    comments: 24,
    saves: 18,
    tags: ['AI 漫剧', '格林童话', '轻喜剧'],
    hot: true,
    market: { count: 18, top: '2.8M', chance: '高' },
  },
  {
    id: 'robot',
    title: '给孩子解释 AI：如果机器人也要上幼儿园',
    author: '运营同事',
    avatar: '运',
    desc: '用拟人化小机器人讲 AI 基础概念，降低技术理解门槛，也能做成知识短剧。',
    status: 'producing',
    statusLabel: '制作中',
    likes: 27,
    comments: 8,
    saves: 14,
    tags: ['儿童科普', 'AI 工具', '系列栏目'],
    market: { count: 2, top: '1.2M', chance: '高' },
  },
]

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [route, setRoute] = useState<View>('home')
  const [query, setQuery] = useState('AI 漫剧')
  const [composerOpen, setComposerOpen] = useState(false)
  const [ideaList, setIdeaList] = useState<Idea[]>(ideas)
  const [loginError, setLoginError] = useState('')
  const [radarState, setRadarState] = useState<RadarState>({
    loading: false,
    error: '',
    results: seedResults,
    sourceStatus: {},
    progress: { active: false, percent: 0, label: '等待搜索' },
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = window.localStorage.getItem('zl-theme') as 'light' | 'dark' | null
    if (stored) return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('zl-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  useEffect(() => {
    let cancelled = false
    async function restoreSession() {
      try {
        const account = await getCurrentUser()
        if (!cancelled && account) setUser(account)
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setAuthChecking(false)
      }
    }
    restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    async function loadRemoteIdeas() {
      try {
        const remoteIdeas = await listIdeas()
        if (!cancelled) setIdeaList(remoteIdeas)
      } catch {
        if (!cancelled) setIdeaList(ideas)
      }
    }
    loadRemoteIdeas()
    return () => {
      cancelled = true
    }
  }, [user])

  const login = async (email: string, password: string) => {
    setLoginError('')
    try {
      const account = await loginAccount(email, password)
      setUser(account)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '账号或密码不正确')
    }
  }

  const signup = async (email: string, password: string) => {
    setLoginError('')
    try {
      const account = await signupAccount(email, password)
      setUser(account)
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '注册失败')
    }
  }

  const createIdea = async (draft: IdeaDraft) => {
    if (!user) return
    const idea = await createIdeaRecord(draft, user)
    setIdeaList((current) => [idea, ...current])
    setComposerOpen(false)
    setRoute('ideas')
  }

  if (authChecking) {
    return (
      <div className="auth-splash">
        <span className="zl-brand-mark" />
        <p>正在恢复登录状态...</p>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={login} onSignup={signup} error={loginError} theme={theme} onToggleTheme={toggleTheme} />
  }

  return (
    <div className="zl-app">
      <nav className="zl-nav">
        <button className="zl-brand" type="button" onClick={() => setRoute('home')}>
          <span className="zl-brand-mark" />
          <span>芝兰点子王</span>
        </button>

        <span className="zl-nav-spacer" />

        <button className="zl-nav-search" type="button" onClick={() => setRoute('radar')}>
          <Search size={15} />
          <span>搜索主题、链接或点子</span>
          <kbd>⌘K</kbd>
        </button>

        <button
          className="theme-switch"
          type="button"
          aria-label={theme === 'dark' ? '切换为亮色模式' : '切换为深色模式'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <div className="zl-avatar" title={user.name}>
          {user.avatar}
        </div>
      </nav>

      {route === 'home' && <HomePage query={query} setQuery={setQuery} setRoute={setRoute} />}
      {route === 'radar' && <RadarPage query={query} setQuery={setQuery} radarState={radarState} setRadarState={setRadarState} />}
      {route === 'daily' && <DailyPage />}
      {route === 'ideas' && (
        <IdeasPage
          ideas={ideaList}
          user={user}
          onOpenComposer={() => setComposerOpen(true)}
          onCheckMarket={(nextQuery) => {
            setQuery(nextQuery)
            setRoute('radar')
          }}
        />
      )}
      {route === 'tools' && <ToolsPage />}
      {route === 'admin' && user.role === 'admin' && <AdminPage />}
      {composerOpen && <IdeaComposer onClose={() => setComposerOpen(false)} onCreate={createIdea} />}

      <FloatingDock
        route={route}
        onNavigate={setRoute}
        onCompose={() => setComposerOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
        showAdmin={user.role === 'admin'}
      />
    </div>
  )
}

function FloatingDock({
  route,
  onNavigate,
  onCompose,
  theme,
  onToggleTheme,
  showAdmin,
}: {
  route: View
  onNavigate: (view: View) => void
  onCompose: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  showAdmin: boolean
}) {
  const items: Array<{ id: View; icon: ReactNode; label: string }> = [
    { id: 'home', icon: <Home size={18} />, label: '工作台' },
    { id: 'radar', icon: <Radar size={18} />, label: '内容雷达' },
    { id: 'daily', icon: <Newspaper size={18} />, label: 'AI 日报' },
    { id: 'ideas', icon: <Lightbulb size={18} />, label: '点子市场' },
    { id: 'tools', icon: <Sparkles size={18} />, label: 'AI 工具' },
  ]
  return (
    <div className="zl-dock" role="toolbar" aria-label="快捷导航">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={route === item.id ? 'dock-item is-active' : 'dock-item'}
          onClick={() => onNavigate(item.id)}
          aria-label={item.label}
        >
          {item.icon}
          <span className="dock-tip">{item.label}</span>
        </button>
      ))}
      {showAdmin && (
        <button
          type="button"
          className={route === 'admin' ? 'dock-item is-active' : 'dock-item'}
          onClick={() => onNavigate('admin')}
          aria-label="账号管理"
        >
          <LockKeyhole size={18} />
          <span className="dock-tip">账号管理</span>
        </button>
      )}
      <span className="dock-divider" />
      <button type="button" className="dock-item" onClick={onCompose} aria-label="发布点子">
        <Plus size={20} />
        <span className="dock-tip">发布点子</span>
      </button>
      <button type="button" className="dock-item" onClick={onToggleTheme} aria-label={theme === 'dark' ? '切换为亮色' : '切换为深色'}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        <span className="dock-tip">{theme === 'dark' ? '亮色模式' : '深色模式'}</span>
      </button>
    </div>
  )
}

function LoginScreen({
  onLogin,
  onSignup,
  error,
  theme,
  onToggleTheme,
}: {
  onLogin: (email: string, password: string) => Promise<void>
  onSignup: (email: string, password: string) => Promise<void>
  error: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const focusAuth = (nextMode: 'login' | 'signup') => {
    setMode(nextMode)
    document.getElementById('auth-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <main className="public-site">
      <div className="login-noise" />
      <nav className="public-nav">
        <button className="zl-brand" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="zl-brand-mark" />
          <span>芝兰点子王</span>
          <span className="zl-brand-chip">Internal</span>
        </button>
        <span className="spacer" />
        <a href="#features">功能</a>
        <a href="#preview">预览</a>
        <button className="theme-switch" type="button" onClick={onToggleTheme} aria-label="切换主题">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="zl-btn ghost sm" type="button" onClick={() => focusAuth('login')}>
          登录
        </button>
        <button className="zl-btn primary sm" type="button" onClick={() => focusAuth('signup')}>
          创建账号
        </button>
      </nav>

      <section className="public-hero">
        <div className="public-hero-copy">
          <div className="login-brand-row">
            <span className="zl-brand-mark login-mark" />
            <span className="login-brand-text">
              <b>芝兰点子王</b>
              <small>ZHILAN IDEA KING</small>
            </span>
          </div>
          <p className="overline">INTERNAL IDEA OS</p>
          <h1>
            搜灵感。
            <span>做判断。</span>
          </h1>
          <p>给内容团队用的轻量工作台。外面只看入口，里面才是情报、点子和工具。</p>
          <div className="public-actions">
            <button className="zl-btn primary" type="button" onClick={() => focusAuth('login')}>
              <LockKeyhole size={15} />
              登录查看详情
            </button>
            <a className="zl-btn ghost" href="#features">
              先看功能
              <ArrowRight size={14} />
            </a>
          </div>
          <div className="login-signal-grid public-proof" aria-label="系统状态">
            <span>
              <b>Radar</b>
              <small>多平台搜索</small>
            </span>
            <span>
              <b>Daily</b>
              <small>AI 速览</small>
            </span>
            <span>
              <b>Tools</b>
              <small>小工具库</small>
            </span>
          </div>
        </div>
        <form
          id="auth-panel"
          className="login-form public-auth"
          onSubmit={async (event) => {
            event.preventDefault()
            setLoading(true)
            try {
              if (mode === 'signup') {
                await onSignup(email, password)
              } else {
                await onLogin(email, password)
              }
            } finally {
              setLoading(false)
            }
          }}
        >
          <div className="login-form-head">
            <p className="overline">{mode === 'signup' ? 'CREATE ACCOUNT' : 'WELCOME BACK'}</p>
            <h2>{mode === 'signup' ? '创建账号' : '进入工作台'}</h2>
          </div>
          <label>
            账号
            <input value={email} placeholder="name@example.com" type="email" onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            密码
            <input value={password} placeholder="输入密码" type="password" onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="inline-error">{error}</p>}
          <button className="zl-btn primary login-submit" type="submit">
            <LockKeyhole size={16} />
            {loading ? '处理中' : mode === 'signup' ? '创建账号' : '进入工作台'}
          </button>
          <button className="zl-btn ghost" type="button" onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>
            {mode === 'signup' ? '已有账号，去登录' : '没有账号，先创建'}
          </button>
        </form>
        <div className="public-console" aria-hidden="true">
          <div className="console-glow" />
          {[
            ['内容雷达', 'AI 漫剧', '86%'],
            ['日报速览', '2026-05-18', '已更新'],
            ['爆款拆解', '脚本结构', '排队中'],
            ['Builder 追踪', 'weekly digest', '周报'],
          ].map(([title, meta, stat], index) => (
            <div className={`console-card c${index + 1}`} key={title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{title}</strong>
              <small>{meta}</small>
              <b>{stat}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="public-section" id="features">
        <div className="section-title public-section-title">
          <h2>四个入口，少一点切换成本</h2>
          <span>登录后查看真实数据、内部讨论和工具结果。</span>
        </div>
        <div className="public-feature-grid">
          <article className="public-feature-card">
            <span className="public-feature-icon blue">
              <Radar size={22} />
            </span>
            <small>CONTENT RADAR</small>
            <h3>内容雷达</h3>
            <p>关键词进去，平台线索和 AI 简介出来。</p>
            <b>登录后查看搜索结果</b>
          </article>
          <article className="public-feature-card">
            <span className="public-feature-icon teal">
              <Newspaper size={22} />
            </span>
            <small>AI DAILY</small>
            <h3>AI 每日情报</h3>
            <p>每天一页，重点、机会、正文都排好。</p>
            <b>登录后阅读全文</b>
          </article>
          <article className="public-feature-card">
            <span className="public-feature-icon rose">
              <Lightbulb size={22} />
            </span>
            <small>IDEA MARKET</small>
            <h3>点子市场</h3>
            <p>随手记想法，再一键反查市场。</p>
            <b>登录后参与讨论</b>
          </article>
          <article className="public-feature-card">
            <span className="public-feature-icon violet">
              <Sparkles size={22} />
            </span>
            <small>AI TOOLS</small>
            <h3>AI 工具</h3>
            <p>爆款拆解、账号追踪、HTML PPT、Builder 周报都放这里。</p>
            <b>登录后试用工具</b>
          </article>
        </div>
      </section>

      <section className="public-preview" id="preview">
        <div className="public-preview-copy">
          <p className="overline">PROTECTED PREVIEW</p>
          <h2>详细信息已加锁</h2>
          <p>这是公司内部内容情报工作台。为了保护选题、内容线索和讨论内容，详细结果只对登录账号开放。</p>
          <button className="zl-btn primary" type="button" onClick={() => focusAuth('login')}>
            登录进入工作台
          </button>
        </div>
        <div className="public-preview-board" aria-hidden="true">
          {['内容雷达结果', 'AI 日报正文', '点子市场详情'].map((item, index) => (
            <div className="locked-row" key={item}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <b>{item}</b>
              <em>Locked</em>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}

function HomePage({
  query,
  setQuery,
  setRoute,
}: {
  query: string
  setQuery: (value: string) => void
  setRoute: (view: View) => void
}) {
  const submit = (value = query) => {
    setQuery(value || 'AI 漫剧')
    setRoute('radar')
  }

  return (
    <div className="home-page">
      <div className="zl-aurora">
        <div className="zl-aurora-3" />
      </div>
      <div className="zl-grid-bg" />
      <main className="zl-page zl-stagger">
        <header className="home-hero">
          <div className="zl-glass status-pill">
            <span className="pulse-dot" />
            <span>
              今日 AI 日报已更新 · <strong>自动整理中</strong>
            </span>
            <span className="divider" />
            <span className="en">TinyFish Search / Fetch 在线</span>
          </div>
          <h1>
            一眼看清市场
            <br />
            <span className="zl-grad-text">一秒沉淀点子</span>
          </h1>
          <p>为贝瓦儿歌 · 芝兰玉树内容团队打造的工作台。内容情报、AI 日报、选题点子，全部在这里。</p>
          <SearchHero value={query} onChange={setQuery} onSubmit={submit} />
        </header>

        <section className="entry-grid">
          <EntryCard
            label="MODULE 01"
            title="内容雷达"
            desc="一次搜索多平台，AI 解读爆点、借鉴与风险。"
            meta="TinyFish · YouTube · B站 · 抖音"
            accent="blue"
            icon={<Radar size={26} />}
            onClick={() => setRoute('radar')}
          />
          <EntryCard
            label="MODULE 02"
            title="AI 最新日报"
            desc="每天 3 分钟看完，和我们业务相关的内容自动高亮。"
            meta="每日速览 · 业务相关 · 选题机会"
            accent="teal"
            icon={<Newspaper size={26} />}
            onClick={() => setRoute('daily')}
          />
          <EntryCard
            label="MODULE 03"
            title="点子市场"
            desc="一句话也算，每条点子都可以一键市场反查。"
            meta="发布 · 认领 · 反查"
            accent="rose"
            icon={<Lightbulb size={26} />}
            onClick={() => setRoute('ideas')}
          />
          <EntryCard
            label="MODULE 04"
            title="AI 工具"
            desc="爆款拆解、账号追踪、HTML PPT、Builder 周报。"
            meta="拆解 · 生成 · 追踪"
            accent="violet"
            icon={<Sparkles size={26} />}
            onClick={() => setRoute('tools')}
          />
        </section>

        <section className="home-section">
          <SectionTitle title="本周脉搏" subtitle="一眼看清平台、点子和情报节奏" />
          <div className="kpi-row">
            <KpiCard label="内容雷达搜索" value="1,284" delta="+18.4%" color="218" spark={[12, 18, 15, 22, 28, 24, 32, 38, 42, 36, 48, 54]} />
            <KpiCard label="点子市场新增" value="46" delta="+6 本周" color="280" spark={[2, 4, 3, 6, 5, 8, 7, 9, 10, 12, 11, 14]} />
            <KpiCard label="AI 日报阅读" value="312" delta="+12.1%" color="160" spark={[20, 24, 22, 28, 26, 30, 34, 32, 38, 36, 42, 44]} />
            <KpiCard label="平均响应" value="0.8s" delta="-32ms" color="12" down spark={[28, 24, 26, 22, 20, 18, 19, 16, 14, 13, 12, 10]} />
          </div>
        </section>

        <section className="home-section">
          <SectionTitle title="今日状态" subtitle="真实接口已经开始接入" />
          <div className="status-grid">
            <StatusCard title="TinyFish Search" value="已验证" detail="AI 漫剧搜索可返回结构化结果" icon={<Search size={18} />} />
            <StatusCard title="TinyFish Fetch" value="已验证" detail="网页可转干净 Markdown" icon={<FileIcon />} />
            <StatusCard title="GitHub 日报" value="已验证" detail="最新 issue 可读取" icon={<CalendarDays size={18} />} />
          </div>
        </section>
      </main>
    </div>
  )
}

function KpiCard({
  label,
  value,
  delta,
  color,
  spark,
  down,
}: {
  label: string
  value: string
  delta: string
  color: string
  spark: number[]
  down?: boolean
}) {
  const max = Math.max(...spark)
  const min = Math.min(...spark)
  const range = max - min || 1
  const points = spark
    .map((v, i) => {
      const x = (i / (spark.length - 1)) * 120
      const y = 50 - ((v - min) / range) * 40 - 5
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const gradId = `spark-${label.replace(/\s+/g, '')}`
  return (
    <article className="kpi-card">
      <small>{label}</small>
      <strong>{value}</strong>
      <em className={down ? 'down' : ''}>
        {down ? <TrendingUp size={11} style={{ transform: 'scaleY(-1)' }} /> : <TrendingUp size={11} />}
        {delta}
      </em>
      <svg className="kpi-spark" viewBox="0 0 120 50" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={`oklch(70% 0.18 ${color})`} stopOpacity="0.55" />
            <stop offset="100%" stopColor={`oklch(70% 0.18 ${color})`} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={`${points} 120,50 0,50`}
          fill={`url(#${gradId})`}
          stroke="none"
        />
        <polyline
          points={points}
          fill="none"
          stroke={`oklch(62% 0.2 ${color})`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </article>
  )
}

function SearchHero({
  value,
  onChange,
  onSubmit,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: (value?: string) => void
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="search-wrap">
      <form
        className="zl-search-xl"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <Search size={20} />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 140)}
          placeholder="搜索 AI 漫剧、格林童话、创作者 ID 或视频链接"
        />
        <span className="zl-kbd">↵</span>
        <button className="zl-btn primary" type="submit">
          <Sparkles size={15} />
          开始情报
        </button>
      </form>
      {focused ? (
        <div className="zl-glass suggest-panel">
          {[
            ['搜索', value || 'AI 漫剧', '在 TinyFish 和本地采集服务里搜索'],
            ['趋势', '本周「儿童睡前故事」', '+125% 热度上升'],
            ['链接', '粘贴视频链接', '后续支持 YouTube / B站 / 抖音解析'],
          ].map(([kind, text, hint]) => (
            <button key={text} type="button" onMouseDown={() => onSubmit(text)}>
              <span className="suggest-icon">
                <Search size={14} />
              </span>
              <span>
                <strong>{text}</strong>
                <small>{hint}</small>
              </span>
              <em>{kind}</em>
            </button>
          ))}
        </div>
      ) : (
        <div className="quick-tags">
          <span>今日热搜</span>
          {hotSearches.map((tag) => (
            <button key={tag} type="button" onClick={() => onSubmit(tag)}>
              <Flame size={11} />
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type ToolIdea = {
  id: 'deconstruct' | 'tracker' | 'slides' | 'builders' | 'safety' | 'dream'
  title: string
  status: string
  desc: string
  tags: string[]
}

const toolIdeas: ToolIdea[] = [
  {
    id: 'deconstruct',
    title: '爆款一键拆解',
    status: '设计中',
    desc: '粘贴视频链接，拆标题、开头钩子、节奏、分镜和可复用模板。',
    tags: ['视频链接', '结构拆解', '选题复用'],
  },
  {
    id: 'tracker',
    title: '特定账号定时追踪',
    status: '排期中',
    desc: '关注竞品账号，每天或每周汇总新视频、播放变化和可借鉴点。',
    tags: ['YouTube', 'B站', '抖音'],
  },
  {
    id: 'slides',
    title: 'HTML 风格 PPT 生成器',
    status: '已接入',
    desc: '接入 frontend-slides 思路，把主题和大纲生成可预览、可下载的单文件网页演示。',
    tags: ['frontend-slides', 'HTML', 'PDF'],
  },
  {
    id: 'builders',
    title: 'AI Builders 周报',
    status: '已接入',
    desc: '接入 follow-builders 公开 feed，每天/每周追踪 AI builders、播客和产品博客。',
    tags: ['follow-builders', '周报', '趋势'],
  },
  {
    id: 'safety',
    title: '儿童内容安全检查',
    status: '想法',
    desc: '检查标题、画面描述、台词是否适合儿童观看，输出风险提示。',
    tags: ['儿童友好', '审核', '台词'],
  },
  {
    id: 'dream',
    title: '梦境视频企划机',
    status: '想法',
    desc: '收集团队梦境，自动生成综合类账号的脚本结构和视觉关键词。',
    tags: ['综合账号', 'AI 实现', '脚本'],
  },
]

function ToolsPage() {
  const [active, setActive] = useState(toolIdeas[0])
  const outputRef = useRef<HTMLElement | null>(null)
  const [slidesTopic, setSlidesTopic] = useState('给公司同事介绍 AI 漫剧选题调研方法')
  const [slidesOutline, setSlidesOutline] = useState('1. 为什么要做 AI 漫剧调研\n2. 怎么看平台数据和近期热度\n3. 如何把爆款结构转成儿童内容\n4. 下一步试做计划')
  const [slidesStyle, setSlidesStyle] = useState<SlidesStyle>('electric-studio')
  const [slidesLoading, setSlidesLoading] = useState(false)
  const [slidesError, setSlidesError] = useState('')
  const [slidesResult, setSlidesResult] = useState<FrontendSlidesResponse | null>(null)
  const [buildersCadence, setBuildersCadence] = useState<'daily' | 'weekly'>('weekly')
  const [buildersFocus, setBuildersFocus] = useState('AI agent、开发者工具、内容生产效率、适合贝瓦/芝兰做成小工具的启发')
  const [buildersLoading, setBuildersLoading] = useState(false)
  const [buildersError, setBuildersError] = useState('')
  const [buildersResult, setBuildersResult] = useState<FollowBuildersResponse | null>(null)

  const runSlides = async () => {
    setSlidesLoading(true)
    setSlidesError('')
    try {
      const result = await generateFrontendSlides({
        topic: slidesTopic,
        outline: slidesOutline,
        style: slidesStyle,
        audience: '芝兰玉树/贝瓦内容与制作团队',
        slideCount: 8,
      })
      setSlidesResult(result)
    } catch (error) {
      setSlidesError(error instanceof Error ? error.message : 'PPT 生成失败')
    } finally {
      setSlidesLoading(false)
    }
  }

  const runBuilders = async () => {
    setBuildersLoading(true)
    setBuildersError('')
    try {
      const result = await buildFollowBuildersDigest({
        cadence: buildersCadence,
        language: 'zh',
        focus: buildersFocus,
        limitBuilders: 9,
      })
      setBuildersResult(result)
    } catch (error) {
      setBuildersError(error instanceof Error ? error.message : 'Builders 摘要生成失败')
    } finally {
      setBuildersLoading(false)
    }
  }

  const downloadSlides = () => {
    if (!slidesResult?.html) return
    const blob = new Blob([slidesResult.html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${slidesResult.title || 'zhilan-slides'}.html`
    link.click()
    URL.revokeObjectURL(url)
  }

  useEffect(() => {
    if (!slidesResult && !buildersResult) return
    window.setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }, [slidesResult, buildersResult])

  return (
    <main className="zl-page tools-page">
      <section className="tools-hero zl-card">
        <div>
          <p className="overline">AI TOOLKIT</p>
          <h1>把零散的小工具，收进一个工作台。</h1>
          <p>先把能直接提升效率的工具跑起来：HTML 演示生成、AI Builders 摘要已经可以调用本地脚本；其他工具继续排期。</p>
        </div>
        <div className="tools-orbit" aria-hidden="true">
          <span />
          <b>Skills</b>
          <em>Agents</em>
        </div>
      </section>

      <section className="tools-layout">
        <div className="tools-grid" aria-label="AI 小工具目录">
          {toolIdeas.map((tool) => (
            <button
              className={active.title === tool.title ? 'tool-card is-active' : 'tool-card'}
              key={tool.title}
              type="button"
              onClick={() => setActive(tool)}
            >
              <span>{tool.status}</span>
              <h3>{tool.title}</h3>
              <p>{tool.desc}</p>
              <div>
                {tool.tags.map((tag) => (
                  <small key={tag}>{tag}</small>
                ))}
              </div>
              <strong>进入工作台</strong>
            </button>
          ))}
        </div>

        <section className="tool-detail tool-workbench zl-card" aria-label={`${active.title} 工作台`}>
          <div className="tool-workbench-head">
            <span className="zl-pill">
              <span className="led" />
              {active.status}
            </span>
            <h2>{active.title}</h2>
            <p>{active.desc}</p>
          </div>
          {active.id === 'slides' ? (
            <div className="tool-runner">
              <label>
                <span>演示主题</span>
                <input value={slidesTopic} onChange={(event) => setSlidesTopic(event.target.value)} />
              </label>
              <label>
                <span>大纲 / 备注</span>
                <textarea rows={6} value={slidesOutline} onChange={(event) => setSlidesOutline(event.target.value)} />
              </label>
              <label>
                <span>视觉风格</span>
                <select value={slidesStyle} onChange={(event) => setSlidesStyle(event.target.value as SlidesStyle)}>
                  <option value="electric-studio">Electric Studio · 清爽高端</option>
                  <option value="bold-signal">Bold Signal · 强冲击</option>
                  <option value="notebook-tabs">Notebook Tabs · 编辑感</option>
                  <option value="swiss-modern">Swiss Modern · 数据简报</option>
                  <option value="paper-ink">Paper & Ink · 故事感</option>
                  <option value="neon-cyber">Neon Cyber · AI 科技</option>
                </select>
              </label>
              {slidesError && <p className="inline-error">{slidesError}</p>}
              <button className="zl-btn primary" type="button" onClick={runSlides} disabled={slidesLoading}>
                <Sparkles size={14} />
                {slidesLoading ? '正在生成 HTML 演示...' : '生成 HTML 演示'}
              </button>
            </div>
          ) : active.id === 'builders' ? (
            <div className="tool-runner">
              <div className="segmented">
                <button className={buildersCadence === 'daily' ? 'active' : ''} type="button" onClick={() => setBuildersCadence('daily')}>
                  今日摘要
                </button>
                <button className={buildersCadence === 'weekly' ? 'active' : ''} type="button" onClick={() => setBuildersCadence('weekly')}>
                  本周摘要
                </button>
              </div>
              <label>
                <span>关注重点</span>
                <textarea rows={5} value={buildersFocus} onChange={(event) => setBuildersFocus(event.target.value)} />
              </label>
              {buildersError && <p className="inline-error">{buildersError}</p>}
              <button className="zl-btn primary" type="button" onClick={runBuilders} disabled={buildersLoading}>
                <Sparkles size={14} />
                {buildersLoading ? '正在抓取并整理...' : '生成 Builders 摘要'}
              </button>
            </div>
          ) : (
            <div className="tool-flow">
              <div>
                <b>输入</b>
                <span>链接 / 关键词 / 账号 / 大纲</span>
              </div>
              <div>
                <b>处理</b>
                <span>本地脚本 + skill + AI 摘要</span>
              </div>
              <div>
                <b>输出</b>
                <span>表格、报告、HTML、PDF 或周报</span>
              </div>
            </div>
          )}
        </section>
      </section>

      {(slidesResult || buildersResult) && (
        <section className="tool-output zl-card" ref={outputRef}>
          {slidesResult && active.id === 'slides' && (
            <>
              <div className="tool-output-head">
                <div>
                  <p className="overline">HTML PRESENTATION</p>
                  <h2>{slidesResult.title}</h2>
                  <span>
                    {slidesResult.style} · {slidesResult.slideCount} 页 · 已保存到本地
                  </span>
                </div>
                <button className="zl-btn ghost" type="button" onClick={downloadSlides}>
                  <Download size={14} />
                  下载 HTML
                </button>
              </div>
              <iframe className="slides-preview" title={slidesResult.title} srcDoc={slidesResult.html} />
            </>
          )}

          {buildersResult && active.id === 'builders' && (
            <>
              <div className="tool-output-head">
                <div>
                  <p className="overline">FOLLOW BUILDERS</p>
                  <h2>{buildersResult.title}</h2>
                  <span>
                    {buildersResult.cadence === 'daily' ? '今日' : '本周'} · {buildersResult.stats?.builders ?? 0} 位 builders ·{' '}
                    {buildersResult.stats?.items ?? 0} 条动态
                  </span>
                </div>
              </div>
              <p className="builders-summary">{buildersResult.summary}</p>
              <div className="builders-grid">
                {(buildersResult.highlights ?? []).map((item, index) => (
                  <a className="builder-card" href={item.url} target="_blank" rel="noreferrer" key={`${item.url}-${index}`}>
                    <span>{item.source || 'Builder'}</span>
                    <h3>{item.title}</h3>
                    <p>{item.why_it_matters || item.whyItMatters || '打开原文查看完整动态。'}</p>
                    <small>
                      原文 <ArrowUpRight size={12} />
                    </small>
                  </a>
                ))}
              </div>
              <div className="builders-actions">
                <div>
                  <b>趋势信号</b>
                  {(buildersResult.signals ?? []).map((signal, index) => (
                    <p key={`signal-${index}`}>{builderLineText(signal)}</p>
                  ))}
                </div>
                <div>
                  <b>可执行动作</b>
                  {(buildersResult.actions ?? []).map((action, index) => (
                    <p key={`action-${index}`}>{builderLineText(action)}</p>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  )
}

function builderLineText(value: unknown): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return String(value ?? '')
  const item = value as Record<string, unknown>
  const main = item.signal || item.action || item.title || item.summary || item.text || ''
  const detail = item.implication || item.reason || item.why_it_matters || item.description || ''
  return [main, detail].filter(Boolean).map(String).join('：')
}

function RadarScope({
  query,
  progress,
  loading,
  resultsCount,
  activePlatforms,
}: {
  query: string
  progress: number
  loading: boolean
  resultsCount: number
  activePlatforms: number
}) {
  const sweep = loading ? Math.max(18, progress) : resultsCount ? 100 : 28
  return (
    <section className={loading ? 'radar-scope zl-card is-scanning' : 'radar-scope zl-card'}>
      <div className="scope-visual" aria-hidden="true">
        <span className="ring r1" />
        <span className="ring r2" />
        <span className="ring r3" />
        <span className="sweep" style={{ '--sweep': `${sweep}%` } as Record<string, string>} />
        <i className="dot d1" />
        <i className="dot d2" />
        <i className="dot d3" />
        <i className="dot d4" />
      </div>
      <div className="scope-copy">
        <p className="overline">LIVE RADAR</p>
        <h2>{loading ? '正在扫描多平台内容信号' : resultsCount ? '本轮内容信号已归档' : '准备启动内容雷达'}</h2>
        <p>
          搜索词 <b>{query}</b> · 已选择 {activePlatforms} 个平台 · {resultsCount ? `保留 ${resultsCount} 条结果` : '点击情报刷新开始采集'}
        </p>
      </div>
      <div className="scope-stats">
        <span>
          <b>{Math.round(sweep)}</b>
          <small>进度</small>
        </span>
        <span>
          <b>{activePlatforms}</b>
          <small>平台</small>
        </span>
        <span>
          <b>{resultsCount}</b>
          <small>结果</small>
        </span>
      </div>
    </section>
  )
}

function RadarPage({
  query,
  setQuery,
  radarState,
  setRadarState,
}: {
  query: string
  setQuery: (value: string) => void
  radarState: RadarState
  setRadarState: Dispatch<SetStateAction<RadarState>>
}) {
  const [platforms, setPlatforms] = useState<Record<string, boolean>>({
    youtube: true,
    tiktok: true,
    bilibili: true,
    douyin: true,
    web: true,
  })
  const [sort, setSort] = useState<SortMode>('hot')
  const [range, setRange] = useState('7d')
  const [expanded, setExpanded] = useState('seed-youtube')
  const [languageFilter, setLanguageFilter] = useState<'all' | 'zh' | 'en'>('all')
  const [strictAiOnly, setStrictAiOnly] = useState(true)
  const [minOpportunity, setMinOpportunity] = useState(50)
  const { loading, error, results, sourceStatus, progress, searchPlan, insight } = radarState

  const selectedApis = useMemo(() => {
    return platformDefs.filter((item) => platforms[item.id]).map((item) => item.api)
  }, [platforms])
  const activePlatformCount = useMemo(() => platformDefs.filter((item) => platforms[item.id]).length, [platforms])
  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      if (strictAiOnly && !item.passesAiStoryGate) return false
      if (languageFilter !== 'all' && item.language !== languageFilter) return false
      if (item.opportunityScore < minOpportunity) return false
      return true
    })
  }, [languageFilter, minOpportunity, results, strictAiOnly])
  const radarInsight = insight ?? buildLocalRadarInsight(results)

  const runSearch = async () => {
    const startedAt = Date.now()
    setRadarState((current) => ({
      ...current,
      loading: true,
      error: '',
      progress: { active: true, percent: 8, label: '创建搜索任务', startedAt },
    }))
    try {
      setRadarState((current) => ({
        ...current,
        progress: { ...current.progress, active: true, percent: 22, label: '平台采集中' },
      }))
      const body = await searchContent({
        query,
        platforms: Array.from(new Set(selectedApis)),
        sort,
        timeRange: range,
        limit: 12,
        includeAiBrief: true,
        fetchTop: 3,
        aiBriefTop: 5,
        briefMode: 'auto',
      })
      setRadarState((current) => ({
        ...current,
        progress: { ...current.progress, active: true, percent: 82, label: '整理结果与 AI 摘要' },
      }))
      const nextResults = (body.items as ApiContentItem[]).map(toContentItem)
      setRadarState((current) => ({
        ...current,
        loading: false,
        error: '',
        results: nextResults,
        sourceStatus: body.sourceStatus ?? {},
        searchPlan: body.searchPlan,
        insight: body.insight,
        progress: {
          active: false,
          percent: 100,
          label: `完成，用时 ${formatElapsed(body.elapsedMs ?? Date.now() - startedAt)}`,
          startedAt,
          finishedAt: Date.now(),
        },
      }))
      if (nextResults[0]) setExpanded(nextResults[0].id)
    } catch (searchError) {
      setRadarState((current) => ({
        ...current,
        loading: false,
        error: searchError instanceof Error ? searchError.message : '搜索失败',
        progress: {
          ...current.progress,
          active: false,
          percent: 100,
          label: '搜索失败',
          finishedAt: Date.now(),
        },
      }))
    }
  }

  useEffect(() => {
    if (!loading) return
    const timer = window.setInterval(() => {
      setRadarState((current) => {
        if (!current.loading) return current
        const elapsed = Date.now() - (current.progress.startedAt ?? Date.now())
        const nextPercent = Math.min(78, Math.max(current.progress.percent, 18 + Math.floor(elapsed / 1200) * 6))
        const label = elapsed < 2500 ? '平台采集中' : elapsed < 7000 ? '抓取页面与热度信息' : '生成 AI 简介，稍等一下'
        return {
          ...current,
          progress: { ...current.progress, active: true, percent: nextPercent, label },
        }
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [loading, setRadarState])

  return (
    <main className="zl-page radar-page">
      <form
        className="zl-search-xl radar-search"
        onSubmit={(event) => {
          event.preventDefault()
          runSearch()
        }}
      >
        <Search size={18} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="关键词、创作者 ID 或视频链接" />
        <button className="zl-btn ghost sm" type="button">
          <CalendarDays size={14} />
          {range === '24h' ? '24 小时' : range === '7d' ? '7 天' : range === '30d' ? '30 天' : '全部时间'}
          <ChevronDown size={12} />
        </button>
        <button className="zl-btn primary" type="submit">
          <Sparkles size={14} />
          {loading ? '搜索中' : '情报刷新'}
        </button>
      </form>

      <div className="radar-layout">
        <aside className="filter-rail">
          <FilterBlock title="平台">
            {platformDefs.map((platform) => (
              <label className={platforms[platform.id] ? 'filter-row' : 'filter-row is-off'} key={platform.id}>
                <span className={`zl-pf ${platform.id}`}>
                  <span className="blob" />
                  {platform.name}
                </span>
                <span className="en">{platform.count}</span>
                <Toggle
                  on={platforms[platform.id]}
                  onClick={() => setPlatforms((current) => ({ ...current, [platform.id]: !current[platform.id] }))}
                />
              </label>
            ))}
          </FilterBlock>
          <FilterBlock title="时间范围">
            <div className="range-grid">
              {[
                ['24h', '24 小时'],
                ['7d', '7 天'],
                ['30d', '30 天'],
                ['all', '全部'],
              ].map(([id, label]) => (
                <button className={range === id ? 'is-active' : ''} key={id} type="button" onClick={() => setRange(id)}>
                  {label}
                </button>
              ))}
            </div>
          </FilterBlock>
          <FilterBlock title="结果偏好">
            <button className={strictAiOnly ? 'check-row is-active' : 'check-row'} type="button" onClick={() => setStrictAiOnly(!strictAiOnly)}>
              <span className={strictAiOnly ? 'checkbox is-checked' : 'checkbox'}>{strictAiOnly && <Check size={10} />}</span>
              只看 AI 生成内容
            </button>
            <label className="range-slider-row">
              <span>机会分 ≥ {minOpportunity}</span>
              <input min="0" max="90" step="10" type="range" value={minOpportunity} onChange={(event) => setMinOpportunity(Number(event.target.value))} />
            </label>
            <div className="range-grid compact">
              {[
                ['all', '全部'],
                ['zh', '中文'],
                ['en', '英文'],
              ].map(([id, label]) => (
                <button className={languageFilter === id ? 'is-active' : ''} key={id} type="button" onClick={() => setLanguageFilter(id as 'all' | 'zh' | 'en')}>
                  {label}
                </button>
              ))}
            </div>
          </FilterBlock>
        </aside>

        <section>
          <div className="result-toolbar">
            <span>
              搜索词 <b>{query || 'AI 漫剧'}</b>
            </span>
            <span className="spacer" />
            <div className="zl-segment">
              <button className={sort === 'hot' ? 'is-active' : ''} type="button" onClick={() => setSort('hot')}>
                <Flame size={13} />
                近期热度
              </button>
              <button className={sort === 'views' ? 'is-active' : ''} type="button" onClick={() => setSort('views')}>
                <Play size={12} />
                播放量
              </button>
              <button className={sort === 'new' ? 'is-active' : ''} type="button" onClick={() => setSort('new')}>
                <Clock3 size={13} />
                最新
              </button>
            </div>
            <button className="zl-icon-btn outline" type="button" aria-label="筛选">
              <Filter size={15} />
            </button>
          </div>

          <RadarScope
            query={query || 'AI 漫剧'}
            progress={progress.percent}
            loading={loading}
            resultsCount={filteredResults.length}
            activePlatforms={activePlatformCount}
          />

          <SearchPlanPanel query={query || 'AI 漫剧'} searchPlan={searchPlan} insight={radarInsight} />

          <div className="zl-card ai-overview">
            <div>
              <span className="overview-icon">
                <Sparkles size={14} />
              </span>
              <strong>AI 全局解读</strong>
              <small>{Object.keys(sourceStatus).length ? '已启用严格 AI 内容门槛' : '当前展示样例数据，可点击情报刷新'}</small>
            </div>
            <p>{radarInsight.summary}</p>
            <div className="insight-strip">
              <span>
                <b>{radarInsight.avgOpportunity ?? 0}</b>
                平均机会分
              </span>
              <span>
                <b>{radarInsight.topTopics?.[0] ?? 'AI story'}</b>
                主要题材簇
              </span>
              <span>
                <b>{filteredResults.length}/{results.length}</b>
                通过当前筛选
              </span>
            </div>
            {error && <p className="inline-error">{error}</p>}
            {(loading || progress.percent > 0) && (
              <div className={loading ? 'radar-progress is-active' : 'radar-progress'}>
                <div className="radar-progress-head">
                  <span>{progress.label}</span>
                  <b>{Math.round(progress.percent)}%</b>
                </div>
                <div className="radar-progress-track">
                  <span style={{ width: `${Math.max(4, progress.percent)}%` }} />
                </div>
                <small>
                  {loading
                    ? '可以切到其它页面，回来后仍会保留当前进度。多平台采集通常需要 10-40 秒。'
                    : '最近一次搜索结果已保留在当前页面。'}
                </small>
              </div>
            )}
            {Object.keys(sourceStatus).length > 0 && (
              <div className="source-status">
                {Object.entries(sourceStatus).map(([platform, status]) => (
                  <span key={platform}>
                    {platform}: {status}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="result-list zl-stagger">
            {loading
              ? [0, 1, 2].map((item) => <ResultSkeleton key={item} />)
              : filteredResults.map((result) => (
                  <ResultCard
                    key={result.id}
                    result={result}
                    expanded={expanded === result.id}
                    onToggle={() => setExpanded(expanded === result.id ? '' : result.id)}
                  />
                ))}
            {!loading && !filteredResults.length && (
              <div className="zl-card empty-radar">
                <Sparkles size={18} />
                <strong>没有结果通过当前 AI 严格筛选</strong>
                <p>可以把机会分阈值调低，或改成 30 天范围；但主结果仍会优先保证“AI 制作 + 动画/短剧/故事”相关。</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function SearchPlanPanel({
  query,
  searchPlan,
  insight,
}: {
  query: string
  searchPlan?: RadarState['searchPlan']
  insight: NonNullable<RadarState['insight']>
}) {
  const zhTerms = searchPlan?.zhTerms?.length ? searchPlan.zhTerms.slice(0, 5) : [query, 'AI 动画短剧', 'AI 生成动画']
  const enTerms = searchPlan?.enTerms?.length ? searchPlan.enTerms.slice(0, 5) : ['AI animated series', 'AI generated animation', 'cinematic AI animation']
  const probes = searchPlan?.topicProbes?.slice(0, 5) ?? ['AI zombie animation', 'AI fairy tale animation', 'AI animated story twist']

  return (
    <section className="radar-intel-grid">
      <article className="zl-card search-plan-card">
        <header>
          <div>
            <strong>搜索计划</strong>
            <small>先锁定 AI 生成内容，再扩展中英文线索</small>
          </div>
          <span>{searchPlan?.intent === 'ai_story_video' ? 'AI STORY GATE' : 'GENERAL'}</span>
        </header>
        <div className="term-groups">
          <TermGroup title="中文主线" terms={zhTerms} />
          <TermGroup title="英文主线" terms={enTerms} />
          <TermGroup title="题材探针" terms={probes} muted />
        </div>
      </article>
      <article className="zl-card trend-map-card">
        <header>
          <strong>题材聚类</strong>
          <small>结果会按机会分重排，普通动画和教程会被压低或过滤</small>
        </header>
        <div className="topic-orbit">
          {(insight.topTopics?.length ? insight.topTopics : ['ai story', 'cinematic', 'series']).slice(0, 4).map((topic, index) => (
            <span className={`topic-node n${index + 1}`} key={topic}>
              {topic}
            </span>
          ))}
          <b>{insight.avgOpportunity ?? 0}</b>
        </div>
      </article>
    </section>
  )
}

function TermGroup({ title, terms, muted = false }: { title: string; terms: string[]; muted?: boolean }) {
  return (
    <div className={muted ? 'term-group is-muted' : 'term-group'}>
      <b>{title}</b>
      <div>
        {terms.map((term) => (
          <span key={term}>{term}</span>
        ))}
      </div>
    </div>
  )
}

function DailyPage() {
  const [dailyList, setDailyList] = useState<DailyIssueRecord[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<Record<string, boolean>>({ summary: true, relevance: true, body: true })
  const daily = dailyList.find((item) => (item.id || String(item.issueNumber)) === selectedId) ?? dailyList[0] ?? null
  const summary = daily?.summary
  const highlights = normalizeDailyList(summary?.highlights).length ? normalizeDailyList(summary?.highlights) : dailyHighlights
  const ideaSeeds = normalizeDailyList(summary?.idea_seeds).length
    ? normalizeDailyList(summary?.idea_seeds)
    : ['从今天的模型、工具和案例里提炼一个可验证的儿童内容选题。']
  const toolOpportunities = normalizeDailyList(summary?.tool_opportunities).length
    ? normalizeDailyList(summary?.tool_opportunities)
    : ['沉淀可复用 prompt、脚本或内部小工具。']
  const overviewItems = parseDailyOverview(daily?.contentMarkdown || '')
  const bodySections = parseDailyBodySections(daily?.contentMarkdown || '')

  useEffect(() => {
    let cancelled = false
    async function loadDaily() {
      setLoading(true)
      setError('')
      try {
        const issues = await listDailyIssues(14)
        if (!cancelled) {
          setDailyList(issues)
          if (issues[0]) setSelectedId(issues[0].id || String(issues[0].issueNumber))
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '日报读取失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadDaily()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="zl-page daily-page">
      <aside className="date-rail">
        {dailyList.map((item, index) => {
          const id = item.id || String(item.issueNumber)
          return (
            <button className={id === selectedId ? 'is-active' : ''} key={id} type="button" onClick={() => setSelectedId(id)}>
              <span className="en">{item.date ? item.date.slice(5) : '--'}</span>
              <small>{index === 0 ? '最新' : `#${item.issueNumber ?? '-'}`}</small>
            </button>
          )
        })}
        {!dailyList.length && (
          <button className="is-active" type="button">
            <span className="en">--</span>
            <small>{loading ? '读取中' : '暂无日报'}</small>
          </button>
        )}
      </aside>

      <article className="daily-reader">
        <header>
          <span className="zl-pill">
            <span className="led" />
            {daily ? `${daily.date} 已更新` : loading ? '正在读取今日日报' : '等待同步'}
          </span>
          <h1>{daily ? `AI 日报 ${daily.date}` : 'AI 最新日报'}</h1>
          <p>给内容、工具和选题团队看的每日 AI 速览。先看表格，再读正文。</p>
        </header>

        {error && <p className="inline-error">{error}</p>}

        <DailySection
          title="今日速览"
          subtitle={summary?.editor_note || '按标题、简要说明和原文链接快速扫一遍'}
          open={Boolean(open.summary)}
          onToggle={() => setOpen((current) => ({ ...current, summary: !current.summary }))}
        >
          <div className="daily-table-wrap">
            <table className="daily-overview-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>简要说明</th>
                  <th>分类</th>
                  <th>原文</th>
                </tr>
              </thead>
              <tbody>
                {(overviewItems.length ? overviewItems : highlights.map((item, index) => ({
                  id: `fallback-${index}`,
                  rank: index + 1,
                  title: item,
                  brief: item,
                  category: '今日重点',
                  url: '',
                }))).map((item) => (
                  <tr key={item.id}>
                    <td className="daily-rank-cell">
                      <span>{String(item.rank).padStart(2, '0')}</span>
                    </td>
                    <td>
                      <strong>{item.title}</strong>
                    </td>
                    <td>{item.brief}</td>
                    <td>
                      <span className="daily-category">{item.category}</span>
                    </td>
                    <td>
                      {item.url ? (
                        <a className="daily-source-link" href={item.url} target="_blank" rel="noreferrer">
                          查看
                          <ExternalLink size={13} />
                        </a>
                      ) : (
                        <span className="daily-source-empty">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DailySection>

        <DailySection
          title="和我们有什么关系"
          subtitle="儿童内容 / AI 漫剧 / 工具机会"
          open={Boolean(open.relevance)}
          onToggle={() => setOpen((current) => ({ ...current, relevance: !current.relevance }))}
        >
          <div className="daily-product-grid">
            <section>
              <h4>业务相关性</h4>
              <p>{summary?.child_content_relevance || '日报已入库，等待下一次同步生成业务相关性摘要。'}</p>
            </section>
            <section>
              <h4>可转化选题</h4>
              <ul>
                {ideaSeeds.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section>
              <h4>工具机会</h4>
              <ul>
                {toolOpportunities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>
        </DailySection>

        <DailySection
          title="正文整理"
          subtitle="保留可读信息，去掉封面、视频入口和来源痕迹"
          open={Boolean(open.body)}
          onToggle={() => setOpen((current) => ({ ...current, body: !current.body }))}
        >
          <div className="daily-body-list">
            {(bodySections.length ? bodySections : [{ id: 'empty', rank: 1, title: '暂无正文', quote: '', paragraphs: ['今日日报还没有读取到正文内容。'], images: [], url: '' }]).map((section) => (
              <section key={section.id}>
                <div className="daily-body-head">
                  <span className="daily-rank-badge">{String(section.rank).padStart(2, '0')}</span>
                  <h4>{section.url ? <a href={section.url} target="_blank" rel="noreferrer">{section.title}</a> : section.title}</h4>
                </div>
                {section.images.length > 0 && (
                  <div className="daily-image-grid">
                    {section.images.slice(0, 2).map((image) => (
                      <img src={image} alt={section.title} loading="lazy" key={image} />
                    ))}
                  </div>
                )}
                {section.quote && <p className="daily-quote">{section.quote}</p>}
                <div className="daily-paragraphs">
                  {section.paragraphs.slice(0, 4).map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DailySection>
      </article>

      <aside className="relevance-rail">
        <h3>团队提示</h3>
        <div>
          <span className="dot" />
          <span>业务相关性</span>
          <b>{summary?.child_content_relevance ? '有' : '-'}</b>
        </div>
        <div>
          <span className="dot" />
          <span>选题种子</span>
          <b>{ideaSeeds.length}</b>
        </div>
        <div>
          <span className="dot" />
          <span>工具机会</span>
          <b>{toolOpportunities.length}</b>
        </div>
      </aside>
    </main>
  )
}

function normalizeDailyList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(/\n+/)
      .map((item) => item.replace(/^\s*\d+[.)、]\s*/, '').trim())
      .filter(Boolean)
  }
  return []
}

function parseDailyOverview(markdown: string) {
  const lines = markdown.split('\n')
  const items: Array<{ id: string; rank: number; title: string; brief: string; category: string; url: string }> = []
  let inOverview = false
  let category = '今日重点'

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed === '## 概览') {
      inOverview = true
      continue
    }
    if (inOverview && trimmed === '---') break
    if (!inOverview) continue

    const categoryMatch = trimmed.match(/^###\s+(.+)$/)
    if (categoryMatch) {
      category = categoryMatch[1]
      continue
    }

    const itemMatch = trimmed.match(/^-\s+(.+?)\s+\[↗\]\((https?:\/\/[^)]+)\)\s*`#(\d+)`/)
    if (itemMatch) {
      const title = stripMarkdown(itemMatch[1])
      items.push({
        id: itemMatch[3],
        rank: Number(itemMatch[3]),
        title,
        brief: title,
        category,
        url: itemMatch[2],
      })
    }
  }

  return items.sort((a, b) => a.rank - b.rank)
}

function parseDailyBodySections(markdown: string) {
  const sections: Array<{ id: string; rank: number; title: string; quote: string; paragraphs: string[]; images: string[]; url: string }> = []
  const chunks = markdown.split(/\n---\n+/)

  for (const chunk of chunks) {
    const titleMatch = chunk.match(/^##\s+\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s+`#(\d+)`/m)
    if (!titleMatch) continue

    const images = Array.from(chunk.matchAll(/!\[[^\]]*]\((https?:\/\/[^)]+)\)/g)).map((match) => match[1])
    const paragraphs: string[] = []
    let quote = ''

    for (const line of chunk.split('\n')) {
      const trimmed = line.trim()
      if (
        !trimmed ||
        trimmed.startsWith('## ') ||
        trimmed.startsWith('![') ||
        trimmed.startsWith('相关链接') ||
        trimmed.startsWith('- [http') ||
        trimmed.startsWith('[http')
      ) {
        continue
      }

      const cleaned = stripMarkdown(trimmed.replace(/^>\s*/, '')).replace(/\s+/g, ' ').trim()
      if (!cleaned) continue

      if (trimmed.startsWith('>') && !quote) {
        quote = cleaned
        continue
      }
      paragraphs.push(cleaned)
    }

    const compactParagraphs = paragraphs
      .join('\n')
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean)

    sections.push({
      id: titleMatch[3],
      rank: Number(titleMatch[3]),
      title: stripMarkdown(titleMatch[1]),
      url: titleMatch[2],
      quote,
      paragraphs: compactParagraphs,
      images,
    })
  }

  return sections.sort((a, b) => a.rank - b.rank)
}

function stripMarkdown(value: string) {
  return value
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .trim()
}

function formatElapsed(ms: number) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
function IdeasPage({
  ideas,
  user,
  onOpenComposer,
  onCheckMarket,
}: {
  ideas: Idea[]
  user: User
  onOpenComposer: () => void
  onCheckMarket: (query: string) => void
}) {
  const [filter, setFilter] = useState('all')
  const [expanded, setExpanded] = useState('')
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const visibleIdeas = ideas.filter((idea) => filter === 'all' || idea.status === filter || (filter === 'hot' && idea.hot))

  const toggleReaction = async (ideaId: string, kind: 'like' | 'save') => {
    const state = kind === 'like' ? liked : saved
    const setter = kind === 'like' ? setLiked : setSaved
    const nextActive = !state[ideaId]
    setter((current) => ({ ...current, [ideaId]: nextActive }))
    try {
      await toggleIdeaReaction(ideaId, kind, nextActive)
    } catch {
      setter((current) => ({ ...current, [ideaId]: !nextActive }))
    }
  }

  return (
    <main className="zl-page ideas-page">
      <header className="ideas-head">
        <div>
          <h1>点子市场</h1>
          <p>谁都可以发，谁都可以认领。每个点子都能一键反查市场。</p>
        </div>
        <span className="spacer" />
        <Stat n="46" k="本月点子" />
        <Stat n="12" k="已认领" />
        <Stat n="5" k="已发布" />
        <button className="zl-btn primary" type="button" onClick={onOpenComposer}>
          <Plus size={14} />
          发布点子
        </button>
      </header>
      <div className="idea-filter">
        {[
          ['all', '全部'],
          ['hot', '热门'],
          ['open', '开放中'],
          ['claimed', '已认领'],
          ['producing', '制作中'],
          ['published', '已发布'],
        ].map(([id, label]) => (
          <button className={filter === id ? 'is-active' : ''} key={id} type="button" onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
      <section className="idea-grid zl-stagger">
        {visibleIdeas.map((idea) => (
          <IdeaCard
            idea={idea}
            user={user}
            key={idea.id}
            liked={Boolean(liked[idea.id])}
            saved={Boolean(saved[idea.id])}
            expanded={expanded === idea.id}
            onLike={() => toggleReaction(idea.id, 'like')}
            onSave={() => toggleReaction(idea.id, 'save')}
            onToggle={() => setExpanded(expanded === idea.id ? '' : idea.id)}
            onOpenRadar={onCheckMarket}
          />
        ))}
      </section>
    </main>
  )
}

function AdminPage() {
  const [entries, setEntries] = useState<SignupAllowlistEntry[]>([])
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    const list = await listSignupAllowlist()
    setEntries(list)
  }

  useEffect(() => {
    let cancelled = false
    async function loadAllowlist() {
      try {
        const list = await listSignupAllowlist()
        if (!cancelled) setEntries(list)
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '读取白名单失败')
      }
    }
    loadAllowlist()
    return () => {
      cancelled = true
    }
  }, [])

  const addEmail = async () => {
    const nextEmail = email.trim().toLowerCase()
    if (!nextEmail) return
    setLoading(true)
    setError('')
    try {
      await addSignupAllowlistEmail(nextEmail, note.trim())
      setEmail('')
      setNote('')
      await refresh()
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : '添加失败')
    } finally {
      setLoading(false)
    }
  }

  const removeEmail = async (targetEmail: string) => {
    setError('')
    try {
      await removeSignupAllowlistEmail(targetEmail)
      await refresh()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '删除失败')
    }
  }

  return (
    <main className="zl-page admin-page">
      <header className="ideas-head">
        <div>
          <h1>账号管理</h1>
          <p>当前开放邮箱注册。白名单功能先保留，后续需要邀请制时可以重新启用。</p>
        </div>
      </header>
      <section className="admin-grid">
        <article className="zl-card admin-card">
          <h3>预留白名单</h3>
          <label>
            邮箱
            <input value={email} placeholder="name@example.com" type="email" onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            备注
            <input value={note} placeholder="例如：外包剪辑 / 合作同事" onChange={(event) => setNote(event.target.value)} />
          </label>
          {error && <p className="inline-error">{error}</p>}
          <button className="zl-btn primary" type="button" disabled={loading || !email.trim()} onClick={addEmail}>
            <Plus size={14} />
            添加邮箱
          </button>
        </article>
        <article className="zl-card admin-card">
          <h3>注册规则</h3>
          <div className="admin-rule-list">
            <p>
              <b>当前策略</b>
              任意邮箱可注册
            </p>
            <p>
              <b>管理员</b>
              loy27felix@gmail.com
            </p>
            <p>
              <b>白名单</b>
              预留给以后收紧注册
            </p>
          </div>
        </article>
      </section>
      <section className="zl-card allowlist-card">
        <header>
          <h3>预留邮箱名单</h3>
          <button className="zl-btn ghost sm" type="button" onClick={() => refresh()}>
            刷新
          </button>
        </header>
        <div className="allowlist-table">
          {entries.map((entry) => (
            <div key={entry.email}>
              <span>{entry.email}</span>
              <small>{entry.note || '无备注'}</small>
              <button className="zl-btn ghost sm" type="button" onClick={() => removeEmail(entry.email)}>
                删除
              </button>
            </div>
          ))}
          {!entries.length && <p className="muted">暂无预留邮箱。当前所有邮箱都可以注册。</p>}
        </div>
      </section>
    </main>
  )
}

function IdeaComposer({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (draft: { title: string; desc: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const canSubmit = title.trim().length > 0

  return (
    <div className="composer-backdrop" role="dialog" aria-modal="true">
      <form
        className="composer-drawer"
        onSubmit={(event) => {
          event.preventDefault()
          if (!canSubmit) return
          onCreate({ title: title.trim(), desc: desc.trim() || '这个点子还没有详细说明，可以在评论区继续补充。' })
        }}
      >
        <header>
          <div>
            <p className="overline">NEW IDEA</p>
            <h2>发布一个点子</h2>
          </div>
          <button className="zl-icon-btn" type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <label>
          点子标题
          <input value={title} placeholder="例如：把全公司同事的梦做成 AI 短片" onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          说明
          <textarea value={desc} placeholder="这个想法适合什么视频？为什么值得做？" onChange={(event) => setDesc(event.target.value)} />
        </label>
        <button className="zl-btn primary composer-submit" type="submit" disabled={!canSubmit}>
          <Plus size={14} />
          发布点子
        </button>
      </form>
    </div>
  )
}

function toContentItem(item: ApiContentItem, index: number): ContentItem {
  const platformName = platformDefs.find((platform) => platform.api === item.platform || platform.id === item.platform)?.name ?? item.platform
  return {
    id: item.id ? `api:${item.id}:${index}` : `api:${item.platform}:${item.url}:${index}`,
    platform: item.platform,
    platformName,
    title: item.title,
    creator: item.creatorName || '来源待识别',
    views: formatCount(item.viewCount) || '待抓取',
    likes: formatCount(item.likeCount) || '-',
    comments: formatCount(item.commentCount) || '-',
    time: formatRelativeTime(item.publishedAt) || '待抓取',
    duration: formatDuration(item.duration) || '--:--',
    trend: item.dataSource === 'youtube-api' ? '官方数据' : item.briefModel === 'deepseek' ? 'AI 分析' : '新发现',
    hue: item.platform === 'tiktok' ? 350 : 218,
    url: item.url,
    thumbnailUrl: item.thumbnailUrl,
    language: item.language ?? detectLanguage(`${item.title} ${item.description ?? ''}`),
    contentType: item.contentType ?? 'animation',
    topicTags: item.topicTags?.length ? item.topicTags : ['ai story'],
    aiSignals: item.aiSignals ?? [],
    negativeSignals: item.negativeSignals ?? [],
    relevanceScore: item.relevanceScore ?? 50,
    freshnessScore: item.freshnessScore ?? 50,
    trendScore: item.trendScore ?? 50,
    aiConfidence: item.aiConfidence ?? 50,
    opportunityScore: item.opportunityScore ?? 50,
    passesAiStoryGate: item.passesAiStoryGate ?? true,
    rankReason: item.rankReason ?? 'AI 相关结果，等待更深数据验证',
    brief: {
      summary: item.aiBrief?.summary || item.description || 'TinyFish Search 已返回相关页面，可继续 Fetch 正文做深度分析。',
      hook: item.aiBrief?.hook || '搜索结果和标题已能作为初步选题判断，下一步会补充正文和视频元数据。',
      learn: item.aiBrief?.learn || item.aiBrief?.takeaway || '适合作为市场反查入口，继续沉淀到点子市场。',
      risk: item.aiBrief?.risk || '当前仍基于搜索片段，需要正文、视频数据或评论样本进一步验证。',
    },
  }
}

function buildLocalRadarInsight(results: ContentItem[]): NonNullable<RadarState['insight']> {
  const topicCount = new Map<string, number>()
  const platformCount = new Map<string, number>()
  const languageCount = new Map<string, number>()
  results.forEach((item) => {
    platformCount.set(item.platform, (platformCount.get(item.platform) ?? 0) + 1)
    languageCount.set(item.language, (languageCount.get(item.language) ?? 0) + 1)
    item.topicTags.forEach((tag) => topicCount.set(tag, (topicCount.get(tag) ?? 0) + 1))
  })
  const topTopics = Array.from(topicCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([topic]) => topic)
  const avgOpportunity = results.length ? Math.round(results.reduce((sum, item) => sum + item.opportunityScore, 0) / results.length) : 0
  return {
    summary: results.length
      ? `当前结果优先保留带有 AI 制作信号的动画/短剧/故事内容，主要题材集中在 ${topTopics.join('、') || 'AI story'}。`
      : '还没有搜索结果。点击情报刷新后，会先做中英文扩展，再用 AI 内容门槛过滤。',
    topTopics,
    platforms: Object.fromEntries(platformCount),
    languages: Object.fromEntries(languageCount),
    avgOpportunity,
    strictGate: ['AI/generative signal', 'story/video/animation signal'],
  }
}

function detectLanguage(text: string): 'zh' | 'en' | 'unknown' {
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh'
  if (/[a-z]/i.test(text)) return 'en'
  return 'unknown'
}

function formatCount(value?: number): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  if (value >= 100000000) return `${(value / 100000000).toFixed(1)}亿`
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return new Intl.NumberFormat('zh-CN').format(value)
}

function formatRelativeTime(value?: string): string {
  if (!value) return ''
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return ''
  const diff = Date.now() - timestamp
  const day = 24 * 60 * 60 * 1000
  if (diff < day) return '今天'
  const days = Math.floor(diff / day)
  if (days < 30) return `${days} 天前`
  if (days < 365) return `${Math.floor(days / 30)} 个月前`
  return `${Math.floor(days / 365)} 年前`
}

function formatDuration(value?: string): string {
  if (!value) return ''
  const match = value.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return value
  const hours = Number(match[1] || 0)
  const minutes = Number(match[2] || 0)
  const seconds = Number(match[3] || 0)
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function EntryCard({
  label,
  title,
  desc,
  meta,
  accent,
  icon,
  onClick,
}: {
  label: string
  title: string
  desc: string
  meta: string
  accent: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button className={`entry-card ${accent}`} type="button" onClick={onClick}>
      <div className="entry-visual">
        <span>{icon}</span>
      </div>
      <div className="entry-body">
        <div>
          <span className="module-label">{label}</span>
          <small>{meta}</small>
        </div>
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
      <footer>
        <span>打开</span>
        <ArrowRight size={13} />
      </footer>
    </button>
  )
}

function StatusCard({ title, value, detail, icon }: { title: string; value: string; detail: string; icon: ReactNode }) {
  return (
    <article className="zl-card status-card">
      <span>{icon}</span>
      <div>
        <small>{title}</small>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  )
}

function FilterBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="filter-block">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      className={on ? 'toggle is-on' : 'toggle'}
      type="button"
      aria-pressed={on}
      onClick={(event) => {
        event.preventDefault()
        onClick()
      }}
    >
      <span />
    </button>
  )
}

function ResultCard({ result, expanded, onToggle }: { result: ContentItem; expanded: boolean; onToggle: () => void }) {
  return (
    <article className="zl-card hoverable result-card">
      <div className={result.thumbnailUrl ? 'thumb has-image' : 'thumb'} style={{ '--thumb-hue': result.hue } as React.CSSProperties}>
        {result.thumbnailUrl && <img src={result.thumbnailUrl} alt="" loading="lazy" />}
        <Play size={18} />
        <span>{result.duration}</span>
      </div>
      <div className="result-main">
        <div className="result-meta">
          <span className={`zl-pf ${result.platform}`}>
            <span className="blob" />
            {result.platformName}
          </span>
          <span>{result.creator}</span>
          <span>· {result.time}</span>
          <b>
            <TrendingUp size={11} />
            机会 {result.opportunityScore}
          </b>
        </div>
        <h3>{result.title}</h3>
        <div className="result-signal-row">
          <span className={result.passesAiStoryGate ? 'signal-pill strong' : 'signal-pill weak'}>{result.passesAiStoryGate ? 'AI 内容确认' : 'AI 信号偏弱'}</span>
          <span className="signal-pill">{result.language === 'zh' ? '中文' : result.language === 'en' ? '英文' : '未知语言'}</span>
          <span className="signal-pill">{result.contentType}</span>
          {result.topicTags.slice(0, 3).map((tag) => (
            <span className="signal-pill muted" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <div className="result-stats">
          <span>
            <Play size={11} />
            <b>{result.views}</b> 播放
          </span>
          <span>
            <Heart size={12} />
            {result.likes}
          </span>
          <span>
            <MessageCircle size={12} />
            {result.comments}
          </span>
          <span className="spacer" />
          <a className="zl-icon-btn" href={result.url} target="_blank" rel="noreferrer" aria-label="打开原链接">
            <ArrowUpRight size={14} />
          </a>
          <button className="zl-icon-btn" type="button" aria-label="收藏">
            <Bookmark size={14} />
          </button>
          <button className="zl-icon-btn" type="button" aria-label="复制链接">
            <Link size={14} />
          </button>
          <button className="zl-btn sm" type="button" onClick={onToggle}>
            <Sparkles size={12} />
            AI 简介
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>
        <div className="score-lanes">
          <ScoreLane label="相关" value={result.relevanceScore} />
          <ScoreLane label="AI" value={result.aiConfidence} />
          <ScoreLane label="热度" value={result.trendScore} />
          <ScoreLane label="新鲜" value={result.freshnessScore} />
        </div>
        <div className={expanded ? 'ai-brief is-open' : 'ai-brief'}>
          <div>
            <BriefField tone={218} label="摘要" text={result.brief.summary} icon={<Sparkles size={12} />} />
            <BriefField tone={18} label="爆点" text={result.brief.hook} icon={<Flame size={12} />} />
            <BriefField tone={78} label="借鉴" text={result.brief.learn} icon={<Lightbulb size={12} />} />
            <BriefField tone={355} label="风险" text={result.brief.risk} icon={<Sparkles size={12} />} />
            <BriefField tone={260} label="排序理由" text={result.rankReason} icon={<Radar size={12} />} />
          </div>
        </div>
      </div>
    </article>
  )
}

function ScoreLane({ label, value }: { label: string; value: number }) {
  return (
    <span className="score-lane">
      <small>{label}</small>
      <i>
        <b style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </i>
      <em>{value}</em>
    </span>
  )
}

function BriefField({ tone, label, text, icon }: { tone: number; label: string; text: string; icon: ReactNode }) {
  return (
    <section className="brief-field" style={{ '--tone': tone } as React.CSSProperties}>
      <h4>
        {icon}
        {label}
      </h4>
      <p>{text}</p>
    </section>
  )
}

function ResultSkeleton() {
  return (
    <div className="zl-card result-card">
      <div className="zl-skel skeleton-thumb" />
      <div className="skeleton-lines">
        <div className="zl-skel" />
        <div className="zl-skel" />
        <div className="zl-skel" />
      </div>
    </div>
  )
}

function DailySection({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string
  subtitle: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="daily-section">
      <button type="button" onClick={onToggle}>
        <strong>{title}</strong>
        <small>{subtitle}</small>
        <span className="spacer" />
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      <div className={open ? 'daily-section-body is-open' : 'daily-section-body'}>{children}</div>
    </section>
  )
}

function IdeaCard({
  idea,
  user,
  liked,
  saved,
  expanded,
  onLike,
  onSave,
  onToggle,
  onOpenRadar,
}: {
  idea: Idea
  user: User
  liked: boolean
  saved: boolean
  expanded: boolean
  onLike: () => void
  onSave: () => void
  onToggle: () => void
  onOpenRadar: (query: string) => void
}) {
  const [comments, setComments] = useState<IdeaComment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [status, setStatus] = useState(idea.status)

  useEffect(() => {
    if (!expanded || comments.length) return
    let cancelled = false
    async function loadComments() {
      try {
        const nextComments = await listIdeaComments(idea.id)
        if (!cancelled) setComments(nextComments)
      } catch {
        if (!cancelled) setComments([])
      }
    }
    loadComments()
    return () => {
      cancelled = true
    }
  }, [comments.length, expanded, idea.id])

  const submitComment = async () => {
    const body = commentText.trim()
    if (!body) return
    setCommentLoading(true)
    try {
      const comment = await addIdeaComment(idea.id, body, user)
      setComments((current) => [...current, comment])
      setCommentText('')
    } finally {
      setCommentLoading(false)
    }
  }

  const changeStatus = async (nextStatus: Idea['status']) => {
    const previous = status
    setStatus(nextStatus)
    try {
      await updateIdeaStatus(idea.id, nextStatus)
    } catch {
      setStatus(previous)
    }
  }

  return (
    <article className="zl-card hoverable idea-card">
      {idea.hot && (
        <span className="hot-badge">
          <Flame size={11} />
          本周热门
        </span>
      )}
      <header>
        <span className="idea-avatar">{idea.avatar}</span>
        <span>{idea.author}</span>
        <b className={`status ${status}`}>· {ideaStatusLabel(status)}</b>
      </header>
      <h3>{idea.title}</h3>
      <p>{idea.desc}</p>
      <div className="tag-row">
        {idea.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <footer>
        <button className={liked ? 'liked' : ''} type="button" onClick={onLike}>
          <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
          {idea.likes + (liked ? 1 : 0)}
        </button>
        <button type="button">
          <MessageCircle size={13} />
          {idea.comments}
        </button>
        <button className={saved ? 'liked' : ''} type="button" onClick={onSave}>
          <Bookmark size={13} fill={saved ? 'currentColor' : 'none'} />
          {idea.saves + (saved ? 1 : 0)}
        </button>
        <span className="spacer" />
        <button className="zl-btn sm" type="button" onClick={onToggle}>
          <Radar size={13} />
          市场反查
        </button>
      </footer>
      {idea.market && (
        <div className={expanded ? 'market-check is-open' : 'market-check'}>
          <div>
            <header>
              <strong>市场反查结果</strong>
              <button className="zl-btn ghost sm" type="button" onClick={() => onOpenRadar(idea.title)}>
                去内容雷达
                <ArrowRight size={12} />
              </button>
            </header>
            <div className="market-stats">
              <MarketStat label="相关内容" value={String(idea.market.count)} unit="条" />
              <MarketStat label="最高播放" value={idea.market.top} />
              <MarketStat label="机会评估" value={idea.market.chance} highlight={idea.market.chance === '高'} />
            </div>
            <div className="idea-detail-tools">
              <label>
                状态
                <select value={status} onChange={(event) => changeStatus(event.target.value as Idea['status'])}>
                  <option value="open">开放中</option>
                  <option value="claimed">已认领</option>
                  <option value="producing">制作中</option>
                  <option value="published">已发布</option>
                </select>
              </label>
              <button className="zl-btn ghost sm" type="button" onClick={() => onOpenRadar(idea.title)}>
                一键市场反查
              </button>
            </div>
            <div className="idea-comments">
              <strong>评论</strong>
              <div className="idea-comment-list">
                {comments.length ? (
                  comments.map((comment) => (
                    <p key={comment.id}>
                      <b>{comment.authorName}</b>
                      {comment.body}
                    </p>
                  ))
                ) : (
                  <p className="muted">还没有评论，先补一句制作建议。</p>
                )}
              </div>
              <div className="idea-comment-box">
                <input value={commentText} placeholder="补充建议、认领说明或参考链接" onChange={(event) => setCommentText(event.target.value)} />
                <button className="zl-btn sm" type="button" disabled={commentLoading || !commentText.trim()} onClick={submitComment}>
                  发送
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

function MarketStat({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div>
      <small>{label}</small>
      <strong className={highlight ? 'highlight' : ''}>
        {value}
        {unit && <span>{unit}</span>}
      </strong>
    </div>
  )
}

function ideaStatusLabel(status: Idea['status']): string {
  return {
    open: '开放中',
    claimed: '已认领',
    producing: '制作中',
    published: '已发布',
  }[status]
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {subtitle && <span>{subtitle}</span>}
    </div>
  )
}

function Stat({ n, k }: { n: string; k: string }) {
  return (
    <div className="stat">
      <strong>{n}</strong>
      <small>{k}</small>
    </div>
  )
}

function FileIcon() {
  return <Newspaper size={18} />
}

export default App



