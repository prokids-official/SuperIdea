from __future__ import annotations

import os
import uuid
from typing import Any

import httpx

from .bilibili_adapter import BILIBILI_SEARCH_ENDPOINT, bilibili_order, normalize_bilibili_items
from .daily_adapter import normalize_github_issue
from .tavily_adapter import TAVILY_SEARCH_ENDPOINT, normalize_tavily_response, tavily_time_range
from .tinyfish_adapter import (
    FETCH_ENDPOINT,
    build_platform_query,
    build_search_url,
    normalize_fetch_response,
    normalize_search_response,
)
from .youtube_adapter import (
    YOUTUBE_SEARCH_ENDPOINT,
    YOUTUBE_VIDEOS_ENDPOINT,
    normalize_youtube_items,
    published_after,
    youtube_order,
)


class TinyFishClient:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("TINYFISH_API_KEY", "")

    async def search(self, query: str, platform: str) -> list[dict[str, Any]]:
        if not self.api_key:
            return []

        tinyfish_query = build_platform_query(query, platform)
        headers = {"X-API-Key": self.api_key}
        async with httpx.AsyncClient(timeout=20, trust_env=False) as client:
            response = await client.get(build_search_url(tinyfish_query), headers=headers)
            response.raise_for_status()
            return normalize_search_response(response.json(), platform=platform)

    async def fetch(self, urls: list[str]) -> dict[str, str]:
        if not self.api_key:
            return {}

        headers = {"X-API-Key": self.api_key, "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
            response = await client.post(FETCH_ENDPOINT, headers=headers, json={"urls": urls})
            response.raise_for_status()
            return normalize_fetch_response(response.json())


class YouTubeClient:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("YOUTUBE_API_KEY", "")

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def search(self, query: str, sort: str = "hot", time_range: str = "30d", limit: int = 20) -> list[dict[str, Any]]:
        if not self.api_key:
            return []

        params: dict[str, Any] = {
            "part": "snippet",
            "type": "video",
            "q": query,
            "maxResults": min(limit, 50),
            "order": youtube_order(sort),
            "key": self.api_key,
            "safeSearch": "moderate",
        }
        after = published_after(time_range)
        if after:
            params["publishedAfter"] = after

        async with httpx.AsyncClient(timeout=20, trust_env=False) as client:
            search_response = await client.get(YOUTUBE_SEARCH_ENDPOINT, params=params)
            search_response.raise_for_status()
            search_payload = search_response.json()

            video_ids = [
                item.get("id", {}).get("videoId")
                for item in search_payload.get("items", [])
                if isinstance(item, dict) and item.get("id", {}).get("videoId")
            ]
            if not video_ids:
                return []

            videos_response = await client.get(
                YOUTUBE_VIDEOS_ENDPOINT,
                params={
                    "part": "snippet,statistics,contentDetails",
                    "id": ",".join(video_ids),
                    "key": self.api_key,
                },
            )
            videos_response.raise_for_status()
            return normalize_youtube_items(search_payload, videos_response.json())


class BilibiliClient:
    @property
    def configured(self) -> bool:
        return True

    async def search(self, query: str, sort: str = "hot", time_range: str = "30d", limit: int = 20) -> list[dict[str, Any]]:
        params = {
            "search_type": "video",
            "keyword": query,
            "order": bilibili_order(sort),
            "page": 1,
        }
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
            "Referer": "https://search.bilibili.com/",
            "Origin": "https://search.bilibili.com",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Cookie": os.getenv("BILIBILI_COOKIE") or _anonymous_bilibili_cookie(),
        }
        async with httpx.AsyncClient(timeout=20, headers=headers, trust_env=False) as client:
            response = await client.get(BILIBILI_SEARCH_ENDPOINT, params=params)
            response.raise_for_status()
            return normalize_bilibili_items(response.json())[:limit]


def _anonymous_bilibili_cookie() -> str:
    buvid = str(uuid.uuid4()).upper()
    return f"buvid3={buvid}; b_nut={int(__import__('time').time())}; CURRENT_FNVAL=4048"


class TavilyClient:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("TAVILY_API_KEY", "")

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    async def search(self, query: str, time_range: str = "30d", limit: int = 10) -> list[dict[str, Any]]:
        if not self.api_key:
            return []

        payload: dict[str, Any] = {
            "query": query,
            "topic": "news",
            "search_depth": "basic",
            "max_results": min(limit, 20),
            "include_answer": "basic",
            "include_raw_content": False,
            "include_favicon": True,
            "include_usage": True,
        }
        range_value = tavily_time_range(time_range)
        if range_value:
            payload["time_range"] = range_value

        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=20, trust_env=False) as client:
            response = await client.post(TAVILY_SEARCH_ENDPOINT, headers=headers, json=payload)
            response.raise_for_status()
            return normalize_tavily_response(response.json())


class GitHubDailyClient:
    def __init__(self, repo: str = "imjuya/juya-ai-daily") -> None:
        self.repo = repo

    async def latest(self) -> dict[str, Any]:
        url = f"https://api.github.com/repos/{self.repo}/issues"
        params = {"state": "open", "per_page": 1, "sort": "created", "direction": "desc"}
        headers = {"Accept": "application/vnd.github+json", "User-Agent": "zhilan-scraper"}

        async with httpx.AsyncClient(timeout=20, trust_env=False) as client:
            response = await client.get(url, params=params, headers=headers)
            response.raise_for_status()
            issues = response.json()

        if not issues:
            return {}
        return normalize_github_issue(issues[0])
