import unittest

from zhilan_scraper.daily_adapter import normalize_github_issue


class DailyAdapterTest(unittest.TestCase):
    def test_normalize_github_issue_preserves_markdown_and_date(self):
        item = normalize_github_issue(
            {
                "number": 83,
                "title": "AI 日报 2026-05-14",
                "body": "## 今日重点\n- 视频模型更新",
                "html_url": "https://github.com/imjuya/juya-ai-daily/issues/83",
                "created_at": "2026-05-14T02:30:00Z",
                "updated_at": "2026-05-14T03:00:00Z",
            }
        )

        self.assertEqual(item["issueNumber"], 83)
        self.assertEqual(item["date"], "2026-05-14")
        self.assertEqual(item["contentMarkdown"], "## 今日重点\n- 视频模型更新")
        self.assertEqual(item["source"], "GitHub Issues")


if __name__ == "__main__":
    unittest.main()
