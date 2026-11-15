import io
import unittest
import zipfile

from chpf import lobbywatch as lw
from chpf.parse import ParseError, Parties


def _zip(tables: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, rows in tables.items():
            header = list(rows[0])
            lines = ["\t".join(header)] + ["\t".join(str(r[h]) for h in header) for r in rows]
            zf.writestr(f"export/flat_{name}.csv", "\n".join(lines))
    return buf.getvalue()


PARL = {"id": 1, "nachname": "Gössi", "vorname": "Petra", "vorname_kurz": "", "kanton": "SZ", "rat": "SR", "partei": "FDP",
        "partei_name": "FDP.Die Liberalen", "im_rat_seit": "2011-12-05"}
TIE = {"id": 10, "parlamentarier_id": 1, "organisation_id": 100, "art": "vorstand", "funktion_im_gremium": "praesident",
       "beschreibung": "", "beschreibung_fr": "", "deklarationstyp": "deklarationspflichtig", "hauptberuflich": "0",
       "von": "", "bis": ""}
OLD_TIE = {**TIE, "id": 11, "organisation_id": 101, "bis": "2020-01-01"}
YEARS = [{"interessenbindung_id": 10, "jahr": 2025, "verguetung": 0}, {"interessenbindung_id": 10, "jahr": 2026, "verguetung": 1}]
ORG = {"id": 100, "name_de": "GastroSuisse", "name_fr": "", "name_it": "", "ort": "Zürich", "rechtsform": "Verein",
       "interessengruppe_id": 5, "abkuerzung_de": "", "abkuerzung_fr": ""}
GROUP = {"id": 5, "name": "Gastronomie", "name_fr": "Restauration"}


class Parse(unittest.TestCase):
    def test_current_ties_latest_pay(self):
        ex = lw.parse(_zip({"parlamentarier": [PARL], "interessenbindung": [TIE, OLD_TIE], "interessenbindung_jahr": YEARS,
                            "organisation": [ORG, {**ORG, "id": 101, "name_de": "Old"}], "interessengruppe": [GROUP]}), Parties())
        self.assertEqual([p.party_code for p in ex.parliamentarians], ["FDP"])
        self.assertEqual([(t.id, t.pay_year, t.pay) for t in ex.ties], [(10, 2026, 1)])      # ended tie dropped
        self.assertEqual([(o.id, o.lobby_group_fr) for o in ex.organisations], [(100, "Restauration")])

    def test_missing_column_or_table_fails_loudly(self):
        with self.assertRaises(ParseError):
            lw.parse(_zip({"parlamentarier": [{k: v for k, v in PARL.items() if k != "kanton"}]}), Parties())


class Matching(unittest.TestCase):
    def test_org_key(self):
        self.assertEqual(lw.org_key("Société Suisse des Entrepreneurs (SSE)"), lw.org_key("Société suisse des entrepreneurs"))
        self.assertEqual(lw.org_key("Automobil Club der Schweiz, ACS"), lw.org_key("Automobil Club der Schweiz"))
        self.assertEqual(lw.org_key("Proviande Genossenschaft"), lw.org_key("Proviande"))

    def test_organisations_only_unambiguous(self):
        orgs = [lw.Organisation(1, "GastroSuisse", None, None, None, None, None, None),
                lw.Organisation(2, "Pro X", None, None, None, None, None, None),
                lw.Organisation(3, "Pro X AG", None, None, None, None, None, None)]
        self.assertEqual(lw.match_organisations(orgs, [(7, "Gastrosuisse"), (8, "Pro X")]), {1: 7})

    def test_parliamentarians(self):
        people = [lw.Parliamentarian(1, "Ruch", "Daniel", "VD", "NR", None, None, None),
                  lw.Parliamentarian(2, "Thalmann-Bieri", "Veronika", "LU", "NR", None, None, None, "Vroni"),
                  lw.Parliamentarian(3, "Muster", "Hans", "BE", "NR", None, None, None)]
        cands = [(10, "Ruch Daniel", "VD"), (11, "Daniel Ruch", "VD"), (12, "Thalmann-Bieri Vroni", "LU"),
                 (13, "Muster Hans", "ZH")]
        self.assertEqual(lw.match_parliamentarians(people, cands), {1: [10, 11], 2: [12]})


if __name__ == "__main__":
    unittest.main()
