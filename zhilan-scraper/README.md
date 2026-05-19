# Zhilan Scraper / 本地采集服务

Local FastAPI service for Zhilan Idea King. It runs on the user's computer and handles data collection tasks that should not run directly in the public frontend.

这是芝兰点子王的本地 FastAPI 采集服务。它运行在使用者自己的电脑上，用来处理不适合直接放到公开前端里的数据采集任务。

## Role / 作用

- Provide a local HTTP API for the frontend during development.
- Use private API keys safely on the local machine.
- Fetch and normalize content search results.
- Generate AI briefs with DeepSeek when configured.
- Sync AI Daily issues into Supabase.
- Optionally run as a Supabase worker: Vercel frontend creates jobs, local worker fills results.

## Default URL

```text
http://127.0.0.1:8787
```

## Current Data Sources

- YouTube Data API v3
- Bilibili web search
- TinyFish Search / Fetch
- Tavily Search
- GitHub Issues: `imjuya/juya-ai-daily`
- DeepSeek for summaries and briefs
- Public `zarazhangrui/follow-builders` feed

## Endpoints

```text
GET  /api/health
POST /api/search
POST /api/fetch
GET  /api/daily/latest
POST /api/tools/frontend-slides
POST /api/tools/follow-builders
```

## Generated HTML Slides

The `frontend-slides` endpoint returns HTML to the frontend and also saves generated decks locally:

```text
data/tool_outputs/slides/
```

This folder is ignored by Git because generated decks may contain internal topics.

## Setup

```powershell
cd D:\SuperIdea\zhilan-scraper
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
copy .env.example .env
```

Fill `.env` with local keys, then start the service:

```powershell
.\.venv\Scripts\python -B -m uvicorn zhilan_scraper.app:app --host 127.0.0.1 --port 8787
```

## AI Daily Sync

Manual sync:

```powershell
.\sync-daily.ps1
```

Install daily Windows scheduled task:

```powershell
.\install-daily-task.ps1
```

This registers `Zhilan AI Daily Sync`, which runs every day at 10:00 local time.

Remove the task:

```powershell
.\uninstall-daily-task.ps1
```

## Supabase Worker Mode

Keep the local scraper API running, then start:

```powershell
python -B -m zhilan_scraper.supabase_worker
```

Run one queued job only:

```powershell
python -B -m zhilan_scraper.supabase_worker --once
```

The worker needs `SUPABASE_SERVICE_ROLE_KEY`. Never expose this key in frontend code or public documentation.
