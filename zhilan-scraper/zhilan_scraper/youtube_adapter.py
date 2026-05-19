from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any


YOUTUBE_SEARCH_ENDPOINT = "https://www.googleapis.com/youtube/v3/search"
YOUTUBE_VIDEOS_ENDPOINT = "https://www.googleapis.com/youtube/v3/videos"


def youtube_order(sort: str) -> str:
    if sort == "views":
        return "viewCount"
    if sort == "new":
        return "date"
    return "relevance"


def published_after(time_range: str, now: datetime | None = None) -> str | None:
    current = now or datetime.now(timezone.utc)
    windows = {
        "24h": timedelta(days=1),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    delta = windows.get(time_range)
    if not delta:
        return None
    return (current - delta).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build_youtube_url(video_id: str) -> str:
    return f"https://www.youtube.com/watch?v={video_id}"


def normalize_youtube_items(search_payload: dict[str, Any], videos_payload: dict[str, Any]) -> list[dict[str, Any]]:
    video_details = {item.get("id"): item for item in videos_payload.get("items", []) if isinstance(item, dict)}
    items: list[dict[str, Any]] = []

    for raw in search_payload.get("items", []):
        if not isinstance(raw, dict):
            continue

        video_id = (raw.get("id") or {}).get("videoId")
        snippet = raw.get("snippet") or {}
        if not video_id or not snippet:
            continue

        detail = video_details.get(video_id, {})
        detail_snippet = detail.get("snippet") or {}
        statistics = detail.get("statistics") or {}
        content_details = detail.get("contentDetails") or {}
        thumbnails = snippet.get("thumbnails") or {}
        thumbnail = (thumbnails.get("high") or thumbnails.get("medium") or thumbnails.get("default") or {}).get("url")

        items.append(
            {
                "id": f"youtube:{video_id}",
                "platform": "youtube",
                "title": str(snippet.get("title") or detail_snippet.get("title") or ""),
                "url": build_youtube_url(video_id),
                "description": str(snippet.get("description") or detail_snippet.get("description") or ""),
                "creatorName": snippet.get("channelTitle") or detail_snippet.get("channelTitle"),
                "creatorId": snippet.get("channelId") or detail_snippet.get("channelId"),
                "thumbnailUrl": thumbnail,
                "viewCount": _int_or_none(statistics.get("viewCount")),
                "likeCount": _int_or_none(statistics.get("likeCount")),
                "commentCount": _int_or_none(statistics.get("commentCount")),
                "publishedAt": snippet.get("publishedAt") or detail_snippet.get("publishedAt"),
                "duration": content_details.get("duration"),
                "dataSource": "youtube-api",
            }
        )

    return [item for item in items if item["title"]]


def _int_or_none(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None
