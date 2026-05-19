import tempfile
import unittest
from pathlib import Path

from zhilan_scraper.local_store import LocalStore, hash_password, verify_password


class LocalStoreTest(unittest.TestCase):
    def test_password_hash_roundtrip(self):
        stored = hash_password("demo1234")

        self.assertTrue(verify_password("demo1234", stored))
        self.assertFalse(verify_password("wrong", stored))

    def test_login_and_create_idea(self):
        temp_root = Path("C:/tmp")
        temp_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temp_root) as directory:
            store = LocalStore(Path(directory) / "state.json")

            user = store.login("felix@company.com", "demo1234")
            idea = store.create_idea("新点子", "说明", "Felix", "F")

            self.assertEqual(user["name"], "Felix")
            self.assertEqual(store.list_ideas()[0]["id"], idea["id"])
            self.assertEqual(store.list_ideas()[0]["title"], "新点子")


if __name__ == "__main__":
    unittest.main()
