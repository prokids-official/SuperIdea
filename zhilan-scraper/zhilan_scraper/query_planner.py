from __future__ import annotations

import math
import re
from datetime import UTC, datetime
from typing import Any


AI_MARKERS = (
    "ai",
    "a.i.",
    "artificial intelligence",
    "generative ai",
    "ai generated",
    "ai-generated",
    "runway",
    "sora",
    "veo",
    "kling",
    "luma",
    "pika",
    "midjourney",
    "stable diffusion",
    "可灵",
    "即梦",
    "海螺",
    "文生视频",
    "图生视频",
    "生成式",
    "ai生成",
    "ai制作",
    "ai动画",
    "ai短剧",
    "ai漫剧",
    "ai视频",
    "ai电影",
    "ai做的",
)

STORY_VIDEO_MARKERS = (
    "animation",
    "animated",
    "anime",
    "cartoon",
    "short film",
    "short drama",
    "series",
    "episode",
    "cinematic",
    "story",
    "fairy tale",
    "trailer",
    "film",
    "漫剧",
    "动画",
    "短剧",
    "短片",
    "故事",
    "剧集",
    "电影感",
    "童话",
    "格林",
    "连载",
)

TUTORIAL_MARKERS = (
    "tutorial",
    "how to",
    "prompt",
    "workflow",
    "course",
    "教程",
    "教学",
    "工具",
    "软件",
    "提示词",
    "工作流",
    "保姆级",
)

CHINESE_RE = re.compile(r"[\u4e00-\u9fff]")


def build_search_plan(query: str, platforms: list[str]) -> dict[str, Any]:
    clean = " ".join(query.split()).strip()
    normalized = clean.lower()
    topic = _infer_topic(normalized)
    zh_terms = _dedupe(
        [
            clean,
            f"{clean} AI",
            "AI 漫剧",
            "AI 动画短剧",
            "AI 生成动画",
            "AI 短剧",
            "AI 故事短片",
        ]
    )
    en_terms = _dedupe(
        [
            _english_seed(topic),
            "AI animated series",
            "AI animation short film",
            "AI generated animation",
            "AI story animation",
            "cinematic AI animation",
            "AI short drama",
        ]
    )
    topic_probes = _dedupe(
        [
            "AI zombie animation",
            "AI fairy tale animation",
            "AI cinematic short film",
            "AI bedtime story animation",
            "AI animated story twist",
            "AI 动画 丧尸",
            "AI 格林童话",
            "AI 睡前故事 动画",
            "AI 反转 短片",
        ]
    )

    by_platform: dict[str, list[str]] = {}
    for platform in platforms:
        if platform in {"youtube", "tiktok"}:
            by_platform[platform] = _dedupe([clean, *en_terms[:4], *zh_terms[:2]])[:5]
        elif platform in {"bilibili", "douyin"}:
            by_platform[platform] = _dedupe([clean, *zh_terms[:5], *en_terms[:2]])[:5]
        else:
            by_platform[platform] = _dedupe([clean, *zh_terms[:3], *en_terms[:3]])[:6]

    return {
        "originalQuery": clean,
        "intent": "ai_story_video" if _looks_like_ai_story_query(clean) else "general_content_research",
        "mustHave": ["AI/generative signal", "story/video/animation signal"],
        "zhTerms": zh_terms[:6],
        "enTerms": en_terms[:6],
        "topicProbes": topic_probes,
        "platformQueries": by_platform,
    }


def filter_and_rank_items(items: list[dict[str, Any]], query: str, sort: str, limit: int) -> list[dict[str, Any]]:
    require_ai_story = _looks_like_ai_story_query(query)
    scored: list[dict[str, Any]] = []
    for item in _dedupe_by_url(items):
        score = score_item(item, query)
        if require_ai_story and not score["passesAiStoryGate"]:
            continue
        scored.append({**item, **score})

    if sort == "views":
        scored.sort(key=lambda item: (item.get("viewCount") or 0, item["opportunityScore"]), reverse=True)
    elif sort == "new":
        scored.sort(key=lambda item: (_timestamp(item.get("publishedAt")), item["opportunityScore"]), reverse=True)
    else:
        scored.sort(key=lambda item: item["opportunityScore"], reverse=True)

    for index, item in enumerate(scored[:limit], start=1):
        item["rank"] = index
    return scored[:limit]


