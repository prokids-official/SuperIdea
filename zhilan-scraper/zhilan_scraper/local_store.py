from __future__ import annotations

import hashlib
import json
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


HASH_ITERATIONS = int(os.getenv("ZHILAN_PASSWORD_HASH_ITERATIONS", "12000"))

DEFAULT_IDEAS = [
    {
        "id": "dreams",
        "title": "统计全公司所有人做过的梦，并用 AI 实现",
        "author": "Felix",
        "avatar": "F",
        "desc": "全员匿名提交一段最近做过的梦，由 AI 团队批量生成画面，剪成一支 90 秒的荒诞短片。",
        "status": "open",
        "statusLabel": "开放中",
        "likes": 38,
        "comments": 12,
        "saves": 9,
        "tags": ["实验视频", "团队叙事", "AI 漫剧"],
        "hot": True,
        "market": {"count": 6, "top": "3.5M", "chance": "中等"},
    },
    {
        "id": "villain",
        "title": "格林童话里的反派开了一家公司",
        "author": "内容策划组",
        "avatar": "策",
        "desc": "把经典童话反派放进现代办公室，用 AI 漫剧做轻喜剧，适合系列化。",
        "status": "claimed",
        "statusLabel": "已认领 · 子萌",
        "likes": 52,
        "comments": 24,
        "saves": 18,
        "tags": ["AI 漫剧", "格林童话", "轻喜剧"],
        "hot": True,
        "market": {"count": 18, "top": "2.8M", "chance": "高"},
    },
    {
        "id": "robot",
        "title": "给孩子解释 AI：如果机器人也要上幼儿园",
        "author": "运营同事",
        "avatar": "运",
        "desc": "用拟人化小机器人讲 AI 基础概念，降低技术理解门槛，也能做成知识短剧。",
        "status": "producing",
        "statusLabel": "制作中",
        "likes": 27,
        "comments": 8,
        "saves": 14,
        "tags": ["儿童科普", "AI 工具", "系列栏目"],
        "market": {"count": 2, "top": "1.2M", "chance": "高"},
    },
]


class LocalStore:
    def __init__(self, path: Path | None = None) -> None:
        data_dir = Path(os.getenv("ZHILAN_DATA_DIR", Path.cwd() / "data"))
        self.path = path or data_dir / "zhilan_state.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._write(self._seed_state())

    def login(self, email: str, password: str) -> dict[str, str] | None:
        state = self._read()
        user = next((item for item in state["users"] if item["email"].lower() == email.lower()), None)
        if not user or not verify_password(password, user["passwordHash"]):
            return None
        return {"email": user["email"], "name": user["name"], "avatar": user["avatar"]}

    def list_ideas(self) -> list[dict[str, Any]]:
        return self._read()["ideas"]

    def create_idea(self, title: str, desc: str, author: str, avatar: str) -> dict[str, Any]:
        state = self._read()
        idea = {
            "id": f"local-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "title": title,
            "author": author,
            "avatar": avatar,
            "desc": desc,
            "status": "open",
            "statusLabel": "开放中",
            "likes": 0,
            "comments": 0,
            "saves": 0,
            "tags": ["新点子"],
            "hot": False,
            "market": None,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        state["ideas"].insert(0, idea)
        self._write(state)
        return idea

    def _seed_state(self) -> dict[str, Any]:
        email = os.getenv("ZHILAN_ADMIN_EMAIL", "felix@company.com")
        password = os.getenv("ZHILAN_ADMIN_PASSWORD", "demo1234")
        name = os.getenv("ZHILAN_ADMIN_NAME", "Felix")
        return {
            "users": [
                {
                    "email": email,
                    "name": name,
                    "avatar": name[:1].upper() or "F",
                    "passwordHash": hash_password(password),
                }
            ],
            "ideas": DEFAULT_IDEAS,
        }

    def _read(self) -> dict[str, Any]:
        with self.path.open("r", encoding="utf-8") as file:
            return json.load(file)

    def _write(self, state: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as file:
            json.dump(state, file, ensure_ascii=False, indent=2)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), HASH_ITERATIONS).hex()
    return f"pbkdf2_sha256${HASH_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        parts = stored.split("$")
    except ValueError:
        return False
    if len(parts) == 3:
        algorithm, salt, expected = parts
        iterations = HASH_ITERATIONS
    elif len(parts) == 4:
        algorithm, iterations_raw, salt, expected = parts
        try:
            iterations = int(iterations_raw)
        except ValueError:
            return False
    else:
        return False
    if algorithm != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), iterations).hex()
    return secrets.compare_digest(digest, expected)
