"""Atualiza o catálogo de personagens a partir do snapshot atribuído no README."""

import argparse
import json
import re
import unicodedata
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path
from urllib.request import urlopen

from gerar_biblia import CODIGOS, LIVROS, RAIZ, ler_fonte


PASTA = RAIZ / "Personagens Bíblicos"
EDICAO = "b9a84854369502d10cdc7086e58e2794dbfd6722"
BASE = f"https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/{EDICAO}/json"
RELACOES = {
    "father": ("pai", "filhos"),
    "mother": ("mãe", "filhos"),
    "children": ("filhos", "genitor"),
    "siblings": ("irmãos", "irmãos"),
    "partners": ("cônjuge", "cônjuge"),
    "halfSiblingsSameFather": ("meio-irmãos pelo pai", "meio-irmãos pelo pai"),
    "halfSiblingsSameMother": ("meio-irmãos pela mãe", "meio-irmãos pela mãe"),
}
ALCUNHAS_REMOVER = {
    "sennacherib_2489": {"Sargon"},
    "paul_2479": {"Mercurius"},
    "zerubbabel_3054": {"Sheshbazzar"},
    "mary_1938": {"mother"},
    "jesus_905": {"God"},
}
# O índice KJV reúne usos distintos nestas entradas. Os identificadores e as
# relações alternativas permitem consultar as passagens sem fundir as pessoas.
REFERENCIAS_REJEITADAS = {
    "sennacherib_2489": {"Isa.20.1"},
    "lydia_1837": {"Gen.36.22", "1Chr.1.39"},
    "jezebel_1605": {"Rev.2.20"},
    "augustus_366": {"Acts.25.21", "Acts.25.25"},
}
COINCIDENCIAS_REJEITADAS = {
    ("god_1324", "adam_78"), ("god_1324", "eve_1231"),
    ("joseph_1715", "jesus_905"), ("mary_1938", "heli_1484"),
    ("cleophas_950", "mary_1940"),
    ("goliath_1327", "the_giant_in_gath_2848"),
    ("goliath_1327", "ishbi-benob_621"),
    ("goliath_1327", "lahmi_1806"),
    ("goliath_1327", "man_of_great_stature_1924"),
    ("goliath_1327", "sippai_2471"),
}
COINCIDENCIAS_REJEITADAS.update(
    (genitor, filho)
    for genitor in ("mary_1938", "joseph_1715")
    for filho in ("james_719", "joses_1721", "jude_1756", "simon_2747")
)
COINCIDENCIAS_REJEITADAS = {frozenset(par) for par in COINCIDENCIAS_REJEITADAS}


def load(name, cache):
    local = cache / f"{name}.json" if cache else None
    if local and local.exists():
        return json.loads(local.read_text(encoding="utf-8"))
    with urlopen(f"{BASE}/{name}.json", timeout=60) as remote:
        response = remote.read()
    if local:
        local.parent.mkdir(parents=True, exist_ok=True)
        local.write_bytes(response)
    return json.loads(response)


def tsv(name):
    return [
        line.split("\t")
        for line in (PASTA / name).read_text(encoding="utf-8-sig").splitlines()
        if line.strip() and not line.startswith("#")
    ]


def normalize(text):
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()


def context_for(refs, details):
    if details:
        return details[1]
    for book, chapter, _ in refs:
        if book == "GEN":
            return "primórdios" if chapter < 12 else "patriarcas"
        if book in {"EXO", "LEV"}:
            return "egito"
        if book in {"NUM", "DEU", "JOS", "JDG", "RUT"} or (book == "1SA" and chapter < 9):
            return "juízes"
        if book in {"1SA", "2SA", "1KI", "2KI", "HOS", "AMO", "JON", "ISA"}:
            return "monarquia"
        if book in {"JER", "EZE", "DAN"}:
            return "exílio"
        if book in {"EZR", "NEH", "EST", "HAG", "ZEC", "MAL"}:
            return "pérsia"
        if book in {"MAT", "MAR", "LUK", "JOH"}:
            if (book == "MAT" and chapter == 1) or (book == "LUK" and chapter == 3):
                continue
            return "judeia"
        if book == "ACT" or CODIGOS.index(book) >= CODIGOS.index("ROM"):
            return "igreja"
    return "indeterminado"


def local_name(name, refs, verses):
    """Escolhe grafia da Bíblia Livre só quando a semelhança e o contexto coincidem."""
    base = normalize(name)
    if not re.fullmatch("[a-z-]{3,}", base):
        return name
    candidates = Counter()
    for book, chapter, number in refs[:8]:
        verse = verses.get((book, chapter, number), "")
        for word in set(re.findall(r"[^\W\d_]+(?:-[^\W\d_]+)*", verse)):
            if not word[0].isupper():
                continue
            term = normalize(word)
            similarity = SequenceMatcher(None, base, term).ratio()
            if similarity >= 0.72 and (term[:2] == base[:2] or similarity > 0.87):
                candidates[(word, similarity)] += 1
    if not candidates:
        return name
    normalized = lambda item: item[0][1] + min(item[1], 5) * 0.035
    ranking = sorted(candidates.items(), key=normalized, reverse=True)
    (word, similarity), count = ranking[0]
    clear = len(ranking) == 1 or normalized(ranking[0]) - normalized(ranking[1]) > 0.035
    if clear and (similarity >= 0.84 or (similarity >= 0.72 and count > 1)):
        return word.title() if word.isupper() else word
    return name


