from __future__ import annotations

from datetime import UTC, datetime
from typing import Any


BILIBILI_SEARCH_ENDPOINT = "https://api.bilibili.com/x/web-interface/search/type"


def bilibili_order(sort: str) -> str:
    return {
        "views": "click",
        "hot": "totalrank",
        "new": "pubdate",
    }.get(sort, "totalrank")


def normalize_bilibili_items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    data = payload.get("data") if isinstance(payload, dict) else {}
    raw_items = data.get("result") if isinstance(data, dict) else []
    items: list[dict[str, Any]] = []

    for raw in raw_items or []:
        if not isinstance(raw, dict):
            continue

        bvid = raw.get("bvid")
        arcurl = raw.get("arcurl") or (f"https://www.bilibili.com/video/{bvid}" if bvid else "")
        title = _strip_html(str(raw.get("title") or ""))
        if not title or not arcurl:
            continue

        pubdate = raw.get("pubdate")
        published_at = None
        if isinstance(pubdate, int) and pubdate > 0:
            published_at = datetime.fromtimestamp(pubdate, tz=UTC).isoformat()

        items.append(
            {
                "id": f"bilibili:{bvid or arcurl}",
                "platform": "bilibili",
                "title": title,
                "url": _normalize_url(str(arcurl)),
                "description": _strip_html(str(raw.get("description") or "")),
                "creatorName": _strip_html(str(raw.get("author") or "")),
                "viewCount": _to_int(raw.get("play")),
                "likeCount": _to_int(raw.get("favorites")),
                "commentCount": _to_int(raw.get("review")),
                "publishedAt": published_at,
                "duration": str(raw.get("duration") or ""),
                "thumbnailUrl": _normalize_image_url(str(raw.get("pic") or "")),
                "dataSource": "bilibili-web-api",
            }
        )

    return items


def _strip_html(value: str) -> str:
    return value.replace("<em class=\"keyword\">", "").replace("</em>", "").replace("&quot;", "\"").strip()


def _normalize_image_url(value: str) -> str:
    if value.startswith("//"):
        return f"https:{value}"
    return value


def _normalize_url(value: str) -> str:
    if value.startswith("//"):
        return f"https:{value}"
    return value


def _to_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
