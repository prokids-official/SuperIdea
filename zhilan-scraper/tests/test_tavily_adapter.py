import unittest

from zhilan_scraper.tavily_adapter import normalize_tavily_response, tavily_time_range


class TavilyAdapterTest(unittest.TestCase):
    def test_tavily_time_range_maps_ui_ranges(self):
        self.assertEqual(tavily_time_range("24h"), "day")
        self.assertEqual(tavily_time_range("7d"), "week")
        self.assertEqual(tavily_time_range("30d"), "month")
        self.assertIsNone(tavily_time_range("all"))

    def test_normalize_tavily_response(self):
        payload = {
            "results": [
                {
                    "title": "AI news",
                    "url": "https://example.com/news/a",
                    "content": "Useful news snippet",
                    "score": 0.9,
                    "favicon": "https://example.com/favicon.ico",
                }
            ]
        }

        items = normalize_tavily_response(payload)

        self.assertEqual(items[0]["platform"], "web")
        self.assertEqual(items[0]["description"], "Useful news snippet")
        self.assertEqual(items[0]["creatorName"], "example.com")
        self.assertEqual(items[0]["dataSource"], "tavily")


if __name__ == "__main__":
    unittest.main()