def source_refs(person, verse_lookup):
    skip = REFERENCIAS_REJEITADAS.get(person["slug"], ())
    refs = [verse_lookup[item] for item in person["verses"] if item in verse_lookup]
    return sorted(
        {ref for raw, ref in refs if raw not in skip},
        key=lambda item: (CODIGOS.index(item[0]), item[1], item[2]),
    )


def relation_edges(data, valid, by_id):
    links = {key: defaultdict(set) for key in valid}
    parents = {
        (by_id[relative], record["slug"])
        for record in data
        for field in ("father", "mother")
        for relative in record.get(field, [])
        if relative in by_id
    }
    for record in data:
        slug = record["slug"]
        for field, (direct, reverse) in RELACOES.items():
            for relative in record.get(field, []):
                target = by_id.get(relative)
                if not target or target == slug or frozenset((slug, target)) in COINCIDENCIAS_REJEITADAS:
                    continue
                if field == "children" and (slug, target) in parents:
                    continue
                links[slug][direct].add(target)
                links[target][reverse].add(slug)
    for focus, relation, other in (
        ("mary_1938", "mãe", "jesus_905"),
        ("lois_1828", "mãe", "eunice_1228"),
        ("eunice_1228", "mãe", "timotheus_2863"),
    ):
        links[other][relation].add(focus)
        links[focus]["filhos"].add(other)
    return {key: {label: sorted(ids) for label, ids in relations.items()} for key, relations in links.items()}


def build(cache):
    pt_verses = {
        (code, chapter, number): verse
        for code, chapters in ler_fonte().items()
        for chapter, verses in chapters.items()
        for number, verse in verses
    }
    osis_codes = {
        row["fields"]["osisName"]: CODIGOS[row["fields"]["bookOrder"] - 1]
        for row in load("books", cache)
    }
    verse_lookup = {}
    for row in load("verses", cache):
        raw = row["fields"]["osisRef"]
        book, chapter, verse = raw.split(".")
        verse_lookup[row["id"]] = (raw, (osis_codes[book], int(chapter), int(verse)))

    curated = {key: details for key, *details in tsv("perfis.tsv")}
    rows = load("people", cache)
    people_data = [row["fields"] for row in rows]
    by_id = {row["id"]: row["fields"]["slug"] for row in rows}
    valid = set(by_id.values())
    extras = {}
    extra_path = PASTA / "suplemento.tsv"
    if extra_path.exists():
        for key, refs in tsv(extra_path.name):
            extras[key] = [
                (book, int(chapter), int(verse))
                for ref in refs.split(",")
                for book, chapter, verse in [ref.split(".")]
            ]
    assert not valid.intersection(extras)
    valid.update(extras)
    assert set(curated) <= valid, set(curated) - valid
    assert set(extras) <= set(curated)
    family = relation_edges(people_data, valid, by_id)
    links = tsv("vinculos.tsv")
    assert all(a in valid and b in valid and a != b for a, b, _, _ in links)
    out = {}
    for person in people_data:
        slug = person["slug"]
        refs = source_refs(person, verse_lookup)
        details = curated.get(slug)
        name = local_name(person["name"], refs, pt_verses)
        title = details[0] if details else name if person.get("isProperName") else person["displayTitle"]
        aliases = [
            alias.strip()
            for alias in (person.get("alsoCalled") or "").split(",")
            if alias.strip() and alias.strip() not in ALCUNHAS_REMOVER.get(slug, ())
        ]
        if title != person["displayTitle"]:
            aliases.insert(0, person["displayTitle"])
        if title != person["name"]:
            aliases.insert(0, person["name"])
        out[slug] = {
            "name": title,
            "aliases": list(dict.fromkeys(aliases)),
            "context": context_for(refs, details),
            "gender": "f" if person.get("gender") == "Female" else "m",
            "refs": refs,
            "family": family[slug],
        }
        if details:
            out[slug].update(dict(zip(("profile", "citation", "art"), details[2:], strict=True)))
    for slug, refs in extras.items():
        title, context, profile, citation, art = curated[slug]
        out[slug] = {
            "name": title, "aliases": [], "context": context, "gender": "",
            "refs": refs, "family": family[slug], "profile": profile, "citation": citation, "art": art,
        }
    packet = {
        "books": dict(zip(CODIGOS, LIVROS, strict=True)),
        "contexts": json.loads((PASTA / "contextos.json").read_text(encoding="utf-8")),
        "people": out,
        "links": links,
    }
    for slug, title, url in tsv("fontes-individuais.tsv"):
        out[slug]["source"] = [title, url]
    assert all(row["refs"] for row in out.values())
    assert all(row["context"] in packet["contexts"] for row in out.values())
    uncovered = {ref for row in out.values() for ref in map(tuple, row["refs"]) if ref not in pt_verses}
    assert not uncovered, uncovered
    (PASTA / "dados.js").write_text(
        "/* Theographic / Robert Rouse, CC BY-SA 4.0. Veja README.md. */\n"
        "window.BIBLIE_PERSONAGENS = " + json.dumps(packet, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    print(f"{len(out)} fichas, {len(curated)} perfis editoriais, {len(links)} vínculos narrativos.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, help="Diretório opcional para os arquivos JSON do Theographic.")
    build(parser.parse_args().cache)
