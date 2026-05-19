import unittest

from zhilan_scraper.query_planner import build_search_plan, filter_and_rank_items, score_item


class QueryPlannerTest(unittest.TestCase):
    def test_ai_manjv_plan_expands_chinese_and_english_terms(self):
        plan = build_search_plan("AI 漫剧", ["youtube", "bilibili", "tiktok"])

        self.assertEqual(plan["intent"], "ai_story_video")
        self.assertIn("AI animated series", plan["enTerms"])
        self.assertIn("AI 动画短剧", plan["zhTerms"])
        self.assertIn("AI zombie animation", plan["topicProbes"])
        self.assertIn("youtube", plan["platformQueries"])

    def test_ai_story_gate_rejects_non_ai_animation(self):
        score = score_item(
            {
                "platform": "youtube",
                "title": "Cute fairy tale cartoon for kids",
                "description": "A normal animated story with no generative process.",
            },
            "AI 漫剧",
        )

        self.assertFalse(score["passesAiStoryGate"])

    def test_ai_story_gate_keeps_ai_generated_story_video(self):
        score = score_item(
            {
                "platform": "youtube",
                "title": "AI generated zombie animation short film",
                "description": "Cinematic AI story made with Runway and Kling.",
                "viewCount": 1200000,
                "publishedAt": "2026-05-18T00:00:00+00:00",
            },
            "AI 漫剧",
        )

        self.assertTrue(score["passesAiStoryGate"])
        self.assertGreaterEqual(score["opportunityScore"], 70)
        self.assertIn("zombie", score["topicTags"])

    def test_ai_story_gate_rejects_tutorials_by_default(self):
        score = score_item(
            {
                "platform": "bilibili",
                "title": "AI漫剧制作全教程 AI视频生成 工作流 提示词",
                "description": "零基础小白也能学会制作AI漫剧。",
            },
            "AI 漫剧",
        )

        self.assertFalse(score["passesAiStoryGate"])
        self.assertEqual(score["contentIntent"], "tutorial")
        self.assertIn("教程", score["negativeSignals"])

    def test_tutorial_query_can_keep_tutorial_results(self):
        score = score_item(
            {
                "platform": "bilibili",
                "title": "AI漫剧制作全教程 AI视频生成 工作流 提示词",
                "description": "零基础小白也能学会制作AI漫剧。",
            },
            "AI 漫剧 教程",
        )

        self.assertTrue(score["passesAiStoryGate"])

    def test_filter_and_rank_sorts_by_opportunity(self):
        items = [
            {
                "platform": "youtube",
                "title": "AI generated animation story",
                "url": "https://example.com/low",
                "description": "AI story animation",
                "viewCount": 100,
            },
            {
                "platform": "youtube",
                "title": "AI generated cinematic animation short film",
                "url": "https://example.com/high",
                "description": "Runway AI animation short film with strong story",
                "viewCount": 900000,
            },
        ]

        ranked = filter_and_rank_items(items, "AI 漫剧", "hot", 10)

        self.assertEqual(ranked[0]["url"], "https://example.com/high")
        self.assertEqual(ranked[0]["rank"], 1)


if __name__ == "__main__":
    unittest.main()
