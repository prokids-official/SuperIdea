# SuperIdea / Zhilan Idea King

[English](#english) | [中文](#中文)

**Live app:** [https://zhilan-app.vercel.app/](https://zhilan-app.vercel.app/)

SuperIdea, also called **Zhilan Idea King**, is an internal idea and research workspace for the Beva / Zhilan content team. It brings market research, AI daily news, team ideas, and lightweight AI tools into one shared web app so colleagues can move from inspiration to execution faster.

---

## English

### What This Project Is

SuperIdea is designed for creative content teams that need to follow fast-changing AI/video trends and turn them into usable production ideas.

The app currently focuses on four work areas:

- **Content Radar**: Search across video platforms and web results, then review AI-generated briefs for faster topic research.
- **AI Daily**: Read a productized daily AI briefing based on the latest public `imjuya/juya-ai-daily` GitHub Issues.
- **Idea Market**: Submit video ideas, discuss them with teammates, react to them, and use market search as follow-up research.
- **AI Tools**: Run small workflow tools such as HTML slide generation and builder/news digest generation.

The product is still evolving, but the deployed Vercel version is already usable for internal testing and day-to-day feedback.

### Online Usage

Open:

[https://zhilan-app.vercel.app/](https://zhilan-app.vercel.app/)

Create an account with an email and password, then log in to access the workspace.

For now, registration is intended to be simple and open so teammates can start using the site quickly. Admin-only restrictions and stricter email rules can be reintroduced later when the team is ready.

### Current Status

Implemented:

- Public landing page and protected internal workspace.
- Email/password authentication with Supabase.
- Persistent login session through Supabase Auth.
- Main workspace navigation: Home, Content Radar, AI Daily, Idea Market, AI Tools, Admin.
- Content Radar UI with platform filters, sorting, AI brief cards, progress state, and radar-style interaction.
- AI Daily page with overview table, structured sections, images when available, and article-style reading layout.
- Idea Market with Supabase-backed ideas, comments, reactions, and status updates.
- AI Tools workbench structure.
- `frontend-slides` integration for generating self-contained HTML presentation files.
- `follow-builders` integration for generating AI builder digest content.
- Local scraper service structure for API-key and browser/cookie-based data collection.
- Supabase migrations for profiles, ideas, comments, reactions, AI daily archive, and content search queue.
- Vercel deployment for the frontend.

In progress / not fully hardened:

- Deep Douyin collection with stable logged-in browser/cookie state.
- TikTok fallback collection.
- Bilibili deeper video detail collection.
- Browser-plugin assisted page exploration.
- Shared output history for generated slides and tool runs.
- More polished frontend visual design.
- Production-grade monitoring and error reporting.

### Architecture

```text
D:\SuperIdea
├── zhilan-app/          # Vite + React + TypeScript frontend
├── zhilan-scraper/      # Local FastAPI scraper and AI tool service
├── supabase/            # Database migrations
└── README.md
```

Frontend:

- Vite
- React
- TypeScript
- Supabase JS
- lucide-react
- Vercel

Local scraper / tool service:

- Python
- FastAPI
- httpx
- dotenv
- Default local URL: `http://127.0.0.1:8787`

Database and auth:

- Supabase Auth for email/password accounts.
- Supabase Postgres for user profiles, ideas, comments, reactions, AI daily archive, and search/tool data.
- Row Level Security policies are managed through SQL migrations.

### Why Supabase Is Still Used

Supabase is not only used for login. It provides the shared state that makes this useful as a team product.

Current Supabase responsibilities:

- User accounts and sessions.
- User profiles and admin/member roles.
- Idea Market data.
- Idea comments, likes, saves, and status changes.
- AI Daily archive.
- Content Radar queue mode, where the hosted frontend can create jobs and a local worker can fill results.

### Generated HTML Slides

The `frontend-slides` tool returns generated HTML to the browser for preview and download. The local service also stores generated slide files under:

```text
zhilan-scraper/data/tool_outputs/slides/
```

This directory is ignored by Git because generated files may contain internal topics, draft ideas, or private work content.

### Local Development

Start the frontend:

```powershell
cd D:\SuperIdea\zhilan-app
npm install
npm run dev
```

Start the local scraper service:

```powershell
cd D:\SuperIdea\zhilan-scraper
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\python -B -m uvicorn zhilan_scraper.app:app --host 127.0.0.1 --port 8787
```

Build the frontend:

```powershell
cd D:\SuperIdea\zhilan-app
npm run build
```

### Environment Variables

Use local `.env` files for real keys. Do not commit them.

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

### Notes For Teammates

- Use the Vercel link first unless you are working on development.
- The local scraper is only needed for deeper collection tasks, AI tool generation, or platform access that depends on local API keys/cookies.
- If a tool produces an HTML file, treat it as a draft working artifact and review it before sharing.
- The frontend UI is still being redesigned, so feedback on clarity and workflow is welcome.

---

## 中文

### 项目介绍

SuperIdea，也叫 **芝兰点子王**，是给贝瓦 / 芝兰内容团队使用的内部灵感与调研工作台。

它的目标不是做一个展示页，而是把同事日常会反复用到的几类工作放到同一个网页里：看趋势、查市场、读 AI 日报、提选题、跑小工具。

目前主要包含四个板块：

- **内容雷达**：输入关键词或选题方向，聚合视频平台与网页结果，并生成简短 AI 速览，帮助快速判断题材。
- **AI 日报**：基于 `imjuya/juya-ai-daily` GitHub Issues 做成更适合阅读的每日 AI 情报页。
- **点子市场**：同事可以发布新视频构思，大家可以评论、点赞、收藏、更新状态，并继续做市场反查。
- **AI 工具**：放一些提高效率的小工具，例如 HTML 风格 PPT 生成、AI builder 动态摘要等。

这个项目还在迭代中，但当前 Vercel 线上版本已经可以作为内部试用入口。

### 线上使用

打开：

[https://zhilan-app.vercel.app/](https://zhilan-app.vercel.app/)

使用邮箱和密码创建账号，然后登录进入工作台。

当前阶段为了方便同事试用，注册先保持开放，不再强制 `@beva.com` 邮箱或管理员白名单。后续如果需要更严格的权限控制，可以再恢复邮箱限制或邀请制。

### 当前进度

已完成：

- 公开介绍页和登录后的内部工作台。
- Supabase 邮箱密码登录。
- 登录状态持久化。
- 主导航：工作台、内容雷达、AI 日报、点子市场、AI 工具、账号管理。
- 内容雷达界面：平台筛选、排序、AI 简介卡片、搜索进度、雷达式交互。
- AI 日报产品化：今日速览表格、结构化正文、图片展示、文章式阅读布局。
- 点子市场：点子发布、评论、点赞、收藏、状态更新。
- AI 工具工作台。
- `frontend-slides` 接入：根据主题和大纲生成单文件 HTML PPT。
- `follow-builders` 接入：生成 AI builder 动态日报 / 周报。
- 本地数据采集服务结构，用于需要 API key、Cookie 或浏览器登录态的任务。
- Supabase 数据库迁移：用户、点子、评论、互动、AI 日报归档、内容搜索队列等。
- Vercel 前端部署。

进行中 / 待完善：

- 稳定的抖音登录态采集。
- TikTok 兜底采集。
- Bilibili 更深的视频详情采集。
- Chrome / 浏览器插件辅助页面探索。
- AI 工具生成结果的历史记录与共享存储。
- 更完整、更好看的前端视觉设计。
- 生产级日志、错误追踪和部署自动化。

### 项目结构

```text
D:\SuperIdea
├── zhilan-app/          # Vite + React + TypeScript 前端
├── zhilan-scraper/      # 本地 FastAPI 采集与工具服务
├── supabase/            # 数据库迁移
└── README.md
```

前端：

- Vite
- React
- TypeScript
- Supabase JS
- lucide-react
- Vercel

本地采集 / 工具服务：

- Python
- FastAPI
- httpx
- dotenv
- 默认地址：`http://127.0.0.1:8787`

数据库与登录：

- Supabase Auth 负责邮箱密码账号。
- Supabase Postgres 存储用户、点子、评论、互动、AI 日报归档、搜索任务等共享数据。
- 权限通过 SQL migration 中的 RLS 策略控制。

### Supabase 现在用来做什么

Supabase 不只是登录。它负责这个项目里的团队共享状态。

当前 Supabase 负责：

- 用户账号与 session。
- 用户 profile、管理员 / 成员角色。
- 点子市场数据。
- 点子评论、点赞、收藏、状态更新。
- AI 日报历史归档。
- 内容雷达队列模式：线上前端创建搜索任务，本地 worker 写入结果。

### HTML PPT 存在哪里

`frontend-slides` 工具会把生成的 HTML 返回给网页，用于预览和下载。本地服务也会把生成文件保存到：

```text
zhilan-scraper/data/tool_outputs/slides/
```

这个目录不会提交到 Git，因为里面可能包含内部选题、草稿或未公开内容。

### 本地开发

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

真实 key 放在本地 `.env` 文件里，不要提交。

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

### 给同事的使用说明

- 优先使用线上 Vercel 地址，不需要本地启动项目。
- 如果只是看日报、发点子、查内容，可以直接在网页里操作。
- 本地采集服务主要用于更深的数据抓取、AI 工具生成、以及需要本机 API key / Cookie / 浏览器登录态的平台。
- AI 工具生成的 HTML、日报和摘要都应视为草稿，正式对外使用前需要人工检查。
- 前端视觉还会继续优化，欢迎反馈哪里不清楚、哪里不好用。
