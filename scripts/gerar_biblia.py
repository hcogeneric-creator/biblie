"""Gera o texto por livro, o roteiro cronológico e o índice do leitor offline."""

import json
import re
import unicodedata
from collections import Counter
from pathlib import Path
from zipfile import ZipFile


RAIZ = Path(__file__).resolve().parents[1]
CRONOLOGIA = RAIZ / "Bíblia Cronológica"
FONTE = RAIZ / "Fonte" / "porbr2018_vpl.zip"
LIVROS = """Gênesis|Êxodo|Levítico|Números|Deuteronômio|Josué|Juízes|Rute|1 Samuel|2 Samuel|1 Reis|2 Reis|1 Crônicas|2 Crônicas|Esdras|Neemias|Ester|Jó|Salmos|Provérbios|Eclesiastes|Cantares|Isaías|Jeremias|Lamentações|Ezequiel|Daniel|Oseias|Joel|Amós|Obadias|Jonas|Miqueias|Naum|Habacuque|Sofonias|Ageu|Zacarias|Malaquias|Mateus|Marcos|Lucas|João|Atos|Romanos|1 Coríntios|2 Coríntios|Gálatas|Efésios|Filipenses|Colossenses|1 Tessalonicenses|2 Tessalonicenses|1 Timóteo|2 Timóteo|Tito|Filemom|Hebreus|Tiago|1 Pedro|2 Pedro|1 João|2 João|3 João|Judas|Apocalipse""".split("|")
CODIGOS = """GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SOL ISA JER LAM EZE DAN HOS JOE AMO OBA JON MIC NAH HAB ZEP HAG ZEC MAL MAT MAR LUK JOH ACT ROM 1CO 2CO GAL EPH PHI COL 1TH 2TH 1TI 2TI TIT PHM HEB JAM 1PE 2PE 1JO 2JO 3JO JUD REV""".split()
CREDITO = "Bíblia Livre (BLIVRE), © Diego Santos, Mario Sérgio e Marco Teles, fevereiro de 2018, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)."
PALAVRA = re.compile(r"[^\W\d_]+(?:[-’'][^\W\d_]+)*", re.UNICODE)


def slug(nome):
    return unicodedata.normalize("NFKD", nome).encode("ascii", "ignore").decode().lower().replace(" ", "-")


def ler_fonte():
    dados = {}
    with ZipFile(FONTE) as arquivo:
        original = arquivo.read("porbr2018_vpl.txt").decode("utf-8-sig")
    for linha in original.splitlines():
        codigo, referencia, versiculo = linha.split(" ", 2)
        capitulo, numero = referencia.split(":")
        capitulo = int(capitulo)
        numero = int(numero)
        versos = dados.setdefault(codigo, {}).setdefault(capitulo, [])
        if versos and numero <= versos[-1][0]:
            raise ValueError(f"Versículos repetidos ou fora de ordem em {codigo} {referencia}")
        versos.append((numero, versiculo))
    if list(dados) != CODIGOS:
        raise ValueError("A ordem canônica da fonte mudou")
    assert sum(map(len, dados.values())) == 1189
    assert sum(len(versos) for capitulos in dados.values() for versos in capitulos.values()) == 31102
    return dados


def ler_ordem(dados):
    ordem = []
    vistos = Counter()
    for linha in (CRONOLOGIA / "ordem.txt").read_text(encoding="utf-8-sig").splitlines():
        if not linha or linha.startswith("#"):
            continue
        epoca, titulo, lista = linha.split("|")
        trechos = []
        for item in lista.split("; "):
            codigo, referencia = item.split()
            if ":" in referencia:
                capitulo, intervalo = referencia.split(":")
                inicio, fim = map(int, intervalo.split("-"))
                capitulo = int(capitulo)
                versos = [(n, t) for n, t in dados[codigo][capitulo] if inicio <= n <= fim]
                if len(versos) != fim - inicio + 1:
                    raise ValueError(f"Intervalo inválido: {item}")
                vistos.update((codigo, capitulo, n) for n, _ in versos)
                trechos.append([codigo, capitulo, inicio, fim])
            else:
                inicio, _, fim = referencia.partition("-")
                for capitulo in range(int(inicio), int(fim or inicio) + 1):
                    vistos.update((codigo, capitulo, n) for n, _ in dados[codigo][capitulo])
                    trechos.append([codigo, capitulo])
        ordem.append([epoca, titulo, trechos, lista])
    original = Counter(
        (codigo, capitulo, numero)
        for codigo, capitulos in dados.items()
        for capitulo, versos in capitulos.items()
        for numero, _ in versos
    )
    if vistos != original:
        raise ValueError(f"Omissões: {original - vistos}; repetições: {vistos - original}")
    return ordem