def score_item(item: dict[str, Any], query: str) -> dict[str, Any]:
    text = _item_text(item)
    ai_hits = _hits(text, AI_MARKERS)
    story_hits = _hits(text, STORY_VIDEO_MARKERS)
    tutorial_hits = _hits(text, TUTORIAL_MARKERS)
    tutorial_intent = _is_tutorial_query(query)
    is_tutorial_result = bool(tutorial_hits)
    topic_tags = _topic_tags(text)
    language = "zh" if CHINESE_RE.search(text) else "en"
    freshness = _freshness_score(item.get("publishedAt"))
    trend = _trend_score(item.get("viewCount"), item.get("likeCount"), item.get("commentCount"), item.get("publishedAt"))
    platform_confidence = _platform_confidence(str(item.get("platform") or ""), str(item.get("dataSource") or ""))

    tutorial_penalty = 0 if tutorial_intent else len(tutorial_hits) * 34
    relevance = min(100, len(ai_hits) * 34 + len(story_hits) * 18 + _query_overlap_bonus(text, query) - tutorial_penalty)
    relevance = max(0, relevance)
    ai_confidence = min(100, len(ai_hits) * 38 + len(story_hits) * 15 - (0 if tutorial_intent else len(tutorial_hits) * 28))
    ai_confidence = max(0, ai_confidence)
    opportunity = round(relevance * 0.42 + ai_confidence * 0.2 + trend * 0.18 + freshness * 0.12 + platform_confidence * 0.08)
    passes_gate = bool(ai_hits and story_hits and ai_confidence >= 45)
    if is_tutorial_result and not tutorial_intent:
        passes_gate = False

    return {
        "language": language,
        "topicTags": topic_tags,
        "contentType": _content_type(text),
        "contentIntent": "tutorial" if is_tutorial_result else "finished_work",
        "aiSignals": ai_hits[:5],
        "negativeSignals": tutorial_hits[:4],
        "relevanceScore": round(relevance),
        "freshnessScore": round(freshness),
        "trendScore": round(trend),
        "aiConfidence": round(ai_confidence),
        "opportunityScore": max(0, min(100, opportunity if passes_gate else opportunity - 35)),
        "passesAiStoryGate": passes_gate,
        "rankReason": _rank_reason(ai_hits, story_hits, topic_tags, trend, freshness),
    }


def build_global_insight(items: list[dict[str, Any]], plan: dict[str, Any]) -> dict[str, Any]:
    topics: dict[str, int] = {}
    platforms: dict[str, int] = {}
    languages: dict[str, int] = {}
    for item in items:
        platforms[str(item.get("platform") or "unknown")] = platforms.get(str(item.get("platform") or "unknown"), 0) + 1
        languages[str(item.get("language") or "unknown")] = languages.get(str(item.get("language") or "unknown"), 0) + 1
        for tag in item.get("topicTags") or []:
            topics[str(tag)] = topics.get(str(tag), 0) + 1

    top_topics = [name for name, _ in sorted(topics.items(), key=lambda pair: pair[1], reverse=True)[:4]]
    if items:
        avg_opportunity = round(sum(int(item.get("opportunityScore") or 0) for item in items) / len(items))
        summary = f"Found {len(items)} AI-story/video candidates. Top clusters: {', '.join(top_topics) if top_topics else 'general AI animation'}."
    else:
        avg_opportunity = 0
        summary = "No confident AI-made story/video candidates passed the current filter. Try a broader query or extend the time range."

    return {
        "summary": summary,
        "topTopics": top_topics,
        "platforms": platforms,
        "languages": languages,
        "avgOpportunity": avg_opportunity,
        "strictGate": plan.get("mustHave", []),
    }


def _looks_like_ai_story_query(query: str) -> bool:
    text = query.lower()
    return bool(_hits(text, AI_MARKERS)) and (
        bool(_hits(text, STORY_VIDEO_MARKERS)) or any(word in text for word in ("漫剧", "短剧", "动画", "视频", "film", "story", "drama"))
    )


def _is_tutorial_query(query: str) -> bool:
    text = query.lower()
    return bool(_hits(text, TUTORIAL_MARKERS))


def _infer_topic(normalized_query: str) -> str:
    if "童话" in normalized_query or "格林" in normalized_query:
        return "fairy tale"
    if "睡前" in normalized_query or "儿童" in normalized_query:
        return "children bedtime story"
    if "丧尸" in normalized_query or "僵尸" in normalized_query or "zombie" in normalized_query:
        return "zombie"
    return "story"


