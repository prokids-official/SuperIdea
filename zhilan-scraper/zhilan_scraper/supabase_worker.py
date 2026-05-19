from __future__ import annotations

import argparse
import asyncio
import os
from datetime import UTC, datetime
from datetime import timedelta
from typing import Any
from urllib.parse import quote

import httpx
from dotenv import load_dotenv


DEFAULT_SCRAPER_URL = "http://127.0.0.1:8787"


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


class SupabaseWorker:
    def __init__(self, supabase_url: str, service_key: str, scraper_url: str = DEFAULT_SCRAPER_URL) -> None:
        self.supabase_url = supabase_url.rstrip("/")
        self.scraper_url = scraper_url.rstrip("/")
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

    async def run(self, once: bool = False, interval: float = 2.5) -> None:
        async with httpx.AsyncClient(timeout=90, trust_env=False) as client:
            while True:
                try:
                    job = await self.next_job(client)
                except Exception as exc:
                    print(f"Worker poll failed: {exc.__class__.__name__}: {exc}", flush=True)
                    if once:
                        raise
                    await asyncio.sleep(interval)
                    continue

                if job:
                    await self.process_job(client, job)
                    if once:
                        return
                elif once:
                    print("No queued search jobs.", flush=True)
                    return
                else:
                    await asyncio.sleep(interval)

    async def next_job(self, client: httpx.AsyncClient) -> dict[str, Any] | None:
        job = await self.find_job(client, status="queued")
        if job:
            await self.update_job(client, job["id"], {"status": "processing", "updated_at": now_iso()})
            return job

        stale_before = (datetime.now(UTC) - timedelta(minutes=15)).isoformat()
        stale_job = await self.find_job(client, status="processing", updated_before=stale_before)
        if stale_job:
            await self.update_job(client, stale_job["id"], {"status": "processing", "updated_at": now_iso(), "error": None})
            print(f"Reclaimed stale search job {stale_job['id']}", flush=True)
            return stale_job

        return None

    async def find_job(self, client: httpx.AsyncClient, status: str, updated_before: str | None = None) -> dict[str, Any] | None:
        params = {
            "select": "*",
            "status": f"eq.{status}",
            "order": "created_at.asc",
            "limit": "1",
        }
        if updated_before:
            params["updated_at"] = f"lt.{updated_before}"

        response = await client.get(
            f"{self.supabase_url}/rest/v1/content_search_jobs",
            headers=self.headers,
            params=params,
        )
        response.raise_for_status()
        jobs = response.json()
        if not jobs:
            return None

        return jobs[0]

    async def process_job(self, client: httpx.AsyncClient, job: dict[str, Any]) -> None:
        job_id = job["id"]
        print(f"Processing search job {job_id}: {job['query']}", flush=True)
        try:
            search_response = await client.post(
                f"{self.scraper_url}/api/search",
                json={
                    "query": job["query"],
                    "platforms": job["platforms"],
                    "sort": job["sort"],
                    "timeRange": job["time_range"],
                    "limit": job["limit_count"],
                    "includeAiBrief": job["include_ai_brief"],
                    "fetchTop": job["fetch_top"],
                    "aiBriefTop": job["ai_brief_top"],
                    "briefMode": job["brief_mode"],
                },
            )
            search_response.raise_for_status()
            body = search_response.json()

            rows = [self.to_result_row(job_id, rank, item) for rank, item in enumerate(body.get("items", []), start=1)]
            if rows:
                insert_response = await client.post(
                    f"{self.supabase_url}/rest/v1/content_search_results",
                    headers={**self.headers, "Prefer": "return=minimal"},
                    json=rows,
                )
                insert_response.raise_for_status()

            await self.update_job(
                client,
                job_id,
                {
                    "status": "done",
                    "source_status": body.get("sourceStatus") or {},
                    "elapsed_ms": body.get("elapsedMs"),
                    "updated_at": now_iso(),
                    "finished_at": now_iso(),
                },
            )
            print(f"Finished search job {job_id}: {len(rows)} results", flush=True)
        except Exception as exc:
            await self.update_job(
                client,
                job_id,
                {
                    "status": "failed",
                    "error": f"{exc.__class__.__name__}: {exc}",
                    "updated_at": now_iso(),
                    "finished_at": now_iso(),
                },
            )
            print(f"Failed search job {job_id}: {exc}", flush=True)

    async def update_job(self, client: httpx.AsyncClient, job_id: str, payload: dict[str, Any]) -> None:
        response = await client.patch(
            f"{self.supabase_url}/rest/v1/content_search_jobs?id=eq.{quote(job_id)}",
            headers={**self.headers, "Prefer": "return=minimal"},
            json=payload,
        )
        response.raise_for_status()

    def to_result_row(self, job_id: str, rank: int, item: dict[str, Any]) -> dict[str, Any]:
        return {
            "job_id": job_id,
            "rank": rank,
            "platform": item.get("platform") or "web",
            "title": item.get("title") or "Untitled",
            "url": item.get("url") or "",
            "description": item.get("description"),
            "creator_name": item.get("creatorName"),
            "view_count": item.get("viewCount"),
            "like_count": item.get("likeCount"),
            "comment_count": item.get("commentCount"),
            "published_at": item.get("publishedAt"),
            "duration": item.get("duration"),
            "data_source": item.get("dataSource"),
            "brief_source": item.get("briefSource"),
            "brief_model": item.get("briefModel"),
            "ai_brief": item.get("aiBrief") or {},
            "raw": item,
        }


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Poll Supabase search jobs and fill results from the local scraper.")
    parser.add_argument("--once", action="store_true", help="Process at most one queued job and exit.")
    parser.add_argument("--interval", type=float, default=2.5, help="Polling interval in seconds.")
    args = parser.parse_args()

    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY")
    scraper_url = os.getenv("LOCAL_SCRAPER_URL") or DEFAULT_SCRAPER_URL

    if not supabase_url:
        raise SystemExit("Missing SUPABASE_URL in .env")
    if not service_key:
        raise SystemExit("Missing SUPABASE_SERVICE_ROLE_KEY in .env")

    worker = SupabaseWorker(supabase_url=supabase_url, service_key=service_key, scraper_url=scraper_url)
    asyncio.run(worker.run(once=args.once, interval=args.interval))


if __name__ == "__main__":
    main()
