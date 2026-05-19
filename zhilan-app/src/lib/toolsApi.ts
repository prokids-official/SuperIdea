const scraperUrl = import.meta.env.VITE_LOCAL_SCRAPER_URL ?? 'http://127.0.0.1:8787'

export type SlidesStyle = 'bold-signal' | 'electric-studio' | 'notebook-tabs' | 'swiss-modern' | 'paper-ink' | 'neon-cyber'

export type FrontendSlidesRequest = {
  topic: string
  outline: string
  style: SlidesStyle
  audience: string
  slideCount: number
}

export type FrontendSlidesResponse = {
  title: string
  subtitle?: string
  style: string
  slideCount: number
  html: string
  localPath: string
  createdAt: string
}

export type FollowBuildersRequest = {
  cadence: 'daily' | 'weekly'
  language: 'zh' | 'en' | 'bilingual'
  focus: string
  limitBuilders: number
}

export type BuilderHighlight = {
  title: string
  why_it_matters?: string
  whyItMatters?: string
  url: string
  source?: string
  tags?: string[]
}

export type FollowBuildersResponse = {
  title: string
  summary: string
  highlights: BuilderHighlight[]
  signals?: unknown[]
  actions?: unknown[]
  cadence: 'daily' | 'weekly'
  generatedAt: string
  feedGeneratedAt?: string
  stats?: {
    builders: number
    items: number
    podcasts: number
    blogs: number
  }
}

export async function generateFrontendSlides(request: FrontendSlidesRequest): Promise<FrontendSlidesResponse> {
  const response = await fetch(`${scraperUrl}/api/tools/frontend-slides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (response.status === 404) return generateFrontendSlidesFallback(request)
  if (!response.ok) throw new Error(readableToolError('PPT 生成失败', response.status))
  return normalizeSlidesResponse(await response.json(), request)
}

export async function buildFollowBuildersDigest(request: FollowBuildersRequest): Promise<FollowBuildersResponse> {
  const response = await fetch(`${scraperUrl}/api/tools/follow-builders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (response.status === 404) return buildFollowBuildersFallback(request)
  if (!response.ok) throw new Error(readableToolError('Builders 摘要生成失败', response.status))
  return normalizeBuildersResponse(await response.json(), request)
}

function readableToolError(prefix: string, status: number) {
  if (status === 404) return `${prefix}: 本地采集服务还没重启到最新版`
  return `${prefix}: ${status}`
}

function normalizeSlidesResponse(value: unknown, request: FrontendSlidesRequest): FrontendSlidesResponse {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const html = String(raw.html || '')
  if (!html) return generateFrontendSlidesFallback(request)
  return {
    title: String(raw.title || request.topic),
    subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
    style: String(raw.style || request.style),
    slideCount: Number(raw.slideCount || request.slideCount),
    html,
    localPath: String(raw.localPath || ''),
    createdAt: String(raw.createdAt || new Date().toISOString()),
  }
}

function normalizeBuildersResponse(value: unknown, request: FollowBuildersRequest): FollowBuildersResponse {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const highlights = Array.isArray(raw.highlights)
    ? raw.highlights
        .map((item) => normalizeBuilderHighlight(item))
        .filter((item): item is BuilderHighlight => Boolean(item?.title && item.url))
    : []

  return {
    title: String(raw.title || (request.cadence === 'daily' ? 'AI Builders 今日观察' : 'AI Builders 本周观察')),
    summary: String(raw.summary || '已完成 follow-builders 摘要整理。'),
    highlights,
    signals: Array.isArray(raw.signals) ? raw.signals : [],
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    cadence: request.cadence,
    generatedAt: String(raw.generatedAt || new Date().toISOString()),
    feedGeneratedAt: raw.feedGeneratedAt ? String(raw.feedGeneratedAt) : undefined,
    stats:
      raw.stats && typeof raw.stats === 'object'
        ? {
            builders: Number((raw.stats as Record<string, unknown>).builders || 0),
            items: Number((raw.stats as Record<string, unknown>).items || highlights.length),
            podcasts: Number((raw.stats as Record<string, unknown>).podcasts || 0),
            blogs: Number((raw.stats as Record<string, unknown>).blogs || 0),
          }
        : { builders: 0, items: highlights.length, podcasts: 0, blogs: 0 },
  }
}

function normalizeBuilderHighlight(value: unknown): BuilderHighlight | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  return {
    title: String(raw.title || ''),
    why_it_matters: String(raw.why_it_matters || raw.whyItMatters || raw.summary || ''),
    url: String(raw.url || ''),
    source: raw.source ? String(raw.source) : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
  }
}

