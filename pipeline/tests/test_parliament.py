import unittest

from chpf.parliament import FinalVote, _date, pick


def vote(vid, yes, no, abstain=0):
    rows = [{"decision": "yes"}] * yes + [{"decision": "no"}] * no + [{"decision": "abstain"}] * abstain
    return FinalVote(vid, "24.080", "Vote final", None, None, rows)


class Pick(unittest.TestCase):
    def test_law_counts_match_directly(self):
        v, inverted, note = pick([vote(1, 101, 93)], 101, 93)
        self.assertEqual((v.id, inverted, note), (1, False, "ok"))

    def test_initiative_counts_are_reversed(self):
        v, inverted, _ = pick([vote(1, 131, 50, 18)], 50, 131)
        self.assertEqual((v.id, inverted), (1, True))

    def test_right_bill_among_several_final_votes(self):
        v, inverted, _ = pick([vote(1, 179, 15), vote(2, 183, 7)], 183, 7)
        self.assertEqual((v.id, inverted), (2, False))

    def test_small_difference_tolerated_large_rejected(self):
        self.assertEqual(pick([vote(1, 100, 90)], 101, 90)[0].id, 1)
        self.assertIsNone(pick([vote(1, 100, 90)], 120, 70)[0])
        self.assertIsNone(pick([], 100, 90)[0])
        self.assertIsNone(pick([vote(1, 100, 90)], None, None)[0])

    def test_odata_date(self):
        self.assertEqual(_date("/Date(1790934036907)/").year, 2026)
        self.assertIsNone(_date(None))


if __name__ == "__main__":
    unittest.main()
