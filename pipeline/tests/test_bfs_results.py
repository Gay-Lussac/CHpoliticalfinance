import unittest
from datetime import date

from chpf import bfs_results as bfs


class FakeArchive:
    def __init__(self, payload):
        self.payload = payload

    def load(self, lang, path):
        return self.payload if path == "eidg/20260308" else None


PAYLOAD = {"schweiz": {"vorlagen": [
    {"vorlagenId": 6821, "provisorisch": False, "kantone": [
        {"geoLevelnummer": "1", "resultat": {"jaStimmenInProzent": 39.97, "jaStimmenAbsolut": 238179,
                                               "neinStimmenAbsolut": 357691, "stimmbeteiligungInProzent": 61.02}},
        {"geoLevelnummer": "26", "resultat": {"jaStimmenInProzent": None}}]},
    {"vorlagenId": 6830, "provisorisch": True, "kantone": []}]}}


class CantonResults(unittest.TestCase):
    def test_ballot_id_is_swissvotes_number_times_ten(self):
        rows = bfs.canton_results(FakeArchive(PAYLOAD), date(2026, 3, 8), "682.1")
        self.assertEqual(rows, [{"canton": "ZH", "yes_share": 39.97, "yes": 238179, "no": 357691, "turnout": 61.02,
                                 "provisional": False}])

    def test_missing_ballot_or_day(self):
        self.assertEqual(bfs.canton_results(FakeArchive(PAYLOAD), date(2026, 3, 8), "690"), [])
        self.assertEqual(bfs.canton_results(FakeArchive(PAYLOAD), date(2025, 1, 1), "682.1"), [])

    def test_codes(self):
        self.assertEqual((bfs.CANTONS[1], bfs.CANTONS[26], len(bfs.CANTONS)), ("ZH", "JU", 26))


if __name__ == "__main__":
    unittest.main()
