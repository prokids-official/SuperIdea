from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any, Protocol
from urllib.parse import urlparse


class YouTubeSearchClient(Protocol):
    @property
    def configured(self) -> bool:
        ...

    async def search(self, query: str, sort: str = "hot", time_range: str = "30d", limit: int = 20) -> list[dict[str, Any]]:
        ...


class TinyFishSearchClient(Protocol):
    async def search(self, query: str, platform: str) -> list[dict[str, Any]]:
        ...


async def collect_account_videos(
    account: dict[str, Any],
    youtube: YouTubeSearchClient,
    tinyfish: TinyFishSearchClient,
    limit: int = 12,
) -> list[dict[str, Any]]:
    platform = str(account.get("platform") or "").lower()
    query = build_account_query(account)
    if not query:
        return []

    if platform == "youtube" and youtube.configured:
        items = await youtube.search(query, sort="new", time_range="30d", limit=limit)
        return [stamp_account(item, account, "youtube-api") for item in likely_account_items(items, account)]

    if platform in {"tiktok", "douyin", "bilibili", "xiaohongshu"}:
        items = await tinyfish.search(query, platform)
        return [stamp_account(item, account, "tinyfish-search") for item in likely_account_items(items, account)]

    return []


def build_account_query(account: dict[str, Any]) -> str:
    platform = str(account.get("platform") or "")
    query_hint = str(account.get("query_hint") or "").strip()
    homepage = str(account.get("homepage_url") or "").strip()
    display_name = str(account.get("display_name") or "").strip()
    handle = str(account.get("handle") or "").strip()

    if query_hint:
        return query_hint
    if platform in {"tiktok", "douyin", "bilibili", "xiaohongshu"} and homepage:
        host = urlparse(homepage).netloc.replace("www.", "")
        path = urlparse(homepage).path.strip("/")
        return f"site:{host}/{path} {display_name or handle}".strip()
    return " ".join(part for part in [display_name, handle, "latest videos"] if part)


def likely_account_items(items: list[dict[str, Any]], account: dict[str, Any]) -> list[dict[str, Any]]:
    platform = str(account.get("platform") or "")
    handle = normalize_token(account.get("handle"))
    display = normalize_token(account.get("display_name"))
    homepage = str(account.get("homepage_url") or "")
    homepage_path = urlparse(homepage).path.strip("/").lower()

    if platform == "youtube":
        # YouTube Search is API-backed but still query-based until we resolve channel ids.
        # Keep the broader set here, while storing raw provenance for later audit.
        return items

    filtered: list[dict[str, Any]] = []
    for item in items:
        haystack = normalize_token(" ".join(str(item.get(key) or "") for key in ("title", "url", "description", "creatorName")))
        url_path = urlparse(str(item.get("url") or "")).path.strip("/").lower()
        if handle and handle in haystack:
            filtered.append(item)
        elif display and display in haystack:
            filtered.append(item)
        elif homepage_path and (homepage_path in url_path or url_path.startswith(homepage_path)):
            filtered.append(item)
    return filtered or items[: min(len(items), 5)]


def stamp_account(item: dict[str, Any], account: dict[str, Any], data_source: str) -> dict[str, Any]:
    return {
        **item,
        "accountId": account.get("id"),
        "trackedAccountName": account.get("display_name"),
        "trackedAccountHandle": account.get("handle"),
        "platform": item.get("platform") or account.get("platform"),
        "creatorName": item.get("creatorName") or account.get("display_name"),
        "dataSource": item.get("dataSource") or data_source,
        "externalId": item.get("id") or stable_external_id(str(item.get("url") or "")),
        "trackedAt": datetime.now(UTC).isoformat(),
    }


def stable_external_id(url: str) -> str:
    clean = url.split("?")[0].rstrip("/")
    if not clean:
        return ""
    match = re.search(r"(?:video|watch|shorts)/([^/?#]+)", clean)
    if match:
        return match.group(1)
    return clean.rsplit("/", 1)[-1]


def normalize_token(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "").lower().replace("@", ""))
