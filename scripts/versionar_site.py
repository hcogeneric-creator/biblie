"""Carimba os arquivos de cada página com hashes do conteúdo publicado."""

import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import unquote, urlsplit


RAIZ = Path(__file__).resolve().parents[1]
ATIVOS = re.compile(r'(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"?]+\.(?:js|css))(?:\?v=[a-f0-9]+)?(")')
META = re.compile(r'(<meta name="biblie-versao" content=")[a-f0-9]*(")')


def versao(conteudo):
    return hashlib.sha256(conteudo).hexdigest()[:12]


def versionar(verificar):
    paginas = sorted([RAIZ / "index.html", *RAIZ.glob("*/index.html")])
    atualizadas = {}
    ativos = {}

    for pagina in paginas:
        html = pagina.read_text(encoding="utf-8")

        def incluir_hash(match):
            url = urlsplit(match[2])
            if url.scheme or url.netloc:
                return match[0]
            caminho = (pagina.parent / unquote(url.path)).resolve()
            if not caminho.is_relative_to(RAIZ):
                raise ValueError(f"Arquivo fora da raiz: {match[2]}")
            if caminho not in ativos:
                ativos[caminho] = versao(caminho.read_text(encoding="utf-8").encode("utf-8"))
            return f"{match[1]}{match[2]}?v={ativos[caminho]}{match[3]}"

        html = ATIVOS.sub(incluir_hash, html)
        html, numero = META.subn(r"\g<1>\g<2>", html)
        if numero != 1:
            raise ValueError(f"Carimbo ausente ou duplicado em {pagina.relative_to(RAIZ)}")
        atualizadas[pagina] = html

    identificador = versao("\n".join(atualizadas.values()).encode("utf-8"))
    for pagina, html in atualizadas.items():
        atualizadas[pagina] = META.sub(rf"\g<1>{identificador}\g<2>", html)
    atualizadas[RAIZ / "versao.json"] = json.dumps({"versao": identificador}) + "\n"

    for caminho, conteudo in atualizadas.items():
        atual = caminho.read_text(encoding="utf-8") if caminho.exists() else None
        if atual != conteudo:
            if verificar:
                raise SystemExit(f"Execute scripts/versionar_site.py antes de publicar: {caminho.relative_to(RAIZ)}")
            caminho.write_text(conteudo, encoding="utf-8", newline="\n")
    print(f"Biblie {identificador}: {len(paginas)} páginas e {len(ativos)} recursos.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verificar", action="store_true")
    versionar(parser.parse_args().verificar)
