import unittest

from zhilan_scraper.deepseek_client import DeepSeekClient, _parse_json_object


class DeepSeekClientTest(unittest.TestCase):
    def test_choose_model_uses_flash_for_light_brief(self):
        client = DeepSeekClient(api_key="x", flash_model="flash", pro_model="pro")

        self.assertEqual(client.choose_model({"description": "short"}, "", "auto"), "flash")

    def test_choose_model_uses_pro_for_long_context(self):
        client = DeepSeekClient(api_key="x", flash_model="flash", pro_model="pro")

        self.assertEqual(client.choose_model({}, "x" * 1000, "auto"), "pro")

    def test_parse_json_object_accepts_plain_json(self):
        self.assertEqual(_parse_json_object('{"summary":"ok"}'), {"summary": "ok"})

    def test_parse_json_object_accepts_fenced_json(self):
        self.assertEqual(_parse_json_object('```json\n{"summary":"ok"}\n```'), {"summary": "ok"})


if __name__ == "__main__":
    unittest.main()
