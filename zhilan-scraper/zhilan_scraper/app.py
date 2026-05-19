from __future__ import annotations

import time
import asyncio
from typing import Any, Literal, Protocol

from dotenv import load_dotenv
import httpx
from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .brief_adapter import build_ai_brief
from .clients import BilibiliClient, GitHubDailyClient, TavilyClient, TinyFishClient, YouTubeClient
from .deepseek_client import BriefMode, DeepSeekClient
from .local_store import LocalStore
from .query_planner import build_global_insight, build_search_plan, filter_and_rank_items
from .tracking_accounts import DEFAULT_TRACKED_ACCOUNTS
from .tracking_adapter import collect_account_videos
from .tools_adapter import build_follow_builders_digest, generate_frontend_slides


Platform = Literal["youtube", "bilibili", "douyin", "tiktok", "web"]


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    platforms: list[Platform] = Field(default_factory=lambda: ["web"])
    sort: str = "views"
    timeRange: str = "30d"
    limit: int = Field(default=20, ge=1, le=50)
    includeAiBrief: bool = True
    fetchTop: int = Field(default=0, ge=0, le=5)
    aiBriefTop: int = Field(default=5, ge=0, le=10)
    briefMode: BriefMode = "auto"


class FetchRequest(BaseModel):
    urls: list[str] = Field(min_length=1, max_length=25)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class IdeaCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    desc: str = Field(default="", max_length=1200)
    author: str = Field(default="内部账号", max_length=40)
    avatar: str = Field(default="内", max_length=2)


class FrontendSlidesRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=160)
    outline: str = Field(default="", max_length=6000)
    style: str = "electric-studio"
    audience: str = Field(default="公司内部同事", max_length=80)
    slideCount: int = Field(default=8, ge=4, le=14)


class FollowBuildersRequest(BaseModel):
    cadence: Literal["daily", "weekly"] = "daily"
    language: str = "zh"
    focus: str = Field(default="AI 产品、AI agent、开发者工具、可给内容团队带来效率提升的想法", max_length=300)
    limitBuilders: int = Field(default=8, ge=3, le=15)


class TrackingCollectRequest(BaseModel):
    account: dict[str, Any]
    limit: int = Field(default=12, ge=1, le=30)


class SearchClient(Protocol):
    async def search(self, query: str, platform: str) -> list[dict[str, Any]]:
        ...

    async def fetch(self, urls: list[str]) -> dict[str, str]:
        ...


class DailyClient(Protocol):
    async def latest(self) -> dict[str, Any]:
        ...


class YouTubeSearchClient(Protocol):
    @property
    def configured(self) -> bool:
        ...

    async def search(self, query: str, sort: str = "hot", time_range: str = "30d", limit: int = 20) -> list[dict[str, Any]]:
        ...


class BilibiliSearchClient(Protocol):
    @property
    def configured(self) -> bool:
        ...

    async def search(self, query: str, sort: str = "hot", time_range: str = "30d", limit: int = 20) -> list[dict[str, Any]]:
        ...


class TavilySearchClient(Protocol):
    @property
    def configured(self) -> bool:
        ...

    async def search(self, query: str, time_range: str = "30d", limit: int = 10) -> list[dict[str, Any]]:
        ...


class BriefClient(Protocol):
    @property
    def configured(self) -> bool:
        ...

    async def build_brief(self, item: dict[str, Any], fetched_content: str = "", mode: BriefMode = "auto") -> dict[str, str]:
        ...


