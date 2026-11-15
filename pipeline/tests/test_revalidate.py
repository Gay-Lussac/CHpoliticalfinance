import unittest
from unittest import mock

from chpf import revalidate


class Resp:
    def __init__(self, headers):
        self.headers = headers


class Validators(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch.object(revalidate.Validators, "__init__", lambda s: setattr(s, "_data", {}) or setattr(s, "_dirty", False))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_conditional_headers_only_with_a_copy(self):
        v = revalidate.Validators()
        v.remember("k", Resp({"etag": 'W/"abc-gzip"', "last-modified": "Thu, 29 Oct 2026 01:59:15 GMT"}))
        self.assertEqual(v.headers("k", have_copy=True),
                         {"If-None-Match": 'W/"abc"', "If-Modified-Since": "Thu, 29 Oct 2026 01:59:15 GMT"})
        self.assertEqual(v.headers("k", have_copy=False), {})
        self.assertEqual(v.headers("other", have_copy=True), {})


if __name__ == "__main__":
    unittest.main()
