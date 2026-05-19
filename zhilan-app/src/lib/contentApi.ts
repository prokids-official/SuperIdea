import { isSupabaseConfigured, supabase } from './supabase'

const scraperUrl = import.meta.env.VITE_LOCAL_SCRAPER_URL ?? 'http://127.0.0.1:8787'
const searchMode = import.meta.env.VITE_SEARCH_MODE ?? 'local'

export type ContentSearchRequest = {
  query: string
  platforms: string[]
  sort: string
  timeRange: string
  limit: number
  includeAiBrief: boolean
  fetchTop: number
  aiBriefTop: number
  briefMode: 'auto' | 'flash' | 'pro'
}

export type ContentSearchResponse = {
  query: string
  items: unknown[]
  elapsedMs?: number
  sourceStatus?: Record<string, string>
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
}

type SearchJobRow = {
  id: string
  status: 'queued' | 'processing' | 'done' | 'failed'
  error?: string | null
  elapsed_ms?: number | null
  source_status?: Record<string, string> | null
}

type SearchResultRow = {
  id: string
  rank: number
  platform: string
  title: string
  url: string
  description?: string | null
  creator_name?: string | null
  view_count?: number | null
  like_count?: number | null
  comment_count?: number | null
  published_at?: string | null
  duration?: string | null
  data_source?: string | null
  brief_model?: string | null
  ai_brief?: Record<string, unknown> | null
  raw?: Record<string, unknown> | null
}

export async function searchContent(request: ContentSearchRequest): Promise<ContentSearchResponse> {
  if (searchMode === 'supabase_queue' && isSupabaseConfigured && supabase) {
    return searchViaSupabaseQueue(request)
  }

  const response = await fetch(`${scraperUrl}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
  if (!response.ok) throw new Error(`搜索失败：${response.status}`)
  return response.json()
}

async function searchViaSupabaseQueue(request: ContentSearchRequest): Promise<ContentSearchResponse> {
  if (!supabase) throw new Error('Supabase 未配置')

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('请先登录后再搜索')

  const { data: job, error: createError } = await supabase
    .from('content_search_jobs')
    .insert({
      user_id: userData.user.id,
      query: request.query,
      platforms: request.platforms,
      sort: request.sort,
      time_range: request.timeRange,
      limit_count: request.limit,
      include_ai_brief: request.includeAiBrief,
      fetch_top: request.fetchTop,
      ai_brief_top: request.aiBriefTop,
      brief_mode: request.briefMode,
    })
    .select('id,status,error,elapsed_ms,source_status')
    .single()

  if (createError || !job) throw new Error(createError?.message || '搜索任务创建失败')

  const finishedJob = await waitForJob(job as SearchJobRow)
  if (finishedJob.status === 'failed') throw new Error(finishedJob.error || '本地采集任务失败')

  const { data: results, error: resultError } = await supabase
    .from('content_search_results')
    .select('*')
    .eq('job_id', finishedJob.id)
    .order('rank', { ascending: true })

  if (resultError) throw new Error(resultError.message)

  return {
    query: request.query,
    items: (results ?? []).map(fromSearchResult),
    elapsedMs: finishedJob.elapsed_ms ?? undefined,
    sourceStatus: finishedJob.source_status ?? {},
  }
}

async function waitForJob(initialJob: SearchJobRow): Promise<SearchJobRow> {
  if (!supabase) throw new Error('Supabase 未配置')

  const started = Date.now()
  let job = initialJob
  while (Date.now() - started < 120_000) {
    if (job.status === 'done' || job.status === 'failed') return job
    await sleep(1500)

    const { data, error } = await supabase
      .from('content_search_jobs')
      .select('id,status,error,elapsed_ms,source_status')
      .eq('id', job.id)
      .single()

    if (error || !data) throw new Error(error?.message || '搜索任务读取失败')
    job = data as SearchJobRow
  }

  throw new Error('搜索任务还在排队，请确认本地采集 worker 正在运行')
}

function fromSearchResult(row: SearchResultRow) {
  return {
    ...(row.raw ?? {}),
    id: row.id,
    platform: row.platform,
    title: row.title,
    url: row.url,
    description: row.description ?? undefined,
    creatorName: row.creator_name ?? undefined,
    viewCount: row.view_count ?? undefined,
    likeCount: row.like_count ?? undefined,
    commentCount: row.comment_count ?? undefined,
    publishedAt: row.published_at ?? undefined,
    duration: row.duration ?? undefined,
    dataSource: row.data_source ?? undefined,
    briefModel: row.brief_model ?? undefined,
    aiBrief: row.ai_brief ?? undefined,
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
