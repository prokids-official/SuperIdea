import unittest
from datetime import datetime, timezone

from zhilan_scraper.youtube_adapter import normalize_youtube_items, published_after, youtube_order


class YouTubeAdapterTest(unittest.TestCase):
    def test_youtube_order_maps_sort_modes(self):
        self.assertEqual(youtube_order("views"), "viewCount")
        self.assertEqual(youtube_order("new"), "date")
        self.assertEqual(youtube_order("hot"), "relevance")

    def test_published_after_builds_utc_window(self):
        now = datetime(2026, 5, 14, 12, 0, tzinfo=timezone.utc)

        self.assertEqual(published_after("7d", now), "2026-05-07T12:00:00Z")
        self.assertIsNone(published_after("all", now))

    def test_normalize_youtube_items_merges_search_and_video_details(self):
        search_payload = {
            "items": [
                {
                    "id": {"videoId": "abc"},
                    "snippet": {
                        "title": "AI Short Drama",
                        "description": "Video intro",
                        "channelTitle": "Studio",
                        "channelId": "channel-1",
                        "publishedAt": "2026-05-14T00:00:00Z",
                        "thumbnails": {"high": {"url": "https://img.example/a.jpg"}},
                    },
                }
            ]
        }
        videos_payload = {
            "items": [
                {
                    "id": "abc",
                    "statistics": {"viewCount": "120000", "likeCount": "3400", "commentCount": "56"},
                    "contentDetails": {"duration": "PT3M12S"},
                }
            ]
        }

        items = normalize_youtube_items(search_payload, videos_payload)

        self.assertEqual(items[0]["platform"], "youtube")
        self.assertEqual(items[0]["url"], "https://www.youtube.com/watch?v=abc")
        self.assertEqual(items[0]["viewCount"], 120000)
        self.assertEqual(items[0]["duration"], "PT3M12S")
        self.assertEqual(items[0]["dataSource"], "youtube-api")


if __name__ == "__main__":
    unittest.main()
