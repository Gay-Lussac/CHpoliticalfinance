"""Turn archived EFK payloads into typed records. Pure functions, no DB access.

Principle: reject rather than guess. Anything unexpected raises ParseError; the caller
records it in the run report and skips that declaration.
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

import yaml

from . import settings


class ParseError(ValueError):
    pass


# ----------------------------------------------------------------- helpers

def fold(s: str) -> str:
    """Lower-case, strip accents, normalise quotes/whitespace (used for matching, never displayed)."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.replace("’", "'").replace("`", "'").lower()
    return re.sub(r"\s+", " ", s).strip()


_CHF = re.compile(r"^(-)?\s*(?:CHF)?\s*(-)?\s*([\d']+(?:\.\d+)?)$")


def chf(value) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    m = _CHF.match(str(value).strip())
    if not m:
        raise ParseError(f"not a CHF amount: {value!r}")
    try:
        amount = Decimal(m.group(3).replace("'", ""))
    except InvalidOperation as e:
        raise ParseError(f"not a CHF amount: {value!r}") from e
    return -amount if (m.group(1) or m.group(2)) else amount


def ch_date(value) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(str(value).strip(), "%d.%m.%Y").date()
    except ValueError as e:
        raise ParseError(f"not a dd.mm.yyyy date: {value!r}") from e


_DATED_LABEL = re.compile(r"^(\d{2}\.\d{2}\.\d{4})\s+(.*)$", re.S)


def split_dated_label(label: str) -> tuple[date | None, str]:
    m = _DATED_LABEL.match(label.strip())
    if not m:
        return None, label.strip()
    return ch_date(m.group(1)), m.group(2).strip()


def split_actor_label(label: str) -> tuple[str, str | None]:
    """'Die Mitte Kanton Zug, Zug' -> ('Die Mitte Kanton Zug', 'Zug')."""
    if ", " in label:
        name, city = label.rsplit(", ", 1)
        return name.strip(), city.strip()
    return label.strip(), None


# ----------------------------------------------------------------- reference data

class Cantons:
    def __init__(self):
        raw = yaml.safe_load((settings.CONFIG_DIR / "cantons.yaml").read_text())
        self._by_name = {}
        for code, names in raw.items():
            self._by_name[fold(code)] = code
            for n in names:
                self._by_name[fold(n)] = code

    def code(self, name: str | None) -> str | None:
        if not name:
            return None
        return self._by_name.get(fold(name))


@dataclass
class PartyDef:
    code: str
    color: str
    names: dict
    patterns: list


class Parties:
    def __init__(self):
        raw = yaml.safe_load((settings.CONFIG_DIR / "parties.yaml").read_text())
        self.exclude = [re.compile(p) for p in raw.get("exclude", [])]
        self.defs = [PartyDef(p["code"], p["color"], p["names"], [re.compile(x) for x in p["patterns"]])
                     for p in raw["parties"]]

    def match(self, text: str | None) -> str | None:
        if not text:
            return None
        t = fold(text)
        if any(x.search(t) for x in self.exclude):
            return None
        for d in self.defs:
            if any(p.search(t) for p in d.patterns):
                return d.code
        return None

    @staticmethod
    def level(actor_name: str) -> str:
        t = fold(actor_name)
        if re.search(r"\bjung|\bjeunes?\b|\bgiovani\b|\bjuso\b|\bjsvp\b|\bjglp\b", t):
            return "youth"
        if re.search(r"schweiz|suisse|svizzer|\bch\b", t) and not re.search(r"kanton|canton|cantonal|sektion|section", t):
            return "national"
        return "cantonal"


# ----------------------------------------------------------------- records

@dataclass
class Financing:
    kind: str                      # vote | election | party_year
    efk_id: int
    event_date: date | None
    year: int
    name: str                      # fr title (fallback)
    titles: dict = field(default_factory=dict)   # lang -> title
    council: str | None = None     # elections
    canton: str | None = None      # elections (None = general election)
    object_type: str | None = None # votes

    @property
    def key(self) -> tuple[str, int]:
        return (self.kind, self.efk_id)