def create_app(
    tinyfish: SearchClient | None = None,
    daily: DailyClient | None = None,
    youtube: YouTubeSearchClient | None = None,
    bilibili: BilibiliSearchClient | None = None,
    tavily: TavilySearchClient | None = None,
    brief: BriefClient | None = None,
    store: LocalStore | None = None,
) -> FastAPI:
    load_dotenv()

    tinyfish_client = tinyfish or TinyFishClient()
    daily_client = daily or GitHubDailyClient()
    youtube_client = youtube or YouTubeClient()
    bilibili_client = bilibili or BilibiliClient()
    tavily_client = tavily or TavilyClient()
    brief_client = brief or DeepSeekClient()
    local_store = store or LocalStore()
    app = FastAPI(title="Zhilan Scraper", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/auth/login")
    async def login(req: LoginRequest) -> dict[str, Any]:
        user = local_store.login(req.email, req.password)
        if not user:
            raise HTTPException(status_code=401, detail="账号或密码不正确")
        return {"user": user}

    @app.get("/api/ideas")
    async def list_ideas() -> dict[str, Any]:
        return {"items": local_store.list_ideas()}

    @app.post("/api/ideas")
    async def create_idea(req: IdeaCreateRequest) -> dict[str, Any]:
        idea = local_store.create_idea(
            title=req.title,
            desc=req.desc or "这个点子还没有详细说明，可以在评论区继续补充。",
            author=req.author,
            avatar=req.avatar,
        )
        return {"item": idea}

    @app.post("/api/search")
    async def search(req: SearchRequest) -> dict[str, Any]:
        started = time.perf_counter()
        raw_items: list[dict[str, Any]] = []
        source_status: dict[str, str] = {}
        search_plan = build_search_plan(req.query, list(req.platforms))

        async def search_platform(platform: Platform) -> tuple[str, list[dict[str, Any]], str]:
            platform_queries = search_plan["platformQueries"].get(platform, [req.query])
            per_query_limit = max(5, min(12, req.limit))
            collected: list[dict[str, Any]] = []
            try:
                for platform_query in platform_queries:
                    if platform == "youtube" and youtube_client.configured:
                        collected.extend(await youtube_client.search(platform_query, req.sort, req.timeRange, per_query_limit))
                        continue

                    if platform == "bilibili" and bilibili_client.configured:
                        collected.extend(await bilibili_client.search(platform_query, req.sort, req.timeRange, per_query_limit))
                        continue

                    if platform == "web" and tavily_client.configured:
                        tavily_items = await tavily_client.search(platform_query, req.timeRange, max(5, req.limit // 2))
                        tinyfish_items = await tinyfish_client.search(platform_query, platform)
                        collected.extend([*tavily_items, *tinyfish_items])
                        continue

                    collected.extend(await tinyfish_client.search(platform_query, platform))
            except httpx.HTTPError as exc:
                return platform, [], f"error: {exc.__class__.__name__}"

            platform_items = filter_and_rank_items(_dedupe_by_url(collected), req.query, req.sort, req.limit)
            if platform == "youtube" and youtube_client.configured:
                source = "youtube-api"
            elif platform == "bilibili" and bilibili_client.configured:
                source = "bilibili-web-api"
            elif platform == "web" and tavily_client.configured:
                source = "tavily+tinyfish"
            else:
                source = "tinyfish"
            status = f"ok: {source} · {len(platform_queries)} queries · {len(platform_items)} ai-matched" if platform_items else f"empty: {source} · strict-ai-filter"
            return platform, platform_items, status

        platform_results = await asyncio.gather(*(search_platform(platform) for platform in req.platforms))
        for platform, platform_items, status in platform_results:
            raw_items.extend(platform_items)
            source_status[platform] = status

        items = filter_and_rank_items(raw_items, req.query, req.sort, req.limit)
        fetched_pages: dict[str, str] = {}
        if req.includeAiBrief and req.fetchTop:
            urls = [item["url"] for item in items[: req.fetchTop] if item.get("url")]
            try:
                fetched_pages = await tinyfish_client.fetch(urls)
            except httpx.HTTPError:
                fetched_pages = {}

        if req.includeAiBrief:
            async def brief_item(index: int, item: dict[str, Any]) -> dict[str, Any]:
                fetched = fetched_pages.get(str(item.get("url")), "")
                source = "fetch" if fetched else "search"
                use_deepseek = brief_client.configured and index < req.aiBriefTop
                if use_deepseek:
                    try:
                        ai_brief = await brief_client.build_brief(item, fetched, req.briefMode)
                        model_label = "deepseek"
                    except httpx.HTTPError:
                        ai_brief = build_ai_brief(item, fetched)
                        model_label = "local-fallback"
                else:
                    ai_brief = build_ai_brief(item, fetched)
                    model_label = "local"
                return {
                    **item,
                    "aiBrief": ai_brief,
                    "briefSource": source,
                    "briefModel": model_label,
                }

            items = await asyncio.gather(*(brief_item(index, item) for index, item in enumerate(items)))

        return {
            "query": req.query,
            "items": items,
            "elapsedMs": round((time.perf_counter() - started) * 1000),
            "sourceStatus": source_status,
            "searchPlan": search_plan,
            "insight": build_global_insight(items, search_plan),
        }

    @app.post("/api/fetch")
    async def fetch(req: FetchRequest) -> dict[str, Any]:
        pages = await tinyfish_client.fetch(req.urls)
        return {"pages": pages}

    @app.get("/api/daily/latest")
    async def latest_daily() -> dict[str, Any]:
        return await daily_client.latest()

    @app.get("/api/tracking/accounts")
    async def tracking_accounts() -> dict[str, Any]:
        return {
            "items": DEFAULT_TRACKED_ACCOUNTS,
            "cookieNotes": {
                "youtube": "official api, no cookie needed",
                "bilibili": "public search works without cookie first; cookie helps if rate limited",
                "douyin": "stable latest-account scraping needs login cookie or browser automation",
                "tiktok": "public search fallback works; logged-in browser is better for latest feed",
                "xiaohongshu": "stable latest-account scraping needs login cookie or browser automation",
            },
        }

    @app.post("/api/tracking/collect")
    async def tracking_collect(req: TrackingCollectRequest) -> dict[str, Any]:
        items = await collect_account_videos(
            req.account,
            youtube=youtube_client,
            tinyfish=tinyfish_client,
            limit=req.limit,
        )
        return {"items": items}

    @app.post("/api/tools/frontend-slides")
    async def frontend_slides(req: FrontendSlidesRequest) -> dict[str, Any]:
        return await generate_frontend_slides(
            topic=req.topic,
            outline=req.outline,
            style=req.style,  # type: ignore[arg-type]
            audience=req.audience,
            slide_count=req.slideCount,
        )

    @app.post("/api/tools/follow-builders")
    async def follow_builders(req: FollowBuildersRequest) -> dict[str, Any]:
        return await build_follow_builders_digest(
            cadence=req.cadence,
            language=req.language,
            focus=req.focus,
            limit_builders=req.limitBuilders,
        )

    return app


def _dedupe_by_url(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in items:
        url = str(item.get("url") or "")
        if not url or url in seen:
            continue
        seen.add(url)
        deduped.append(item)
    return deduped


app = create_app()
