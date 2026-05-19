import unittest
import httpx

from fastapi.testclient import TestClient

from zhilan_scraper.app import create_app
from zhilan_scraper.local_store import LocalStore


class FakeTinyFish:
    async def search(self, query: str, platform: str):
        return [
            {
                "id": f"{platform}:https://example.com/{platform}",
                "platform": platform,
                "title": f"{platform} result for {query}",
                "url": f"https://example.com/{platform}",
                "description": "TinyFish result",
            }
        ]

    async def fetch(self, urls: list[str]):
        return {url: f"# Clean content for {url}" for url in urls}


class FakeDaily:
    async def latest(self):
        return {
            "issueNumber": 83,
            "title": "AI 日报 2026-05-14",
            "date": "2026-05-14",
            "contentMarkdown": "## 今日重点",
            "url": "https://github.com/imjuya/juya-ai-daily/issues/83",
            "source": "GitHub Issues",
        }


class FakeYouTube:
    configured = True

    async def search(self, query: str, sort: str = "hot", time_range: str = "30d", limit: int = 20):
        return [
            {
                "id": "youtube:video-1",
                "platform": "youtube",
                "title": f"YouTube official result for {query}",
                "url": "https://www.youtube.com/watch?v=video-1",
                "description": "YouTube API result",
                "creatorName": "Official Channel",
                "viewCount": 123456,
                "publishedAt": "2026-05-14T00:00:00Z",
                "duration": "PT2M10S",
                "dataSource": "youtube-api",
            }
        ]


class FakeNoYouTube:
    configured = False

    async def search(self, query: str, sort: str = "hot", time_range: str = "30d", limit: int = 20):
        return []


class FakeTavily:
    configured = True

    async def search(self, query: str, time_range: str = "30d", limit: int = 10):
        return [
            {
                "id": "web:https://news.example.com/a",
                "platform": "web",
                "title": f"Tavily news for {query}",
                "url": "https://news.example.com/a",
                "description": "Tavily result",
                "creatorName": "news.example.com",
                "dataSource": "tavily",
            }
        ]


class FakeNoTavily:
    configured = False

    async def search(self, query: str, time_range: str = "30d", limit: int = 10):
        return []


class FakeBrief:
    configured = True

    async def build_brief(self, item: dict, fetched_content: str = "", mode: str = "auto"):
        return {
            "summary": "DeepSeek summary",
            "hook": "DeepSeek hook",
            "learn": "DeepSeek learn",
            "risk": "DeepSeek risk",
        }


class FakeNoBrief:
    configured = False

    async def build_brief(self, item: dict, fetched_content: str = "", mode: str = "auto"):
        raise AssertionError("FakeNoBrief should not be called when configured is False")


class FailingTinyFish(FakeTinyFish):
    async def search(self, query: str, platform: str):
        if platform == "douyin":
            raise httpx.HTTPStatusError(
                "boom",
                request=httpx.Request("GET", "https://api.search.tinyfish.ai"),
                response=httpx.Response(500),
            )
        return await super().search(query, platform)


