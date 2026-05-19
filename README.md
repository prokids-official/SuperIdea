# Zhilan Idea King / 芝兰点子王

> Internal inspiration, market research, AI daily brief, and workflow tools for a creative content team.
>
> 面向内容团队的内部灵感工作台：内容雷达、AI 日报、点子市场和 AI 小工具集合。

## English

### What Is This?

Zhilan Idea King is a web-based internal tool originally designed for the Beva / Zhilan content team. It helps teammates research cross-platform content trends, read a productized AI daily brief, submit and discuss video ideas, and run small AI workflow tools from one place.

The product is currently optimized for a small internal team. It is built as a Vite + React frontend deployed on Vercel, with Supabase for auth/database, and a local Python scraper service for data collection tasks that need private API keys or local browser/cookie access.

### Current Status

This is an active work-in-progress MVP. The main product frame is already usable, but some platform data integrations still need hardening.

Implemented:

- Public landing/login page with protected internal workspace.
- Email/password login through Supabase Auth.
- Admin-aware account model, including an admin email and `@beva.com` registration policy support.
- Main navigation: Workspace, Content Radar, AI Daily, Idea Market, AI Tools.
- Content Radar UI with platform filters, sorting controls, persistent search progress, and a radar-style animated status panel.
- Local content search API with YouTube Data API, Bilibili web search, TinyFish, Tavily, and DeepSeek-based AI briefs.
- Supabase search queue schema for Vercel-hosted frontend + local worker mode.
- AI Daily page backed by `imjuya/juya-ai-daily` GitHub Issues, with productized summary, overview table, body cards, and daily local sync script.
- Idea Market with Supabase-backed ideas, reactions, comments, statuses, and admin allowlist support.
- AI Tools section with independent tool workbench layout.
- `frontend-slides` integration: generate self-contained HTML slide decks from a topic and outline.
- `follow-builders` integration: read the public `zarazhangrui/follow-builders` feed and generate a daily/weekly builder digest.
- Dark/light theme support and interactive UI details.

Partially implemented / needs more work:

- Deep Douyin/TikTok/Bilibili scraping with reliable login/cookie state.
- Browser-controlled page exploration for platforms that block anonymous access.
- More robust progress tracking for long-running local jobs.
- Tool history and shared output storage for generated slide decks and digests.
- More polished frontend design. The current UI is functional but still expected to be redesigned.
- Production-grade observability and error reporting.
- Deployment automation and safer environment management.

### Architecture

```text
D:\SuperIdea
├─ zhilan-app/          # Vite + React + TypeScript frontend
├─ zhilan-scraper/      # Local FastAPI data/scraper service
├─ supabase/            # Database migrations for Auth-related tables and app data
└─ README.md            # This file
```

Frontend:

- React 19
- TypeScript
- Vite
- Supabase JS client
- lucide-react icons
- Deployed on Vercel

Backend/local service:

- Python
- FastAPI
- httpx
- dotenv
- Runs locally at `http://127.0.0.1:8787`

Database/auth:

- Supabase Auth for email/password login.
- Supabase Postgres for profiles, ideas, comments, reactions, search jobs/results, AI daily archive, and signup allowlist.
- Row Level Security policies are defined in the migration files.

### What Supabase Is Used For

Supabase is still important. It is not only for login.

Current Supabase responsibilities:

- User authentication and persisted sessions.
- User profiles and admin/member roles.
- Signup allowlist and `@beva.com` registration policy support.
- Idea Market persistence.
- Idea comments, likes/saves, and status updates.
- AI Daily archive table.
- Content Radar queue mode, where the Vercel frontend creates jobs and the local worker fills results.

If you remove Supabase, the app can still run in a limited local-only mode, but login, shared ideas, AI Daily archive, and team-visible results will no longer work as intended.

### Where Generated HTML Slides Are Stored

The `frontend-slides` tool returns the generated HTML to the browser for preview/download. The local scraper also saves generated slide decks here:

```text
zhilan-scraper/data/tool_outputs/slides/
```

