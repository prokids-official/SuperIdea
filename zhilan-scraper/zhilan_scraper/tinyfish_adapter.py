from __future__ import annotations

from typing import Any
from urllib.parse import quote_plus
from urllib.parse import urlparse


SEARCH_ENDPOINT = "https://api.search.tinyfish.ai"
FETCH_ENDPOINT = "https://api.fetch.tinyfish.ai"

PLATFORM_QUERY_HINTS = {
    "youtube": 'site:youtube.com OR site:youtu.be',
    "bilibili": 'site:bilibili.com/video',
    "douyin": 'site:douyin.com',
    "tiktok": 'site:tiktok.com',
}

PLATFORM_HOSTS = {
    "youtube": ("youtube.com", "youtu.be"),
    "bilibili": ("bilibili.com",),
    "douyin": ("douyin.com",),
    "tiktok": ("tiktok.com",),
}


def build_search_url(query: str) -> str:
    return f"{SEARCH_ENDPOINT}?query={quote_plus(query)}"


def build_platform_query(query: str, platform: str) -> str:
    clean_query = " ".join(query.split())
    hint = PLATFORM_QUERY_HINTS.get(platform)
    if not hint or "site:" in clean_query:
        return clean_query
    return f"{clean_query} {hint}"


def url_matches_platform(url: str, platform: str) -> bool:
    allowed_hosts = PLATFORM_HOSTS.get(platform)
    if not allowed_hosts:
        return True

    host = urlparse(url).netloc.lower()
    return any(host == allowed or host.endswith(f".{allowed}") for allowed in allowed_hosts)


def normalize_search_response(payload: dict[str, Any], platform: str) -> list[dict[str, Any]]:
    raw_results = payload.get("results") or payload.get("data") or payload.get("items") or []
    items: list[dict[str, Any]] = []

    for raw in raw_results:
        if not isinstance(raw, dict):
            continue

        title = raw.get("title") or raw.get("name")
        url = raw.get("url") or raw.get("link")
        if not title or not url:
            continue
        if not url_matches_platform(str(url), platform):
            continue

        items.append(
            {
                "id": f"{platform}:{url}",
                "platform": platform,
                "title": str(title),
                "url": str(url),
                "description": str(raw.get("snippet") or raw.get("description") or ""),
                "creatorName": raw.get("source") or raw.get("site_name"),
                "thumbnailUrl": raw.get("thumbnail") or raw.get("image"),
            }
        )

    return items


def normalize_fetch_response(payload: dict[str, Any]) -> dict[str, str]:
    raw_results = payload.get("results") or payload.get("data") or []
    pages: dict[str, str] = {}

    for raw in raw_results:
        if not isinstance(raw, dict):
            continue

        url = raw.get("url")
        content = raw.get("markdown") or raw.get("content") or raw.get("text")
        if url and content:
            pages[str(url)] = str(content)

    return pages