function generateFrontendSlidesFallback(request: FrontendSlidesRequest): FrontendSlidesResponse {
  const points = request.outline
    .split('\n')
    .map((line) => line.replace(/^[-#\d.\s]+/, '').trim())
    .filter(Boolean)
  const slides = [request.topic, ...points].slice(0, Math.max(4, request.slideCount))
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(request.topic)}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;scroll-snap-type:y mandatory;background:#0b1020;color:#f7fbff;font-family:ui-sans-serif,system-ui,sans-serif}
.slide{height:100vh;height:100dvh;overflow:hidden;scroll-snap-align:start;display:grid;place-items:center;padding:clamp(24px,6vw,88px);position:relative;background:radial-gradient(circle at 78% 22%,rgba(94,169,255,.42),transparent 28%),linear-gradient(135deg,#0b1020,#101a34)}
.slide:before{content:"";position:absolute;inset:8%;border:1px solid rgba(255,255,255,.1);border-radius:36px}
.inner{position:relative;z-index:1;max-width:min(980px,90vw);display:grid;gap:24px}.kicker{color:#78d7ff;font-weight:800;letter-spacing:.18em}.title{font-size:clamp(42px,8vw,102px);line-height:.94;letter-spacing:-.06em;margin:0}
p,li{font-size:clamp(18px,2vw,28px);line-height:1.55;color:#c7d7ea}ul{display:grid;gap:14px;padding:0;list-style:none}li{padding:16px 18px;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:rgba(255,255,255,.06)}
.progress{position:fixed;right:24px;top:20px;color:#8ea9c4;font-weight:700;z-index:10}@media(prefers-reduced-motion:no-preference){.inner{animation:rise .7s ease both}@keyframes rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}}
</style></head><body>${slides
    .map((slide, index) => {
      const related = points.slice(index, index + 4)
      return `<section class="slide"><div class="inner"><div class="kicker">${String(index + 1).padStart(2, '0')} / ${slides.length}</div><h1 class="title">${escapeHtml(slide)}</h1>${
        index === 0
          ? `<p>${escapeHtml(request.audience)} · ${escapeHtml(request.style)}</p>`
          : `<ul>${related.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>`
      }</div></section>`
    })
    .join('')}<div class="progress">↑↓ 切换</div></body></html>`
  return {
    title: request.topic,
    subtitle: '浏览器备用生成版本',
    style: `${request.style} · fallback`,
    slideCount: slides.length,
    html,
    localPath: '',
    createdAt: new Date().toISOString(),
  }
}

async function buildFollowBuildersFallback(request: FollowBuildersRequest): Promise<FollowBuildersResponse> {
  const response = await fetch('https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json')
  if (!response.ok) throw new Error(`Builders feed 读取失败: ${response.status}`)
  const feed = await response.json()
  const builders = Array.isArray(feed.x) ? feed.x : []
  const highlights = builders
    .slice(0, request.limitBuilders)
    .flatMap((builder: Record<string, unknown>) => {
      const tweets = Array.isArray(builder.tweets) ? tweetsFromUnknown(builder.tweets) : []
      return tweets.slice(0, 1).map((tweet) => ({
        title: compact(String(tweet.text || ''), 88),
        why_it_matters: compact(String(tweet.text || ''), 180),
        url: String(tweet.url || ''),
        source: String(builder.name || builder.handle || 'Builder'),
        tags: ['follow-builders', 'fallback'],
      }))
    })
    .filter((item: BuilderHighlight) => item.title && item.url)

  return {
    title: request.cadence === 'daily' ? 'AI Builders 今日观察' : 'AI Builders 本周观察',
    summary: `本次使用浏览器备用链路读取 follow-builders 公开 feed。重启本地采集服务后，会自动切换到 DeepSeek 精编版本。关注重点：${request.focus}`,
    highlights,
    signals: ['AI builders 的公开动态会持续沉淀成产品、agent 工作流和开发者工具信号。'],
    actions: ['先挑 1 条和内容生产效率相关的动态，转成内部小工具或选题实验。'],
    cadence: request.cadence,
    generatedAt: new Date().toISOString(),
    feedGeneratedAt: feed.generatedAt,
    stats: {
      builders: builders.length,
      items: highlights.length,
      podcasts: 0,
      blogs: 0,
    },
  }
}

function tweetsFromUnknown(value: unknown[]): Array<Record<string, unknown>> {
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
}

function compact(value: string, limit: number) {
  const next = value.replace(/\s+/g, ' ').trim()
  return next.length > limit ? `${next.slice(0, limit - 1)}…` : next
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char)
}
