"""Indexa as ilustrações locais a partir dos prompts salvos no Biblie."""

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path


RAIZ = Path(__file__).resolve().parents[1] / "Ilustrações"
SAIDA = RAIZ / "dados-galerias.js"
CATEGORIAS = {"parabolas", "livros", "atlas"}


def indexar(exigir_completude):
    galerias = defaultdict(lambda: defaultdict(list))
    esperados = set()
    ordens = set()
    pendentes = []

    for caminho in sorted(RAIZ.glob("prompts-*.jsonl")):
        for linha in caminho.read_text(encoding="utf-8-sig").splitlines():
            if not linha.strip():
                continue
            cena = json.loads(linha)
            categoria, ficha, ordem = (cena[chave] for chave in ("categoria", "id", "ordem"))
            arquivo = cena["out"]
            chave = (categoria, ficha, ordem)
            if categoria not in CATEGORIAS or not isinstance(ordem, int) or ordem < 1:
                raise ValueError(f"Categoria ou ordem inválida em {caminho.name}: {chave}")
            if not re.fullmatch(r"[a-z0-9][a-z0-9-]*\.webp", arquivo):
                raise ValueError(f"Nome de arquivo inválido: {arquivo}")
            if arquivo in esperados or chave in ordens:
                raise ValueError(f"Cena repetida: {chave} ({arquivo})")
            esperados.add(arquivo)
            ordens.add(chave)
            if (RAIZ / "imagens" / arquivo).is_file():
                galerias[categoria][ficha].append((ordem, arquivo, cena["titulo"], cena["referencia"]))
            else:
                pendentes.append(arquivo)

    if exigir_completude and pendentes:
        raise ValueError(f"Faltam {len(pendentes)} arquivos, começando por {pendentes[0]}")

    saida = {
        categoria: {
            ficha: [cena[1:] for cena in sorted(cenas)]
            for ficha, cenas in fichas.items()
        }
        for categoria, fichas in galerias.items()
    }
    dados = json.dumps(saida, ensure_ascii=False, separators=(",", ":"))
    SAIDA.write_text(f"window.BIBLIE_CENAS = {dados};\n", encoding="utf-8", newline="\n")
    print(f"{len(esperados) - len(pendentes)} imagens publicadas e {len(pendentes)} pendentes.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exigir-completude", action="store_true")
    indexar(parser.parse_args().exigir_completude)