class AppTest(unittest.TestCase):
    def test_search_returns_items_and_source_status(self):
        client = TestClient(
            create_app(tinyfish=FakeTinyFish(), daily=FakeDaily(), youtube=FakeNoYouTube(), tavily=FakeNoTavily(), brief=FakeNoBrief())
        )

        response = client.post(
            "/api/search",
            json={
                "query": "AI 漫剧",
                "platforms": ["web", "tiktok"],
                "limit": 5,
                "fetchTop": 1,
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["query"], "AI 漫剧")
        self.assertEqual(len(body["items"]), 2)
        self.assertIn("aiBrief", body["items"][0])
        self.assertEqual(body["items"][0]["briefSource"], "fetch")
        self.assertEqual([item["platform"] for item in body["items"]], ["web", "tiktok"])
        self.assertTrue(body["sourceStatus"]["web"].startswith("ok:"))
        self.assertTrue(body["sourceStatus"]["tiktok"].startswith("ok:"))
        self.assertIn("searchPlan", body)
        self.assertIn("insight", body)

    def test_search_uses_youtube_client_when_configured(self):
        client = TestClient(
            create_app(tinyfish=FakeTinyFish(), daily=FakeDaily(), youtube=FakeYouTube(), tavily=FakeNoTavily(), brief=FakeBrief())
        )

        response = client.post(
            "/api/search",
            json={
                "query": "AI 漫剧",
                "platforms": ["youtube", "web"],
                "limit": 5,
                "fetchTop": 1,
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["items"][0]["dataSource"], "youtube-api")
        self.assertEqual(body["items"][0]["viewCount"], 123456)
        self.assertEqual(body["items"][0]["aiBrief"]["summary"], "DeepSeek summary")
        self.assertEqual(body["items"][0]["briefModel"], "deepseek")
        self.assertTrue(body["sourceStatus"]["youtube"].startswith("ok: youtube-api"))

    def test_search_merges_tavily_for_web_results(self):
        client = TestClient(
            create_app(tinyfish=FakeTinyFish(), daily=FakeDaily(), youtube=FakeNoYouTube(), tavily=FakeTavily(), brief=FakeNoBrief())
        )

        response = client.post(
            "/api/search",
            json={
                "query": "AI 新闻",
                "platforms": ["web"],
                "limit": 5,
                "includeAiBrief": False,
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["items"][0]["dataSource"], "tavily")
        self.assertTrue(body["sourceStatus"]["web"].startswith("ok: tavily+tinyfish"))

    def test_search_continues_when_one_platform_fails(self):
        client = TestClient(
            create_app(tinyfish=FailingTinyFish(), daily=FakeDaily(), youtube=FakeNoYouTube(), tavily=FakeNoTavily(), brief=FakeNoBrief())
        )

        response = client.post(
            "/api/search",
            json={
                "query": "AI 漫剧",
                "platforms": ["youtube", "douyin", "web"],
                "limit": 5,
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["items"]), 2)
        self.assertTrue(body["sourceStatus"]["youtube"].startswith("ok:"))
        self.assertTrue(body["sourceStatus"]["douyin"].startswith("error:"))
        self.assertTrue(body["sourceStatus"]["web"].startswith("ok:"))

    def test_daily_latest_returns_normalized_issue(self):
        client = TestClient(
            create_app(tinyfish=FakeTinyFish(), daily=FakeDaily(), youtube=FakeNoYouTube(), tavily=FakeNoTavily(), brief=FakeNoBrief())
        )

        response = client.get("/api/daily/latest")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["source"], "GitHub Issues")

    def test_fetch_returns_clean_content_by_url(self):
        client = TestClient(
            create_app(tinyfish=FakeTinyFish(), daily=FakeDaily(), youtube=FakeNoYouTube(), tavily=FakeNoTavily(), brief=FakeNoBrief())
        )

        response = client.post(
            "/api/fetch",
            json={"urls": ["https://example.com/a", "https://example.com/b"]},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("https://example.com/a", response.json()["pages"])

    def test_login_and_ideas_endpoints(self):
        import tempfile
        from pathlib import Path

        temp_root = Path("C:/tmp")
        temp_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temp_root) as directory:
            store = LocalStore(Path(directory) / "state.json")
            client = TestClient(
                create_app(tinyfish=FakeTinyFish(), daily=FakeDaily(), youtube=FakeNoYouTube(), tavily=FakeNoTavily(), brief=FakeNoBrief(), store=store)
            )

            login = client.post("/api/auth/login", json={"email": "felix@company.com", "password": "demo1234"})
            created = client.post("/api/ideas", json={"title": "团队新点子", "desc": "先记下来", "author": "Felix", "avatar": "F"})
            listed = client.get("/api/ideas")

            self.assertEqual(login.status_code, 200)
            self.assertEqual(created.status_code, 200)
            self.assertEqual(listed.json()["items"][0]["title"], "团队新点子")


if __name__ == "__main__":
    unittest.main()
