import unittest

from zhilan_scraper.tinyfish_adapter import (
    build_platform_query,
    build_search_url,
    normalize_fetch_response,
    normalize_search_response,
    url_matches_platform,
)


class TinyFishAdapterTest(unittest.TestCase):
    def test_build_search_url_encodes_query(self):
        url = build_search_url("AI 漫剧 site:tiktok.com")

        self.assertEqual(
            url,
            "https://api.search.tinyfish.ai?query=AI+%E6%BC%AB%E5%89%A7+site%3Atiktok.com",
        )

    def test_build_platform_query_adds_platform_hint(self):
        query = build_platform_query("AI 漫剧", "youtube")

        self.assertEqual(query, "AI 漫剧 site:youtube.com OR site:youtu.be")

    def test_build_platform_query_preserves_explicit_site_query(self):
        query = build_platform_query("AI 漫剧 site:bilibili.com", "youtube")

        self.assertEqual(query, "AI 漫剧 site:bilibili.com")

    def test_url_matches_platform_filters_expected_domains(self):
        self.assertTrue(url_matches_platform("https://www.youtube.com/watch?v=1", "youtube"))
        self.assertTrue(url_matches_platform("https://b23.tv/a", "web"))
        self.assertFalse(url_matches_platform("https://www.google.com/", "bilibili"))

    def test_normalize_search_response_accepts_common_result_shapes(self):
        payload = {
            "results": [
                {
                    "title": "AI short drama trend",
                    "url": "https://example.com/a",
                    "snippet": "A useful summary",
                    "source": "Example",
                },
                {
                    "name": "Fallback title",
                    "link": "https://example.com/b",
                    "description": "Fallback snippet",
                },
            ]
        }

        items = normalize_search_response(payload, platform="web")

        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["title"], "AI short drama trend")
        self.assertEqual(items[0]["url"], "https://example.com/a")
        self.assertEqual(items[0]["description"], "A useful summary")
        self.assertEqual(items[0]["platform"], "web")
        self.assertEqual(items[1]["title"], "Fallback title")
        self.assertEqual(items[1]["url"], "https://example.com/b")

    def test_normalize_search_response_filters_wrong_platform_domain(self):
        payload = {
            "results": [
                {"title": "wrong", "url": "https://google.com/a"},
                {"title": "right", "url": "https://www.bilibili.com/video/BV1"},
            ]
        }

        items = normalize_search_response(payload, platform="bilibili")

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], "right")

    def test_normalize_fetch_response_extracts_markdown_by_url(self):
        payload = {
            "results": [
                {
                    "url": "https://example.com/a",
                    "markdown": "# Title\nUseful clean content",
                }
            ]
        }

        pages = normalize_fetch_response(payload)

        self.assertEqual(
            pages,
            {
                "https://example.com/a": "# Title\nUseful clean content",
            },
        )


if __name__ == "__main__":
    unittest.main()