@dataclass
class Actor:
    efk_id: int
    name: str
    city: str | None
    actor_type: str                # legal_entity | natural_person | other
    canton: str | None = None


@dataclass
class Candidate:
    full_name: str
    canton: str | None
    party_label: str | None


@dataclass
class Campaign:
    efk_id: int
    financing_key: tuple
    actor_efk_id: int
    stance: str                    # for | against | candidates | none
    name: str
    candidates: list = field(default_factory=list)


@dataclass
class FormRef:
    """A declaration as seen in the tree (before its detail is fetched)."""
    financing_key: tuple
    actor_efk_id: int
    campaign_efk_id: int           # EFK campaign id (also for party years)
    form_efk_id: int
    label: str
    in_campaign_table: bool        # False for party years

    @property
    def detail_path(self) -> str:
        return f"campaigns/{self.campaign_efk_id}/forms/{self.form_efk_id}"


@dataclass
class Allowance:
    donor_type: str                # natural | legal | anonymous
    name: str | None
    first_name: str | None
    city: str | None
    lives_abroad: bool | None
    country: str | None
    nature: str                    # monetary | non_monetary
    service_type: str | None
    description: str | None
    value: Decimal
    granted_on: date | None
    is_anonymous: bool
    is_foreign: bool
    row_hash: str = ""


@dataclass
class Contribution:
    last_name: str
    first_name: str | None
    institution: str | None
    amount: Decimal


@dataclass
class Declaration:
    ref: FormRef
    phase: str                     # budget | final | annual
    kind: str                      # totals | allowances | allowances_incl_foreign
    checksum: str | None = None
    totals: dict | None = None
    allowances: list = field(default_factory=list)
    contributions: list = field(default_factory=list)
    campaign_label: str | None = None


# ----------------------------------------------------------------- trees

def _stance(label: str) -> str:
    t = fold(label)
    if t.startswith("adoption"):
        return "for"
    if t.startswith("rejet"):
        return "against"
    if "candidat" in t:
        return "candidates"
    return "none"


def _financing_from_node(node: dict, kind_hint: str) -> Financing:
    d, title = split_dated_label(node["label"])
    if kind_hint == "party_year":
        year = int(node["label"].strip())
        return Financing("party_year", node["id"], None, year, f"{year}")
    kind = "election" if re.search(r"\belections?\b", fold(title)) else "vote"
    if d is None:
        raise ParseError(f"financing {node['id']}: no date in label {node['label']!r}")
    f = Financing(kind, node["id"], d, d.year, title)
    return f


def _election_details(f: Financing, cantons: Cantons) -> None:
    t = fold(f.name)
    f.council = "CE" if "conseil des etats" in t else "CN" if "conseil national" in t else None
    if f.council is None:
        raise ParseError(f"election {f.efk_id}: unknown council in {f.name!r}")
    m = re.search(r"\(([^)]+)\)\s*$", f.name)
    f.canton = cantons.code(m.group(1)) if m else None


def _vote_object_type(title: str) -> str | None:
    t = fold(title)
    if "initiative" in t:
        return "popular_initiative"
    if "contre-projet" in t:
        return "counter_proposal"
    return None


