import unittest
from datetime import date

from chpf.parse import ParseError
from chpf.swissvotes import match, parse

HEADER = ("anr;datum;rechtsform;titel_off_f;titel_kurz_d;titel_kurz_f;titel_kurz_e;annahme;volkja-proz;bet;kt-ja;"
          "p-sps;p-svp\n")


def csv(*rows):
    return ("﻿" + HEADER + "".join(r + "\n" for r in rows)).encode()


class Parse(unittest.TestCase):
    def test_codes(self):
        body = csv("665;03.03.2024;3;Initiative populaire « Mieux vivre à la retraite »;13. AHV;13e rente AVS;13th pension;"
                   "1;58.25;58.36;15;1;2",
                   "693;29.11.2026;2;Modification de la loi sur le matériel de guerre;KMG;LFMG;War Materiel Act;.;;;;2;9999",
                   "100;01.01.1990;1;old;alt;vieux;old;0;40;40;0;1;1")
        b = parse(body, date(2024, 1, 1), ["sps", "svp"])
        self.assertEqual([x.anr for x in b], ["665", "693"])            # before `since` is skipped
        self.assertEqual((b[0].legal_form, b[0].outcome, str(b[0].yes_share)), ("popular_initiative", "accepted", "58.25"))
        self.assertEqual(b[0].recommendations, {"sps": "yes", "svp": "no"})
        self.assertEqual((b[1].outcome, b[1].yes_share), (None, None))  # not voted yet
        self.assertEqual(b[1].recommendations, {"sps": "no"})           # 9999 = organisation missing → no row
        self.assertEqual(b[1].titles["en"], "War Materiel Act")

    def test_unknown_code_rejected(self):
        with self.assertRaises(ParseError):
            parse(csv("665;03.03.2024;3;t;d;f;e;1;50;50;10;42;1"), date(2024, 1, 1), ["sps", "svp"])

    def test_missing_column_rejected(self):
        with self.assertRaises(ParseError):
            parse(csv("665;03.03.2024;3;t;d;f;e;1;50;50;10;1;1"), date(2024, 1, 1), ["sps", "svp", "fdp"])


class Match(unittest.TestCase):
    def test_initiative_counter_proposal_and_neighbours(self):
        body = csv(
            "682.1;08.03.2026;3;Initiative populaire « Oui à une monnaie suisse libre et indépendante sous forme de pièces ou de billets »;x;Initiative sur l'argent liquide;x;0;45;55;9;1;1",
            "682.2;08.03.2026;4;Arrêté fédéral sur la monnaie suisse et l’approvisionnement en numéraire;x;Arrêté sur la monnaie;x;1;73;55;23;1;1",
            "683;08.03.2026;3;Initiative populaire « 200 francs, ça suffit ! (initiative SSR) »;x;Initiative SSR;x;0;38;55;0;2;1")
        votes = [(23, date(2026, 3, 8), "Oui à une monnaie suisse libre et indépendante sous forme de pièces ou de billets "
                                        "et contre-projet direct, à savoir l’arrêté fédéral sur la monnaie suisse et "
                                        "l’approvisionnement en numéraire"),
                 (24, date(2026, 3, 8), "200 francs, ça suffit ! (initiative SSR)")]
        mapping, problems = match(parse(body, date(2024, 1, 1), ["sps", "svp"]), votes)
        self.assertEqual(mapping, {"682.1": 23, "682.2": 23, "683": 24})
        self.assertEqual(problems, [])


if __name__ == "__main__":
    unittest.main()
