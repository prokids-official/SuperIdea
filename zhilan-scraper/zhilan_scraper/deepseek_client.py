from __future__ import annotations

import json
import os
from typing import Any, Literal

import httpx

from .brief_adapter import build_ai_brief


BriefMode = Literal["auto", "flash", "pro"]


class DeepSeekClient:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = "https://api.deepseek.com",
        flash_model: str | None = None,
        pro_model: str | None = None,
    ) -> None:
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY", "")
        self.base_url = os.getenv("DEEPSEEK_BASE_URL", base_url).rstrip("/")
        self.flash_model = flash_model or os.getenv("DEEPSEEK_FLASH_MODEL", "deepseek-v4-flash")
        self.pro_model = pro_model or os.getenv("DEEPSEEK_PRO_MODEL", "deepseek-v4-pro")

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def choose_model(self, item: dict[str, Any], fetched_content: str, mode: BriefMode = "auto") -> str:
        if mode == "pro":
            return self.pro_model
        if mode == "flash":
            return self.flash_model

        text_size = len(fetched_content or "") + len(str(item.get("description") or ""))
        return self.pro_model if text_size > 800 else self.flash_model

    async def build_brief(self, item: dict[str, Any], fetched_content: str = "", mode: BriefMode = "auto") -> dict[str, str]:
        if not self.configured:
            return build_ai_brief(item, fetched_content)

        model = self.choose_model(item, fetched_content, mode)
        thinking_enabled = model == self.pro_model
        payload: dict[str, Any] = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "你是贝瓦儿歌/芝兰玉树内容团队的短视频选题分析助手。"
                        "你只输出合法 JSON，不输出 Markdown。"
                        "从儿童友好、AI漫剧、选题借鉴和制作风险角度分析。"
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "要求": "输出 JSON，字段必须是 summary、hook、learn、risk，每个字段 40-90 个中文字符。",
                            "内容": {
                                "platform": item.get("platform"),
                                "title": item.get("title"),
                                "creator": item.get("creatorName"),
                                "description": item.get("description"),
                                "fetchedContent": fetched_content[:3500],
                                "url": item.get("url"),
                            },
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            "response_format": {"type": "json_object"},
            "max_tokens": 900,
            "thinking": {"type": "enabled" if thinking_enabled else "disabled"},
        }
        if thinking_enabled:
            payload["reasoning_effort"] = "high"

        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=40, trust_env=False) as client:
            response = await client.post(f"{self.base_url}/chat/completions", headers=headers, json=payload)
            response.raise_for_status()
            content = response.json()["choices"][0]["message"].get("content") or "{}"

        parsed = _parse_json_object(content)
        fallback = build_ai_brief(item, fetched_content)
        return {
            "summary": str(parsed.get("summary") or fallback["summary"]),
            "hook": str(parsed.get("hook") or fallback["hook"]),
            "learn": str(parsed.get("learn") or parsed.get("takeaway") or fallback["learn"]),
            "risk": str(parsed.get("risk") or fallback["risk"]),
        }


def _parse_json_object(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}
