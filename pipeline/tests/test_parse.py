import unittest
from datetime import date
from decimal import Decimal

from chpf.parse import (Allowance, Cantons, FormRef, ParseError, Parties, chf, classify_form, donor_match_key,
                        parse_candidates, parse_detail, split_actor_label, split_dated_label)


class Amounts(unittest.TestCase):
    def test_chf_formats(self):
        self.assertEqual(chf("CHF 1'234.50"), Decimal("1234.50"))
        self.assertEqual(chf("2'000'000.00"), Decimal("2000000.00"))
        self.assertEqual(chf("CHF 0.00"), Decimal("0"))
        self.assertEqual(chf("-CHF 12.00"), Decimal("-12.00"))

    def test_chf_rejects_garbage(self):
        with self.assertRaises(ParseError):
            chf("about 5k")


class Labels(unittest.TestCase):
    def test_dated_label(self):
        self.assertEqual(split_dated_label("27.09.2026 Sauvegarder la neutralité"), (date(2026, 9, 27), "Sauvegarder la neutralité"))

    def test_actor_label(self):
        self.assertEqual(split_actor_label("Die Mitte Kanton Zug, Zug"), ("Die Mitte Kanton Zug", "Zug"))

    def test_candidates(self):
        c = parse_candidates("…suivant(e-s): Hensch Anne-Claude (Zurich, Autres partis politiques), "
                             "Weichelt Manuela (Zoug, Les VERT-E-S suisses)", Cantons())
        self.assertEqual([(x.full_name, x.canton) for x in c], [("Hensch Anne-Claude", "ZH"), ("Weichelt Manuela", "ZG")])


class PartyMatching(unittest.TestCase):
    def setUp(self):
        self.p = Parties()

    def test_parties(self):
        cases = {
            "Parti vert'libéral": "GLP", "Les VERT-E-S suisses": "GRUENE", "Union Démocratique du Centre": "SVP",
            "Evangelische Volkspartei der Schweiz": "EVP", "Le Centre": "MITTE", "PLR.Les Libéraux-Radicaux": "FDP",
            "Sozialdemokratische Partei der Schweiz": "SP", "Centre Patronal": None, "Operation Libero": None,
        }
        for text, code in cases.items():
            self.assertEqual(self.p.match(text), code, text)


class Forms(unittest.TestCase):
    def ref(self, label, kind="vote"):
        return FormRef((kind, 1), 1, 10, 111, label, kind != "party_year")

    def test_classify(self):
        self.assertEqual(classify_form(self.ref("Déclaration des recettes budgétées"), []), ("budget", "totals"))
        self.assertEqual(classify_form(self.ref("Déclaration du décompte final des recettes"), []), ("final", "totals"))
        self.assertEqual(classify_form(self.ref("Déclaration de libéralités supérieures à 15 000 francs (décompte final)"), []),
                         ("final", "allowances"))
        self.assertEqual(classify_form(self.ref("Déclaration des recettes annuelles", "party_year"), []), ("annual", "totals"))
        with self.assertRaises(ParseError):
            classify_form(self.ref("Something new"), [])

    def test_allowances_detail(self):
        payload = {"data": {"form_data": {"allowances": {
            "natural_monetary": [{"natural_first_name": "A", "natural_name": "B", "natural_city": "Bern",
                                  "living_abroad": False, "value": "20'000.00", "date": "01.02.2026"}],
            "juristic_non_monetary": [{"juristic_name": "X AG", "juristic_city": "Zug", "service_type": "Services",
                                       "service_description": "ads", "value": "16'000.00", "date": "03.02.2026"}]}}}}
        d = parse_detail(self.ref("Déclaration de libéralités supérieures à 15 000 francs"), "budget", "allowances", payload, "x")
        self.assertEqual([(a.donor_type, a.nature, a.value) for a in d.allowances],
                         [("natural", "monetary", Decimal("20000.00")), ("legal", "non_monetary", Decimal("16000.00"))])
        self.assertEqual(donor_match_key(d.allowances[1]), "legal|x ag")

    def test_unknown_allowance_group_rejected(self):
        payload = {"data": {"form_data": {"allowances": {"martian_monetary": []}}}}
        with self.assertRaises(ParseError):
            parse_detail(self.ref("Déclaration de libéralités"), "budget", "allowances", payload, "x")


if __name__ == "__main__":
    unittest.main()