This folder is intentionally ignored by Git because generated decks may contain internal topics or private work content.

### Local Development

Start the frontend:

```powershell
cd D:\SuperIdea\zhilan-app
npm install
npm run dev
```

Start the local scraper:

```powershell
cd D:\SuperIdea\zhilan-scraper
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python -B -m uvicorn zhilan_scraper.app:app --host 127.0.0.1 --port 8787
```

Run the frontend build:

```powershell
cd D:\SuperIdea\zhilan-app
npm run build
```

### Environment Variables

Create local environment files, but never commit them.

Frontend example:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_LOCAL_SCRAPER_URL=http://127.0.0.1:8787
VITE_SEARCH_MODE=local
```

Scraper example:

```env
TINYFISH_API_KEY=
TAVILY_API_KEY=
YOUTUBE_API_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_FLASH_MODEL=
DEEPSEEK_PRO_MODEL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LOCAL_SCRAPER_URL=http://127.0.0.1:8787
```

Security note: rotate any API keys that were ever pasted into chat, screenshots, docs, or local files before publishing this repository.

### Open Source Safety Checklist

Before pushing to GitHub:

- Do not commit `.env`, `.env.local`, Supabase service role keys, API keys, cookies, logs, generated slide decks, or local browser data.
- Keep `zhilan-scraper/data/` out of Git.
- Keep `supabase/.temp/` out of Git.
- Review Chinese internal planning documents before publishing. Some may include private company context or credentials.
- Rotate leaked or shared keys.
- Prefer adding `.env.example` files with empty placeholders.

### Roadmap

- Add robust Douyin login-state crawler.
- Add TikTok fallback via TinyFish/browser automation.
- Add Bilibili deeper video detail collection.
- Store generated tool outputs in a shared, permissioned place.
- Add tool run history.
- Improve the landing page and internal dashboard UI.
- Add browser-plugin exploration once the local browser automation plugin is stable.
- Add structured tests for login, AI Daily, AI Tools, and Content Radar.

---

## 中文

### 这是什么？

芝兰点子王是一个给内容团队使用的内部灵感工作台。它把选题调研、AI 日报、点子市场和 AI 小工具放在同一个网页里，目标是减少大家平时找灵感、看趋势、整理资料和做内容判断的成本。

这个项目最初是为贝瓦 / 芝兰内容团队设计的，目前适合小团队内部使用。前端是 Vite + React，部署在 Vercel；账号和共享数据用 Supabase；需要 API key、Cookie 或本地浏览器能力的数据采集由本机 Python 服务完成。

### 当前进度

这是一个正在推进中的 MVP。主体框架和多个核心功能已经可用，但平台深度采集和 UI 细节还在继续打磨。

已经完成：

- 公开介绍页 / 登录页，登录后进入内部工作台。
- Supabase 邮箱密码登录。
- 管理员 / 普通成员模型，支持管理员账号和 `@beva.com` 注册策略。
- 主导航：工作台、内容雷达、AI 日报、点子市场、AI 工具。
- 内容雷达界面：平台筛选、排序、搜索进度保留、动态雷达视图。
- 本地内容搜索 API：YouTube Data API、Bilibili Web Search、TinyFish、Tavily、DeepSeek AI 简介。
- Supabase 搜索队列：适配 Vercel 前端 + 本地 worker 抓取数据的模式。
- AI 日报：从 `imjuya/juya-ai-daily` GitHub Issues 获取，产品化成今日速览、正文卡片和每日同步。
- 点子市场：点子发布、评论、点赞/收藏、状态、管理员邮箱白名单。
- AI 工具页：独立工具工作台布局。
- `frontend-slides` 接入：输入主题和大纲，生成单文件 HTML 风格 PPT。
- `follow-builders` 接入：读取 `zarazhangrui/follow-builders` 公开 feed，生成 AI builders 日报/周报。
- 深色/浅色主题和一些交互动效。

部分完成 / 待继续：

- 抖音、TikTok、Bilibili 的深度采集和登录态维护。
- 用浏览器插件探索无法匿名访问的平台页面。
- 长任务的更完整进度展示和后台任务状态。
- AI 工具生成结果的历史记录和共享存储。
- 更完整、更好看的前端视觉设计。
- 生产级日志、错误追踪和部署自动化。

### 项目结构

```text
D:\SuperIdea
├─ zhilan-app/          # Vite + React + TypeScript 前端
├─ zhilan-scraper/      # 本地 FastAPI 数据采集服务
├─ supabase/            # 数据库迁移文件
└─ README.md            # 当前说明文档
```

前端：

- React 19
- TypeScript
- Vite
- Supabase JS client
- lucide-react icons
- Vercel 部署

本地服务：

- Python
- FastAPI
- httpx
- dotenv
- 默认运行在 `http://127.0.0.1:8787`

