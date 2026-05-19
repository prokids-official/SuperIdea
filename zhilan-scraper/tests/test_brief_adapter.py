import unittest

from zhilan_scraper.brief_adapter import build_ai_brief


class BriefAdapterTest(unittest.TestCase):
    def test_build_ai_brief_uses_title_and_description(self):
        brief = build_ai_brief(
            {
                "title": "用 AI 重拍小红帽，但结局完全反转",
                "description": "经典童话被改成悬念短片，前 5 秒直接抛出冲突。",
                "platform": "web",
            }
        )

        self.assertIn("小红帽", brief["summary"])
        self.assertIn("反转", brief["hook"])
        self.assertIn("AI 漫剧", brief["learn"])
        self.assertIn("验证", brief["risk"])

    def test_build_ai_brief_handles_empty_description(self):
        brief = build_ai_brief({"title": "AI 漫剧制作教程", "platform": "tiktok"})

        self.assertEqual(set(brief.keys()), {"summary", "hook", "learn", "risk"})
        self.assertTrue(brief["summary"])


if __name__ == "__main__":
    unittest.main()
