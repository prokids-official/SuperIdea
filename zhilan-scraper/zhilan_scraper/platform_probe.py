from __future__ import annotations

import argparse
import asyncio
import json
import os
import subprocess
from typing import Any

from dotenv import load_dotenv

from .clients import BilibiliClient, TinyFishClient


async def probe_bilibili(query: str, limit: int) -> list[dict[str, Any]]:
    return await BilibiliClient().search(query=query, sort="hot", time_range="30d", limit=limit)


async def probe_tinyfish(query: str, platform: str, limit: int) -> list[dict[str, Any]]:
    return (await TinyFishClient().search(query=query, platform=platform))[:limit]


def probe_douyin_url(url: str) -> dict[str, Any]:
    command = ["yt-dlp", "--dump-single-json", "--no-warnings"]
    cookie_file = os.getenv("DOUYIN_COOKIE_FILE", "")
    if cookie_file:
        command.extend(["--cookies", cookie_file])
    command.append(url)

    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90, check=False)
    if result.returncode != 0:
        return {"ok": False, "error": result.stderr.strip() or result.stdout.strip()}

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"ok": False, "error": "yt-dlp returned non-json output"}

    return {
        "ok": True,
        "id": payload.get("id"),
        "title": payload.get("title"),
        "uploader": payload.get("uploader"),
        "webpage_url": payload.get("webpage_url"),
        "duration": payload.get("duration"),
        "view_count": payload.get("view_count"),
        "like_count": payload.get("like_count"),
        "comment_count": payload.get("comment_count"),
        "upload_date": payload.get("upload_date"),
    }


async def main_async() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Probe platform collectors for Zhilan content radar.")
    parser.add_argument("--platform", choices=["bilibili", "douyin", "tiktok"], required=True)
    parser.add_argument("--query", default="")
    parser.add_argument("--url", default="")
    parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()

    if args.platform == "bilibili":
        if not args.query:
            raise SystemExit("--query is required for bilibili")
        data: Any = await probe_bilibili(args.query, args.limit)
    elif args.platform == "tiktok":
        if not args.query:
            raise SystemExit("--query is required for tiktok")
        data = await probe_tinyfish(args.query, "tiktok", args.limit)
    else:
        if args.url:
            data = probe_douyin_url(args.url)
        elif args.query:
            data = await probe_tinyfish(args.query, "douyin", args.limit)
        else:
            raise SystemExit("--query or --url is required for douyin")

    print(json.dumps(data, ensure_ascii=False, indent=2))


def main() -> None:
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