数据库 / 登录：

- Supabase Auth 负责邮箱密码登录。
- Supabase Postgres 存用户、点子、评论、互动、搜索任务、AI 日报归档和注册白名单。
- 数据库权限使用 RLS 策略控制。

### Supabase 现在还用来做什么？

Supabase 仍然需要。它不只是登录。

目前 Supabase 负责：

- 登录和刷新后保持 session。
- 用户 profile、管理员 / 成员角色。
- 注册白名单和 `@beva.com` 邮箱策略。
- 点子市场数据。
- 评论、点赞、收藏、状态更新。
- AI 日报历史归档。
- 内容雷达队列模式：Vercel 前端创建搜索任务，本地 worker 写入结果。

如果完全不用 Supabase，网页可以做成本地单机版，但同事之间共享账号、点子、日报归档、搜索结果这些能力都会丢失。

### HTML PPT 存在哪里？

`frontend-slides` 工具会把生成的 HTML 返回给网页用于预览和下载。本地 scraper 也会把文件保存到：

```text
zhilan-scraper/data/tool_outputs/slides/
```

这个目录不会提交到 Git，因为里面可能包含公司内部选题、汇报内容或未公开想法。

### 本地运行

启动前端：

```powershell
cd D:\SuperIdea\zhilan-app
npm install
npm run dev
```

启动本地采集服务：

```powershell
cd D:\SuperIdea\zhilan-scraper
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python -B -m uvicorn zhilan_scraper.app:app --host 127.0.0.1 --port 8787
```

构建前端：

```powershell
cd D:\SuperIdea\zhilan-app
npm run build
```

### 环境变量

本地需要创建环境变量文件，但不要提交。

前端示例：

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_LOCAL_SCRAPER_URL=http://127.0.0.1:8787
VITE_SEARCH_MODE=local
```

采集服务示例：

```env
TINYFISH_API_KEY=
TAVILY_API_KEY=
YOUTUBE_API_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_FLASH_MODEL=
DEEPSEEK_PRO_MODEL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
LOCAL_SCRAPER_URL=http://127.0.0.1:8787
```

安全提醒：任何曾经发到聊天、截图、文档或本地配置里的 API key，在开源前都建议重新生成并废弃旧 key。

### 开源前检查清单

推到 GitHub 前：

- 不要提交 `.env`、`.env.local`、Supabase service role key、API key、Cookie、日志、生成的 PPT、本地浏览器数据。
- 不要提交 `zhilan-scraper/data/`。
- 不要提交 `supabase/.temp/`。
- 根目录的内部方案文档需要先人工检查，里面可能有公司内部信息。
- 重新生成曾经暴露过的 key。
- 只提交 `.env.example` 这种空占位文件。

### 后续计划

- 做稳定的抖音登录态采集脚本。
- 用 TinyFish / 浏览器自动化补 TikTok 兜底采集。
- 做 Bilibili 视频详情深度采集。
- 把 AI 工具生成结果存到一个有权限控制的共享位置。
- 增加工具运行历史。
- 继续重做前端视觉和交互。
- 浏览器插件稳定后，接入页面探索能力。
- 给登录、AI 日报、AI 工具、内容雷达补自动化测试。