def parse_trees(cf_tree: dict, pf_tree: dict, titles_by_lang: dict, canton_tree: dict | None, cantons: Cantons):
    """Returns (financings, actors, campaigns, formrefs) from the fr trees.

    titles_by_lang: {lang: {efk_financing_id: dated label}} for campaign financings.
    """
    financings: dict[tuple, Financing] = {}
    actors: dict[int, Actor] = {}
    campaigns: dict[int, Campaign] = {}
    forms: list[FormRef] = []

    def add_actor(node: dict, actor_type: str) -> int:
        name, city = split_actor_label(node["label"])
        actors.setdefault(node["id"], Actor(node["id"], name, city, actor_type))
        return node["id"]

    for fnode in cf_tree["data"]["tree_roots"]:
        _expect(fnode, "campaign_financing")
        f = _financing_from_node(fnode, "campaign")
        for lang, labels in titles_by_lang.items():
            if f.efk_id in labels:
                f.titles[lang] = split_dated_label(labels[f.efk_id])[1]
        if f.kind == "election":
            _election_details(f, cantons)
        else:
            f.object_type = _vote_object_type(f.name)
        financings[f.key] = f
        for cat in fnode.get("children", []):
            _expect(cat, "actor_category")
            atype = {0: "legal_entity", 1: "natural_person"}.get(cat["id"], "other")
            for anode in cat.get("children", []):
                _expect(anode, "actor")
                aid = add_actor(anode, atype)
                for cnode in anode.get("children", []):
                    _expect(cnode, "campaign")
                    stance = "candidates" if f.kind == "election" else _stance(cnode["label"])
                    campaigns[cnode["id"]] = Campaign(cnode["id"], f.key, aid, stance, cnode["label"])
                    for fo in cnode.get("children", []):
                        _expect(fo, "form")
                        forms.append(FormRef(f.key, aid, cnode["id"], fo["id"], fo["label"], True))

    for ynode in pf_tree["data"]["tree_roots"]:
        _expect(ynode, "party_financing")
        f = _financing_from_node(ynode, "party_year")
        financings[f.key] = f
        for anode in ynode.get("children", []):
            _expect(anode, "actor")
            aid = add_actor(anode, "legal_entity")
            for fo in anode.get("children", []):
                _expect(fo, "form")
                forms.append(FormRef(f.key, aid, fo["campaign_id"], fo["id"], fo["label"], False))

    if canton_tree:
        for cnode in canton_tree["data"]["tree_roots"]:
            code = cantons.code(cnode["label"])
            for cat in cnode.get("children", []):
                for anode in cat.get("children", []):
                    if anode.get("type") == "actor" and anode["id"] in actors and code:
                        actors[anode["id"]].canton = code

    return financings, actors, campaigns, forms


def _expect(node: dict, type_: str) -> None:
    if node.get("type") != type_:
        raise ParseError(f"tree: expected {type_}, got {node.get('type')!r} (id={node.get('id')})")


# ----------------------------------------------------------------- declarations

def classify_form(ref: FormRef, sibling_labels: list[str]) -> tuple[str, str]:
    """(phase, kind) from the fr form label. sibling_labels = labels of the other forms of the same campaign."""
    t = fold(ref.label)
    if ref.financing_key[0] == "party_year":
        if "recettes annuelles" in t:
            return "annual", "totals"
        if "liberalites" in t:
            return "annual", "allowances"
    else:
        if "recettes budgetees" in t:
            return "budget", "totals"
        if "decompte final des recettes" in t:
            return "final", "totals"
        if "liberalites" in t and "decompte final" in t:
            return "final", "allowances"
        if "liberalites" in t and "etranger" in t:
            # Only used for the 2023 Council of States elections, which only had final accounts:
            # take the phase of the campaign's totals form.
            sib = [fold(s) for s in sibling_labels]
            phase = "final" if any("decompte final" in s for s in sib) and not any("budgetees" in s for s in sib) else "budget"
            return phase, "allowances_incl_foreign"
        if "liberalites" in t:
            return "budget", "allowances"
    raise ParseError(f"unknown form label {ref.label!r}")


_TOTAL_KEYS = {
    "total": "total", "monetary_allowances": "monetary_allowances",
    "non_monetary_allowances": "non_monetary_allowances", "events": "events", "sales": "sales",
    "equity": "equity", "members": "membership_fees", "mandate_contribution_total": "mandate_contributions",
}
_ALLOWANCE_GROUP = re.compile(r"^(natural|juristic|anonymous)_(monetary|non_monetary)$")
_ALLOWANCE_FIELDS = {
    "natural_name", "natural_first_name", "natural_city", "living_abroad", "country_name",
    "juristic_name", "juristic_city", "service_type", "service_description", "value", "date",
}
_SWISS = {"suisse", "schweiz", "svizzera", "switzerland"}


