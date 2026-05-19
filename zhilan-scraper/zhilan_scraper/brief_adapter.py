from __future__ import annotations

from typing import Any


def _compact(text: str, limit: int) -> str:
    normalized = " ".join(str(text or "").split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: limit - 1].rstrip() + "…"


def build_ai_brief(item: dict[str, Any], fetched_content: str = "") -> dict[str, str]:
    title = _compact(str(item.get("title") or "未命名内容"), 80)
    description = _compact(str(item.get("description") or ""), 120)
    content = _compact(fetched_content, 180)
    platform = str(item.get("platform") or "web")

    base = content or description or f"搜索结果显示这是一条与「{title}」相关的内容。"
    hook_hint = "反转" if "反转" in title or "反转" in base else "主题匹配"

    return {
        "summary": _compact(f"{title}：{base}", 150),
        "hook": _compact(f"可能的爆点是「{hook_hint}」和清晰主题包装，适合先看开头 5 秒与标题封面。", 96),
        "learn": _compact(f"可作为 AI 漫剧 / 儿童内容选题参考，重点拆解叙事钩子、视觉风格和系列化空间。", 96),
        "risk": _compact(
            f"当前来自 {platform}{' 深读正文' if content else ' 搜索片段'}，仍需通过视频数据或评论样本验证真实热度和儿童友好度。",
            96,
        ),
    }
