from __future__ import annotations

import html
import json
import os
import re
import textwrap
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import httpx

from .deepseek_client import _parse_json_object


SlidesStyle = Literal[
    "bold-signal",
    "electric-studio",
    "notebook-tabs",
    "swiss-modern",
    "paper-ink",
    "neon-cyber",
]
DigestCadence = Literal["daily", "weekly"]

FOLLOW_BUILDERS_RAW_BASE = "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main"
OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "data" / "tool_outputs"


STYLE_PRESETS: dict[str, dict[str, str]] = {
    "bold-signal": {
        "name": "Bold Signal",
        "font": "'Arial Black', 'Archivo Black', Impact, sans-serif",
        "body": "'Space Grotesk', 'Segoe UI', sans-serif",
        "bg": "#111318",
        "fg": "#f7f4ed",
        "muted": "#c9c2b8",
        "accent": "#ff5a1f",
        "panel": "rgba(255,255,255,.08)",
    },
    "electric-studio": {
        "name": "Electric Studio",
        "font": "'Manrope', 'Segoe UI', sans-serif",
        "body": "'Manrope', 'Segoe UI', sans-serif",
        "bg": "#f7f8fb",
        "fg": "#0b0f19",
        "muted": "#647084",
        "accent": "#0057ff",
        "panel": "rgba(255,255,255,.78)",
    },
    "notebook-tabs": {
        "name": "Notebook Tabs",
        "font": "'Georgia', 'Times New Roman', serif",
        "body": "'DM Sans', 'Segoe UI', sans-serif",
        "bg": "#2a2724",
        "fg": "#f5ead8",
        "muted": "#cbbca8",
        "accent": "#ffd166",
        "panel": "rgba(245,234,216,.08)",
    },
    "swiss-modern": {
        "name": "Swiss Modern",
        "font": "'Arial Narrow', 'Archivo', sans-serif",
        "body": "'Nunito', 'Segoe UI', sans-serif",
        "bg": "#ffffff",
        "fg": "#0a0a0a",
        "muted": "#5e6570",
        "accent": "#ff2d2d",
        "panel": "rgba(0,0,0,.045)",
    },
    "paper-ink": {
        "name": "Paper & Ink",
        "font": "'Cormorant Garamond', Georgia, serif",
        "body": "'Source Serif 4', Georgia, serif",
        "bg": "#f6efdf",
        "fg": "#25211d",
        "muted": "#6c6257",
        "accent": "#b4232a",
        "panel": "rgba(255,255,255,.42)",
    },
    "neon-cyber": {
        "name": "Neon Cyber",
        "font": "'Trebuchet MS', 'Clash Display', sans-serif",
        "body": "'Satoshi', 'Segoe UI', sans-serif",
        "bg": "#07111f",
        "fg": "#eaf7ff",
        "muted": "#8db1c8",
        "accent": "#28e5ff",
        "panel": "rgba(40,229,255,.08)",
    },
}


async def generate_frontend_slides(
    topic: str,
    outline: str = "",
    style: SlidesStyle = "electric-studio",
    audience: str = "公司内部同事",
    slide_count: int = 8,
) -> dict[str, Any]:
    slide_count = max(4, min(slide_count, 14))
    deck = await _build_deck_with_deepseek(topic, outline, audience, slide_count)
    if not deck:
        deck = _fallback_deck(topic, outline, audience, slide_count)

    preset = STYLE_PRESETS.get(style, STYLE_PRESETS["electric-studio"])
    html_content = _render_slides_html(deck, preset)
    output_dir = OUTPUT_ROOT / "slides"
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{datetime.now(UTC).strftime('%Y%m%d-%H%M%S')}-{_slugify(topic)}.html"
    path = output_dir / filename
    path.write_text(html_content, encoding="utf-8")

    return {
        "title": deck.get("title") or topic,
        "subtitle": deck.get("subtitle") or "",
        "style": preset["name"],
        "slideCount": len(deck.get("slides") or []),
        "html": html_content,
        "localPath": str(path),
        "createdAt": datetime.now(UTC).isoformat(),
    }