def gerar(dados, ordem, exigir_resumos):
    nomes = dict(zip(CODIGOS, LIVROS, strict=True))
    catalogo = {}
    resumos = {}
    verificacoes = []
    ausentes = []
    for posicao, codigo in enumerate(CODIGOS, 1):
        nome = nomes[codigo]
        nome_pasta = f"{posicao:02}-{slug(nome)}"
        pasta = RAIZ / "Livros" / nome_pasta
        pasta.mkdir(parents=True, exist_ok=True)
        capitulos = dados[codigo]
        linhas = [f"# {nome}", "", CREDITO, "[Fonte](../../Fonte/README.md) · [Resumo](RESUMO.md) · [Leitor](../../B%C3%ADblia%20Cronol%C3%B3gica/index.html#" + f"{codigo}.1)", ""]
        for capitulo, versos in capitulos.items():
            linhas += [f"## Capítulo {capitulo}", ""]
            for numero, versiculo in versos:
                linhas += [f"**{numero}.** {versiculo}", ""]
        (pasta / "TEXTO.md").write_text("\n".join(linhas), encoding="utf-8", newline="\n")
        catalogo[codigo] = [nome, nome_pasta, capitulos]
        resumo = pasta / "RESUMO.md"
        if resumo.exists():
            tamanho_original = sum(len(PALAVRA.findall(versiculo)) for versos in capitulos.values() for _, versiculo in versos)
            conteudo = resumo.read_text(encoding="utf-8-sig")
            resumos[codigo] = [
                linha for linha in conteudo.splitlines()
                if linha.strip() and not linha.startswith(("# ", "["))
            ]
            # Inclui título e rótulos do resumo, mas exclui os destinos de links.
            conteudo = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", conteudo)
            tamanho_resumo = len(PALAVRA.findall(conteudo))
            if tamanho_resumo * 5 > tamanho_original:
                raise ValueError(f"{nome}: {tamanho_resumo}/{tamanho_original} palavras excede 20%")
            verificacoes.append((nome, tamanho_original, tamanho_resumo))
        else:
            ausentes.append(nome)

    if exigir_resumos and ausentes:
        raise ValueError(f"Faltam resumos: {', '.join(ausentes)}")

    arquivo_js = "window.BIBLIE = " + json.dumps([catalogo, ordem, resumos], ensure_ascii=False, separators=(",", ":")) + ";\n"
    (CRONOLOGIA / "dados.js").write_text(arquivo_js, encoding="utf-8", newline="\n")
    linhas = ["# Roteiro da Bíblia Cronológica", "", "[Abrir o leitor](index.html) · [Critérios e fontes](README.md)", ""]
    epoca_anterior = None
    for numero, (epoca, titulo, _, referencias) in enumerate(ordem, 1):
        if epoca != epoca_anterior:
            linhas += [f"## {epoca}", ""]
            epoca_anterior = epoca
        extenso = "; ".join(f"{nomes[item.split()[0]]} {item.split()[1]}" for item in referencias.split("; "))
        linhas += [f"{numero}. [{titulo}](index.html#bloco-{numero}) — {extenso}"]
    (CRONOLOGIA / "ROTEIRO.md").write_text("\n".join(linhas) + "\n", encoding="utf-8", newline="\n")
    if verificacoes and not ausentes:
        linhas = [
            "# Verificação do tamanho dos resumos", "",
            "Contagem por palavras, incluindo os títulos dos resumos e excluindo os destinos dos links. A base é o texto dos versículos da Bíblia Livre.", "",
            "| Livro | Texto (palavras) | Resumo (palavras) | Proporção |",
            "| --- | ---: | ---: | ---: |",
        ]
        for nome, original, resumo in verificacoes:
            proporcao = f"{resumo / original:.2%}".replace(".", ",")
            linhas.append(f"| {nome} | {original} | {resumo} | {proporcao} |")
        (RAIZ / "Livros" / "VERIFICACAO.md").write_text("\n".join(linhas) + "\n", encoding="utf-8", newline="\n")
        maximo = max(verificacoes, key=lambda item: item[2] / item[1])
        print(f"Maior resumo proporcional: {maximo[0]}, {maximo[2] / maximo[1]:.2%}")
    print(f"{len(CODIGOS)} livros, 1189 capítulos, 31102 versículos, {len(ordem)} blocos e {len(verificacoes)} resumos conferidos.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exigir-resumos", action="store_true")
    argumentos = parser.parse_args()
    livros = ler_fonte()
    gerar(livros, ler_ordem(livros), argumentos.exigir_resumos)
