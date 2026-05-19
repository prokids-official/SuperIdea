from __future__ import annotations

from typing import Any


def normalize_github_issue(raw: dict[str, Any]) -> dict[str, Any]:
    created_at = str(raw.get("created_at") or "")

    return {
        "issueNumber": raw.get("number"),
        "title": raw.get("title") or "",
        "date": created_at[:10],
        "contentMarkdown": raw.get("body") or "",
        "url": raw.get("html_url") or "",
        "source": "GitHub Issues",
        "updatedAt": raw.get("updated_at") or created_at,
    }