async def build_follow_builders_digest(
    cadence: DigestCadence = "daily",
    language: str = "zh",
    focus: str = "AI 产品、AI agent、开发者工具、可给内容团队带来效率提升的想法",
    limit_builders: int = 8,
) -> dict[str, Any]:
    feeds = await _fetch_follow_builder_feeds()
    raw_items = _extract_builder_items(feeds, limit_builders=max(3, min(limit_builders, 15)))
    digest = await _remix_follow_builders(raw_items, cadence, language, focus, feeds)
    if not digest:
        digest = _fallback_builders_digest(raw_items, cadence, focus, feeds)

    return {
        **digest,
        "cadence": cadence,
        "generatedAt": datetime.now(UTC).isoformat(),
        "feedGeneratedAt": feeds.get("generatedAt"),
        "stats": {
            "builders": len(feeds.get("x") or []),
            "items": len(raw_items),
            "podcasts": len(feeds.get("podcasts") or []),
            "blogs": len(feeds.get("blogs") or []),
        },
        "rawItems": raw_items[:20],
    }


async def _build_deck_with_deepseek(topic: str, outline: str, audience: str, slide_count: int) -> dict[str, Any]:
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key:
        return {}

    prompt = {
        "task": "Generate a viewport-safe HTML presentation content plan. Return JSON only.",
        "topic": topic,
        "outline": outline,
        "audience": audience,
        "slide_count": slide_count,
        "rules": [
            "Every slide must fit in one viewport.",
            "Split dense content into multiple slides.",
            "No more than 5 bullets per slide.",
            "Chinese output unless the user outline is mainly English.",
        ],
        "schema": {
            "title": "string",
            "subtitle": "string",
            "slides": [
                {
                    "kicker": "short label",
                    "title": "string",
                    "body": "short paragraph",
                    "bullets": ["3-5 short bullets"],
                    "speakerNotes": "optional short notes",
                }
            ],
        },
    }
    payload = {
        "model": os.getenv("DEEPSEEK_PRO_MODEL", "deepseek-v4-pro"),
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a senior presentation designer. Return valid JSON only. "
                    "Keep slide copy concise, visual, and presentation-ready."
                ),
            },
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
        "response_format": {"type": "json_object"},
        "max_tokens": 2400,
        "thinking": {"type": "enabled"},
        "reasoning_effort": "high",
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=70, trust_env=False) as client:
            response = await client.post(
                f"{os.getenv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com').rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"].get("content") or "{}"
    except httpx.HTTPError:
        return {}

    parsed = _parse_json_object(content)
    slides = parsed.get("slides")
    if not isinstance(slides, list) or not slides:
        return {}
    return parsed


async def _remix_follow_builders(
    raw_items: list[dict[str, Any]],
    cadence: str,
    language: str,
    focus: str,
    feeds: dict[str, Any],
) -> dict[str, Any]:
    api_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not api_key or not raw_items:
        return {}

    prompt = {
        "cadence": cadence,
        "language": language,
        "focus": focus,
        "feed_generated_at": feeds.get("generatedAt"),
        "items": raw_items[:18],
        "requirements": {
            "title": "Chinese digest title",
            "summary": "one short executive summary",
            "highlights": "5-8 items, each with title, why_it_matters, url, source, tags",
            "signals": "3-5 market or product signals",
            "actions": "3 practical actions for a Chinese children's content / AI video team",
        },
    }
    payload = {
        "model": os.getenv("DEEPSEEK_FLASH_MODEL", "deepseek-v4-flash"),
        "messages": [
            {
                "role": "system",
                "content": (
                    "You curate an AI builders digest for an internal creative technology team. "
                    "Never invent facts. Every highlight must preserve its original URL. Return JSON only."
                ),
            },
            {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
        ],
        "response_format": {"type": "json_object"},
        "max_tokens": 2200,
        "thinking": {"type": "disabled"},
    }
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=60, trust_env=False) as client:
            response = await client.post(
                f"{os.getenv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com').rstrip('/')}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"].get("content") or "{}"
    except httpx.HTTPError:
        return {}

    parsed = _parse_json_object(content)
    if not isinstance(parsed.get("highlights"), list):
        return {}
    return parsed


