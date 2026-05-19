from __future__ import annotations

from typing import Any


TAVILY_SEARCH_ENDPOINT = "https://api.tavily.com/search"


def tavily_time_range(time_range: str) -> str | None:
    return {
        "24h": "day",
        "7d": "week",
        "30d": "month",
    }.get(time_range)


def normalize_tavily_response(payload: dict[str, Any]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for raw in payload.get("results", []):
        if not isinstance(raw, dict):
            continue
        title = raw.get("title")
        url = raw.get("url")
        if not title or not url:
            continue
        items.append(
            {
                "id": f"web:{url}",
                "platform": "web",
                "title": str(title),
                "url": str(url),
                "description": str(raw.get("content") or ""),
                "creatorName": _hostname(str(url)),
                "thumbnailUrl": raw.get("favicon"),
                "score": raw.get("score"),
                "dataSource": "tavily",
            }
        )
    return items


def _hostname(url: str) -> str:
    without_scheme = url.split("://", 1)[-1]
    return without_scheme.split("/", 1)[0]
