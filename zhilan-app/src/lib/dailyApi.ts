import { isSupabaseConfigured, supabase } from './supabase'

const scraperUrl = import.meta.env.VITE_LOCAL_SCRAPER_URL ?? 'http://127.0.0.1:8787'

export type DailySummary = {
  highlights?: string[] | string
  child_content_relevance?: string
  idea_seeds?: string[] | string
  tool_opportunities?: string[] | string
  editor_note?: string
}

export type DailyIssueRecord = {
  id?: string
  issueNumber?: number
  title: string
  date: string
  contentMarkdown: string
  url: string
  source: string
  summary?: DailySummary
  tags?: string[]
}

type DailyRow = {
  id: string
  issue_number: number
  title: string
  issue_date: string
  content_markdown: string
  url: string
  source: string
  summary?: DailySummary | null
  relevance_tags?: string[] | null
}

export async function listDailyIssues(limit = 10): Promise<DailyIssueRecord[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('ai_daily_issues')
      .select('id,issue_number,title,issue_date,content_markdown,url,source,summary,relevance_tags')
      .order('issue_date', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data ?? []).map(fromDailyRow)
  }

  const latest = await fetchLatestDaily()
  return latest ? [latest] : []
}

export async function fetchLatestDaily(): Promise<DailyIssueRecord | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('ai_daily_issues')
      .select('id,issue_number,title,issue_date,content_markdown,url,source,summary,relevance_tags')
      .order('issue_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data) return fromDailyRow(data as DailyRow)
  }

  const response = await fetch(`${scraperUrl}/api/daily/latest`)
  if (!response.ok) throw new Error(`日报读取失败：${response.status}`)
  const body = await response.json()
  return {
    issueNumber: body.issueNumber,
    title: body.title,
    date: body.date,
    contentMarkdown: body.contentMarkdown,
    url: body.url,
    source: body.source,
  }
}

function fromDailyRow(row: DailyRow): DailyIssueRecord {
  return {
    id: row.id,
    issueNumber: row.issue_number,
    title: row.title,
    date: row.issue_date,
    contentMarkdown: row.content_markdown,
    url: row.url,
    source: row.source,
    summary: row.summary ?? undefined,
    tags: row.relevance_tags ?? undefined,
  }
}