async def _fetch_follow_builder_feeds() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
        responses = await client.get(f"{FOLLOW_BUILDERS_RAW_BASE}/feed-x.json")
        responses.raise_for_status()
        x_feed = responses.json()

        podcasts: dict[str, Any] = {}
        blogs: dict[str, Any] = {}
        for name in ("feed-podcasts.json", "feed-blogs.json"):
            try:
                response = await client.get(f"{FOLLOW_BUILDERS_RAW_BASE}/{name}")
                if response.status_code == 200 and response.text.strip():
                    if name.startswith("feed-podcasts"):
                        podcasts = response.json()
                    else:
                        blogs = response.json()
            except (httpx.HTTPError, json.JSONDecodeError):
                pass

    return {
        "generatedAt": x_feed.get("generatedAt"),
        "lookbackHours": x_feed.get("lookbackHours"),
        "x": x_feed.get("x") or [],
        "podcasts": podcasts.get("podcasts") or podcasts.get("episodes") or [],
        "blogs": blogs.get("blogs") or blogs.get("articles") or [],
    }


def _extract_builder_items(feeds: dict[str, Any], limit_builders: int) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    builders = feeds.get("x") or []
    for builder in builders[:limit_builders]:
        tweets = builder.get("tweets") or []
        ranked = sorted(tweets, key=lambda item: int(item.get("likes") or 0), reverse=True)
        for tweet in ranked[:2]:
            text = str(tweet.get("text") or "").strip()
            url = str(tweet.get("url") or "").strip()
            if not text or not url:
                continue
            items.append(
                {
                    "type": "x",
                    "source": builder.get("name") or builder.get("handle") or "Builder",
                    "handle": builder.get("handle"),
                    "bio": builder.get("bio"),
                    "title": _compact_text(text, 80),
                    "text": _compact_text(text, 700),
                    "url": url,
                    "likes": tweet.get("likes") or 0,
                    "createdAt": tweet.get("createdAt"),
                }
            )

    for episode in (feeds.get("podcasts") or [])[:2]:
        url = str(episode.get("url") or episode.get("link") or "").strip()
        title = str(episode.get("title") or episode.get("name") or "").strip()
        if title and url:
            items.append(
                {
                    "type": "podcast",
                    "source": episode.get("podcast") or episode.get("name") or "Podcast",
                    "title": title,
                    "text": _compact_text(str(episode.get("transcript") or episode.get("description") or ""), 900),
                    "url": url,
                    "createdAt": episode.get("publishedAt") or episode.get("date"),
                }
            )
    return items


def _fallback_deck(topic: str, outline: str, audience: str, slide_count: int) -> dict[str, Any]:
    lines = [line.strip(" -#\t") for line in outline.splitlines() if line.strip()]
    if not lines:
        lines = [
            "为什么这个主题值得做",
            "现在市场上出现了什么变化",
            "我们可以怎样把它变成内容",
            "执行路径和风险",
        ]

    slides = [
        {
            "kicker": "OPENING",
            "title": topic,
            "body": f"面向{audience}的一份快速提案，把想法拆成能讨论、能评估、能执行的结构。",
            "bullets": ["核心问题", "市场信号", "内容机会"],
        }
    ]
    for index, line in enumerate(lines[: slide_count - 2], start=1):
        slides.append(
            {
                "kicker": f"PART {index:02d}",
                "title": line,
                "body": "把这一页当作可直接讨论的决策页：先看机会，再看证据，最后看行动。",
                "bullets": ["可验证的市场信号", "适合团队复用的创意角度", "下一步需要补齐的数据"],
            }
        )
    slides.append(
        {
            "kicker": "NEXT",
            "title": "下一步怎么推进",
            "body": "用小样片和快速调研验证题材，再决定是否进入正式制作。",
            "bullets": ["确定一个最小选题", "拉取竞品内容", "产出 1 个短样片脚本", "复盘数据后迭代"],
        }
    )
    return {"title": topic, "subtitle": "由芝兰点子王生成的 HTML 演示稿", "slides": slides}