def _english_seed(topic: str) -> str:
    return f"AI {topic} animation" if topic != "story" else "AI story animation"


def _item_text(item: dict[str, Any]) -> str:
    return " ".join(
        str(item.get(key) or "")
        for key in ("title", "description", "creatorName", "platform", "dataSource")
    ).lower()


def _hits(text: str, markers: tuple[str, ...]) -> list[str]:
    hits: list[str] = []
    for marker in markers:
        if CHINESE_RE.search(marker):
            if marker in text:
                hits.append(marker)
            continue

        escaped = re.escape(marker.lower()).replace(r"\ ", r"\s+")
        if re.search(rf"(?<![a-z0-9]){escaped}(?![a-z0-9])", text):
            hits.append(marker)
    return hits


def _topic_tags(text: str) -> list[str]:
    candidates = [
        ("zombie", ("zombie", "丧尸", "僵尸")),
        ("fairy tale", ("fairy tale", "童话", "格林")),
        ("children", ("children", "kids", "儿童", "儿歌", "睡前")),
        ("twist", ("twist", "反转")),
        ("cinematic", ("cinematic", "电影感", "trailer", "film")),
        ("series", ("series", "episode", "剧集", "连载")),
    ]
    tags = [label for label, markers in candidates if any(marker in text for marker in markers)]
    return tags or ["ai story"]


def _content_type(text: str) -> str:
    if any(marker in text for marker in ("series", "episode", "剧集", "连载", "短剧", "漫剧")):
        return "series"
    if any(marker in text for marker in ("fairy tale", "童话", "睡前", "story")):
        return "story"
    if any(marker in text for marker in ("cinematic", "film", "trailer", "电影")):
        return "cinematic"
    return "animation"


def _query_overlap_bonus(text: str, query: str) -> int:
    tokens = [token.lower() for token in re.split(r"\s+", query) if len(token.strip()) >= 2]
    return min(18, sum(6 for token in tokens if token in text))


def _freshness_score(value: Any) -> float:
    timestamp = _timestamp(value)
    if not timestamp:
        return 35
    age_days = max(0, (datetime.now(UTC).timestamp() - timestamp) / 86400)
    return max(10, 100 - age_days * 3.2)


def _trend_score(views: Any, likes: Any, comments: Any, published_at: Any) -> float:
    view_count = _number(views)
    like_count = _number(likes)
    comment_count = _number(comments)
    heat = view_count + like_count * 18 + comment_count * 32
    base = min(100, math.log10(max(10, heat)) * 22)
    timestamp = _timestamp(published_at)
    if not timestamp:
        return base * 0.72
    age_days = max(0.25, (datetime.now(UTC).timestamp() - timestamp) / 86400)
    velocity_bonus = min(24, math.log10(max(10, heat / age_days)) * 4)
    return min(100, base * 0.78 + velocity_bonus)


def _platform_confidence(platform: str, data_source: str) -> float:
    if data_source in {"youtube-api", "bilibili-web-api"}:
        return 92
    if platform == "web":
        return 70
    if platform in {"tiktok", "douyin"}:
        return 58
    return 62


def _rank_reason(ai_hits: list[str], story_hits: list[str], topic_tags: list[str], trend: float, freshness: float) -> str:
    ai_part = ai_hits[0] if ai_hits else "AI signal"
    story_part = story_hits[0] if story_hits else "story signal"
    topic_part = topic_tags[0] if topic_tags else "general"
    return f"{ai_part} + {story_part}; {topic_part}; trend {round(trend)}, freshness {round(freshness)}"


def _timestamp(value: Any) -> float:
    if not value:
        return 0
    try:
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).replace("Z", "+00:00")
        return datetime.fromisoformat(text).timestamp()
    except (TypeError, ValueError):
        return 0


def _number(value: Any) -> int:
    try:
        if value is None:
            return 0
        return int(value)
    except (TypeError, ValueError):
        return 0


def _dedupe(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        clean = " ".join(item.split()).strip()
        key = clean.lower()
        if clean and key not in seen:
            seen.add(key)
            result.append(clean)
    return result


def _dedupe_by_url(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in items:
        url = str(item.get("url") or "")
        if not url or url in seen:
            continue
        seen.add(url)
        deduped.append(item)
    return deduped
