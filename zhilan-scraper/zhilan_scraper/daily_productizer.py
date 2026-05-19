from __future__ import annotations

import argparse
import asyncio
import json
import os
from datetime import UTC, datetime
from typing import Any

import httpx
from dotenv import load_dotenv

from .daily_adapter import normalize_github_issue


REPO = "imjuya/juya-ai-daily"


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


def fallback_summary(issue: dict[str, Any]) -> dict[str, Any]:
    lines = [line.strip("- #* \t") for line in str(issue.get("contentMarkdown") or "").splitlines()]
    lines = [line for line in lines if len(line) >= 12]
    highlights = lines[:5] or [str(issue.get("title") or "今日 AI 日报已更新")]
    return {
        "highlights": highlights[:5],
        "child_content_relevance": "需要结合儿童内容、AI 漫剧、配音、分镜和制作效率继续人工筛选。",
        "idea_seeds": [],
        "tool_opportunities": [],
        "editor_note": "这是本地规则生成的摘要，DeepSeek 不可用时作为兜底。",
    }


async def summarize_with_deepseek(issue: dict[str, Any]) -> dict[str, Any]:
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        return fallback_summary(issue)

    base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
    model = os.getenv("DEEPSEEK_FLASH_MODEL", "deepseek-v4-flash")
    prompt = {
        "title": issue.get("title"),
        "date": issue.get("date"),
        "content": str(issue.get("contentMarkdown") or "")[:9000],
        "business_context": "贝瓦儿歌/芝兰玉树内容团队，关注儿童内容、AI 漫剧、格林童话改编、短视频选题、工具提效。",
        "output_requirements": {
            "highlights": "5 条今日重点，每条不超过 45 字",
            "child_content_relevance": "说明和儿童内容 / AI 漫剧的关系，80 字以内",
            "idea_seeds": "3 条可转化为视频选题的想法",
            "tool_opportunities": "2 条可能做成内部效率工具的机会",
            "editor_note": "一句给内容团队的编辑判断",
        },
    }
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "你是内容团队的 AI 日报编辑，只输出合法 JSON，不输出 Markdown。",
            },
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
        "response_format": {"type": "json_object"},
        "max_tokens": 1200,
        "thinking": {"type": "disabled"},
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=45, trust_env=False) as client:
            response = await client.post(f"{base_url}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"].get("content") or "{}"
    except httpx.HTTPError:
        return fallback_summary(issue)

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return fallback_summary(issue)
    return parsed if isinstance(parsed, dict) else fallback_summary(issue)


async def fetch_issues(limit: int) -> list[dict[str, Any]]:
    url = f"https://api.github.com/repos/{REPO}/issues"
    params = {"state": "open", "per_page": limit, "sort": "created", "direction": "desc"}
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "zhilan-scraper"}
    async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
        response = await client.get(url, params=params, headers=headers)
        response.raise_for_status()
        return [normalize_github_issue(item) for item in response.json()]


async def upsert_daily(issue: dict[str, Any], summary: dict[str, Any]) -> None:
    supabase_url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    row = {
        "issue_number": issue["issueNumber"],
        "title": issue["title"],
        "issue_date": issue["date"],
        "content_markdown": issue["contentMarkdown"],
        "url": issue["url"],
        "source": issue["source"],
        "summary": summary,
        "relevance_tags": ["AI 日报", "儿童内容", "AI 漫剧"],
        "updated_at": now_iso(),
    }
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
        response = await client.post(
            f"{supabase_url}/rest/v1/ai_daily_issues",
            params={"on_conflict": "issue_number"},
            headers=headers,
            json=row,
        )
        response.raise_for_status()


async def sync_daily(limit: int) -> None:
    issues = await fetch_issues(limit)
    for issue in issues:
        summary = await summarize_with_deepseek(issue)
        await upsert_daily(issue, summary)
        print(f"synced issue #{issue['issueNumber']}: {issue['title']}")


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser(description="Sync juya-ai-daily issues into Supabase with AI summaries.")
    parser.add_argument("--limit", type=int, default=5, help="How many recent issues to sync.")
    args = parser.parse_args()
    asyncio.run(sync_daily(max(1, min(args.limit, 20))))


if __name__ == "__main__":
    main()