def _fallback_builders_digest(
    raw_items: list[dict[str, Any]],
    cadence: str,
    focus: str,
    feeds: dict[str, Any],
) -> dict[str, Any]:
    highlights = [
        {
            "title": item["title"],
            "why_it_matters": _compact_text(item.get("text") or "", 140),
            "url": item["url"],
            "source": item["source"],
            "tags": [item["type"], "builder"],
        }
        for item in raw_items[:8]
    ]
    return {
        "title": "AI Builders 今日观察" if cadence == "daily" else "AI Builders 本周观察",
        "summary": f"已从 follow-builders 公开 feed 提取最新 builder 动态，重点关注：{focus}。",
        "highlights": highlights,
        "signals": ["AI builder 讨论重点正在向产品化、agent 工作流和真实效率工具集中。"],
        "actions": ["挑 1-2 条和内容生产有关的信号，转成内部小工具或选题实验。"],
        "feedGeneratedAt": feeds.get("generatedAt"),
    }


def _render_slides_html(deck: dict[str, Any], preset: dict[str, str]) -> str:
    slides = deck.get("slides") if isinstance(deck.get("slides"), list) else []
    slide_markup = "\n".join(_render_slide(slide, index, len(slides)) for index, slide in enumerate(slides, start=1))
    title = html.escape(str(deck.get("title") or "Presentation"))
    subtitle = html.escape(str(deck.get("subtitle") or ""))
    style = textwrap.dedent(
        f"""
        :root {{
          --bg: {preset['bg']};
          --fg: {preset['fg']};
          --muted: {preset['muted']};
          --accent: {preset['accent']};
          --panel: {preset['panel']};
          --title-font: {preset['font']};
          --body-font: {preset['body']};
          --title-size: clamp(2.2rem, 7vw, 7rem);
          --h2-size: clamp(1.8rem, 4.6vw, 4.6rem);
          --body-size: clamp(.95rem, 1.55vw, 1.35rem);
          --small-size: clamp(.72rem, 1vw, .9rem);
          --slide-padding: clamp(1rem, 5vw, 5rem);
          --content-gap: clamp(.75rem, 2vw, 2rem);
        }}
        * {{ box-sizing: border-box; }}
        html, body {{ height: 100%; overflow-x: hidden; margin: 0; }}
        html {{ scroll-snap-type: y mandatory; scroll-behavior: smooth; }}
        body {{ background: var(--bg); color: var(--fg); font-family: var(--body-font); }}
        .slide {{
          width: 100vw; height: 100vh; height: 100dvh; overflow: hidden;
          scroll-snap-align: start; display: flex; flex-direction: column; position: relative;
          background:
            radial-gradient(circle at 85% 18%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 32%),
            linear-gradient(135deg, color-mix(in srgb, var(--bg) 88%, white), var(--bg));
        }}
        .slide::after {{
          content: ""; position: absolute; inset: auto var(--slide-padding) clamp(1rem, 3vw, 2.5rem);
          height: 1px; background: color-mix(in srgb, var(--fg) 18%, transparent);
        }}
        .slide-content {{
          flex: 1; display: grid; align-content: center; gap: var(--content-gap);
          max-height: 100%; overflow: hidden; padding: var(--slide-padding);
        }}
        .kicker {{
          font-size: var(--small-size); letter-spacing: .18em; text-transform: uppercase; color: var(--accent);
          font-weight: 800;
        }}
        h1, h2 {{ margin: 0; font-family: var(--title-font); line-height: .94; letter-spacing: -0.04em; max-width: 13ch; }}
        h1 {{ font-size: var(--title-size); }}
        h2 {{ font-size: var(--h2-size); }}
        p {{ margin: 0; color: var(--muted); font-size: var(--body-size); line-height: 1.55; max-width: 66ch; }}
        ul {{ margin: 0; padding: 0; list-style: none; display: grid; gap: clamp(.45rem, 1.2vh, .9rem); max-width: min(82vw, 980px); }}
        li {{
          display: grid; grid-template-columns: auto 1fr; gap: .75rem; align-items: start;
          padding: clamp(.55rem, 1.3vw, 1rem); border-radius: 18px;
          background: var(--panel); border: 1px solid color-mix(in srgb, var(--fg) 12%, transparent);
          font-size: var(--body-size); line-height: 1.4;
        }}
        li::before {{ content: ""; width: .55rem; height: .55rem; margin-top: .45em; border-radius: 50%; background: var(--accent); }}
        .counter {{
          position: fixed; right: clamp(1rem, 2.5vw, 2rem); top: clamp(1rem, 2.5vw, 2rem);
          z-index: 10; font-size: var(--small-size); color: var(--muted);
          background: color-mix(in srgb, var(--bg) 68%, transparent); border: 1px solid color-mix(in srgb, var(--fg) 14%, transparent);
          border-radius: 999px; padding: .5rem .75rem; backdrop-filter: blur(12px);
        }}
        .progress {{ position: fixed; left: 0; bottom: 0; height: 4px; width: 100%; z-index: 20; background: color-mix(in srgb, var(--fg) 10%, transparent); }}
        .progress span {{ display: block; width: 0%; height: 100%; background: var(--accent); transition: width .25s ease; }}
        .hint {{ position: fixed; left: clamp(1rem, 2.5vw, 2rem); bottom: clamp(1rem, 2.5vw, 2rem); z-index: 10; font-size: var(--small-size); color: var(--muted); }}
        @media (max-height: 700px) {{ :root {{ --slide-padding: clamp(.8rem, 3vw, 2.5rem); --title-size: clamp(1.7rem, 5.2vw, 4.2rem); --h2-size: clamp(1.35rem, 3.8vw, 3rem); --body-size: clamp(.78rem, 1.25vw, 1rem); }} }}
        @media (max-height: 600px) {{ .hint {{ display: none; }} li {{ padding: .5rem .7rem; }} }}
        @media (max-width: 620px) {{ h1, h2 {{ max-width: 10ch; }} ul {{ max-width: 100%; }} }}
        @media (prefers-reduced-motion: reduce) {{ *, *::before, *::after {{ animation-duration: .01ms !important; transition-duration: .2s !important; }} html {{ scroll-behavior: auto; }} }}
        """
    )
    script = textwrap.dedent(
        """
        class DeckController {
          constructor() {
            this.slides = [...document.querySelectorAll('.slide')];
            this.index = 0;
            this.progress = document.querySelector('.progress span');
            this.counter = document.querySelector('.counter');
            window.addEventListener('keydown', (event) => {
              if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(event.key)) this.go(1);
              if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(event.key)) this.go(-1);
            });
            window.addEventListener('scroll', () => this.sync(), { passive: true });
            this.sync();
          }
          go(delta) {
            this.index = Math.max(0, Math.min(this.slides.length - 1, this.index + delta));
            this.slides[this.index].scrollIntoView({ behavior: 'smooth' });
          }
          sync() {
            let closest = 0;
            let distance = Infinity;
            this.slides.forEach((slide, index) => {
              const next = Math.abs(slide.getBoundingClientRect().top);
              if (next < distance) { distance = next; closest = index; }
            });
            this.index = closest;
            const percent = ((closest + 1) / this.slides.length) * 100;
            this.progress.style.width = percent + '%';
            this.counter.textContent = `${closest + 1} / ${this.slides.length}`;
          }
        }
        new DeckController();
        """
    )
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <style>{style}</style>
</head>
<body>
  <div class="counter">1 / {len(slides)}</div>
  <div class="hint">↑↓ / ←→ 切换页面</div>
  <div class="progress"><span></span></div>
  <main aria-label="{title} - {subtitle}">
{slide_markup}
  </main>
  <script>{script}</script>
</body>
</html>
"""


def _render_slide(slide: dict[str, Any], index: int, total: int) -> str:
    title_tag = "h1" if index == 1 else "h2"
    kicker = html.escape(str(slide.get("kicker") or f"{index:02d}/{total:02d}"))
    title = html.escape(str(slide.get("title") or "Untitled"))
    body = html.escape(str(slide.get("body") or ""))
    bullets = slide.get("bullets") if isinstance(slide.get("bullets"), list) else []
    bullet_markup = "\n".join(f"        <li>{html.escape(str(item))}</li>" for item in bullets[:6])
    body_markup = f"      <p>{body}</p>" if body else ""
    list_markup = f"      <ul>\n{bullet_markup}\n      </ul>" if bullet_markup else ""
    return f"""    <section class="slide" data-slide="{index}">
      <div class="slide-content">
        <div class="kicker">{kicker}</div>
        <{title_tag}>{title}</{title_tag}>
{body_markup}
{list_markup}
      </div>
    </section>"""


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9\u4e00-\u9fff]+", "-", value).strip("-").lower()
    return slug[:48] or "deck"


def _compact_text(value: str, limit: int) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    return normalized if len(normalized) <= limit else normalized[: limit - 1].rstrip() + "…"