def parse_detail(ref: FormRef, phase: str, kind: str, payload: dict, checksum: str | None) -> Declaration:
    data = payload.get("data") or {}
    fd = data.get("form_data")
    if not isinstance(fd, dict):
        raise ParseError(f"{ref.detail_path}: no form_data")
    decl = Declaration(ref, phase, kind, checksum, campaign_label=data.get("campaign_label"))

    if kind == "totals":
        block = fd.get("totals") if "totals" in fd else fd.get("party_financing")
        if not isinstance(block, dict):
            raise ParseError(f"{ref.detail_path}: totals block missing (keys={list(fd)})")
        unknown = set(block) - set(_TOTAL_KEYS)
        if unknown:
            raise ParseError(f"{ref.detail_path}: unknown totals keys {sorted(unknown)}")
        decl.totals = {_TOTAL_KEYS[k]: chf(v) for k, v in block.items()}
        if "total" not in decl.totals:
            raise ParseError(f"{ref.detail_path}: totals without 'total'")
        for c in fd.get("contributions") or []:
            decl.contributions.append(Contribution(
                (c.get("name") or "").strip(), (c.get("first_name") or "").strip() or None,
                (c.get("institution") or "").strip() or None, chf(c.get("value"))))
        return decl

    groups = fd.get("allowances")
    if not isinstance(groups, dict):
        raise ParseError(f"{ref.detail_path}: allowances block missing (keys={list(fd)})")
    seen: dict[str, int] = {}
    for group, items in groups.items():
        m = _ALLOWANCE_GROUP.match(group)
        if not m:
            raise ParseError(f"{ref.detail_path}: unknown allowance group {group!r}")
        who, nature = m.groups()
        for it in items or []:
            unknown = set(it) - _ALLOWANCE_FIELDS
            if unknown:
                raise ParseError(f"{ref.detail_path}: unknown allowance fields {sorted(unknown)}")
            name = (it.get("natural_name") or it.get("juristic_name") or "").strip() or None
            first = (it.get("natural_first_name") or "").strip() or None
            city = (it.get("natural_city") or it.get("juristic_city") or "").strip() or None
            country = (it.get("country_name") or "").strip() or None
            anonymous = who == "anonymous" or name is None
            a = Allowance(
                donor_type="anonymous" if anonymous else ("natural" if who == "natural" else "legal"),
                name=name, first_name=first, city=city,
                lives_abroad=it.get("living_abroad"), country=country,
                nature=nature, service_type=(it.get("service_type") or None),
                description=(it.get("service_description") or None),
                value=chf(it.get("value")), granted_on=ch_date(it.get("date")),
                is_anonymous=anonymous, is_foreign=bool(country and fold(country) not in _SWISS),
            )
            base = "|".join(str(x) for x in (ref.detail_path, group, name, first, city, country, a.value, a.granted_on,
                                              a.service_type, a.description))
            n = seen[base] = seen.get(base, 0) + 1
            a.row_hash = hashlib.sha256(f"{base}|{n}".encode()).hexdigest()
            decl.allowances.append(a)
    return decl


_CANDIDATE = re.compile(r"([^,()]+?)\s*\(([^,()]+),\s*([^()]+?)\)")


def parse_candidates(campaign_label: str | None, cantons: Cantons) -> list[Candidate]:
    """'…suivant(e-s): Hensch Anne-Claude (Zurich, Autres partis politiques), …' -> candidates."""
    if not campaign_label or ":" not in campaign_label:
        return []
    body = campaign_label.split(":", 1)[1]
    out = []
    for name, canton, party in _CANDIDATE.findall(body):
        name = name.strip(" ,.")
        if name:
            out.append(Candidate(name, cantons.code(canton.strip()), party.strip()))
    return out


# ----------------------------------------------------------------- donors

def donor_match_key(a: Allowance) -> str | None:
    """Stable key used to recognise the same donor across declarations (docs/02-database.md §6).
    Legal entities: name only (city spellings vary: Bern/Berne). Natural persons: name + first name + city."""
    if a.is_anonymous:
        return None
    clean = lambda s: re.sub(r"[^a-z0-9 ]", " ", fold(s or "")).split()
    if a.donor_type == "legal":
        return "legal|" + " ".join(clean(a.name))
    return "natural|" + " ".join(clean(a.name)) + "|" + " ".join(clean(a.first_name)) + "|" + " ".join(clean(a.city))
