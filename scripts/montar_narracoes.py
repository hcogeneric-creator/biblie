"""Alinha no Whisper local as palavras dos WAVs e monta as faixas para o site."""

import argparse
import hashlib
import json
import re
import subprocess
import time
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path
from tempfile import TemporaryDirectory


PARABOLAS = Path(__file__).resolve().parents[1] / "PARABOLAS"
PALAVRAS = re.compile(r"[^\W_]+(?:[-’'][^\W_]+)*")


def normalizar(texto):
    return "".join(c for c in unicodedata.normalize("NFD", texto.casefold()) if c.isalnum())


def alinhar(modelo, caminho, texto):
    segmentos, info = modelo.transcribe(
        str(caminho), language="pt", word_timestamps=True, beam_size=3,
        condition_on_previous_text=False, temperature=0,
    )
    lidas = [palavra for segmento in segmentos for palavra in segmento.words if normalizar(palavra.word)]
    escritas = list(PALAVRAS.finditer(texto))
    comparacao = SequenceMatcher(
        None, [normalizar(p.group()) for p in escritas], [normalizar(p.word) for p in lidas], autojunk=False,
    )
    duracao = float(info.duration)
    marcas = []
    maior_lacuna = 0
    for tipo, inicio, fim, falada, limite in comparacao.get_opcodes():
        if tipo == "equal":
            tempos = [p.start for p in lidas[falada:limite]]
        else:
            maior_lacuna = max(maior_lacuna, fim - inicio, limite - falada)
            t0 = lidas[falada].start if falada < len(lidas) else lidas[-1].end if lidas else 0
            t1 = lidas[limite].start if limite < len(lidas) else duracao
            if falada == limite and falada:
                t0 = lidas[falada - 1].end
            tempos = [t0 + (t1 - t0) * indice / max(fim - inicio, 1) for indice in range(fim - inicio)]
        marcas.extend(
            [round(tempo * 1000), palavra.start(), len(palavra.group())]
            for tempo, palavra in zip(tempos, escritas[inicio:fim])
        )
    for anterior, atual in zip(marcas, marcas[1:]):
        atual[0] = max(anterior[0], atual[0])
    return {
        "confianca": round(comparacao.ratio(), 3),
        "maior_lacuna": maior_lacuna,
        "aprovado": comparacao.ratio() >= 0.89 and maior_lacuna <= 4,
        "ouvido": "".join(palavra.word for palavra in lidas).strip(),
        "marcas": marcas,
    }


def verificar(opcoes, roteiros):
    from faster_whisper import WhisperModel

    modelo = WhisperModel(opcoes.whisper, device="cpu", compute_type="int8", cpu_threads=5, local_files_only=True)
    opcoes.marcas.mkdir(parents=True, exist_ok=True)
    esperados = {
        f"{slug}-{indice}": texto
        for slug, quadros in roteiros.items()
        for indice, texto in enumerate(quadros, 1)
    }
    while True:
        faltam = 0
        for nome, texto in esperados.items():
            wav = opcoes.entrada / f"{nome}.wav"
            destino = opcoes.marcas / f"{nome}.json"
            if not wav.exists():
                faltam += 1
                continue
            if destino.exists() and destino.stat().st_mtime >= wav.stat().st_mtime:
                continue
            alinhamento = alinhar(modelo, wav, texto)
            destino.write_text(json.dumps(alinhamento, ensure_ascii=False), encoding="utf-8")
            resultado = "OK" if alinhamento["aprovado"] else "revisar"
            print(f"{nome} · {resultado} · {alinhamento['confianca']:.0%}", flush=True)
        if not faltam or not opcoes.acompanhar:
            return
        time.sleep(3)


def montar(opcoes, roteiros):
    import numpy as np
    import soundfile

    dados = {}
    pasta_audio = PARABOLAS / "audio"
    pasta_audio.mkdir(exist_ok=True)
    with TemporaryDirectory(prefix="biblie-audio-") as temporaria:
        temporaria = Path(temporaria)
        wav = temporaria / "faixa.wav"
        for slug, quadros in roteiros.items():
            partes = []
            marca_quadros = []
            inicio_amostra = 0
            for indice, texto in enumerate(quadros, 1):
                nome = f"{slug}-{indice}"
                quadro_wav = opcoes.entrada / f"{nome}.wav"
                marcas_json = opcoes.marcas / f"{nome}.json"
                if marcas_json.stat().st_mtime < quadro_wav.stat().st_mtime:
                    raise ValueError(f"Rode a verificação do quadro atualizado {nome}.")
                alinhamento = json.loads(marcas_json.read_text(encoding="utf-8"))
                if not alinhamento["aprovado"]:
                    raise ValueError(f"Revise a leitura de {nome} antes de montar as faixas.")
                parte, taxa = soundfile.read(quadro_wav, dtype="float32")
                if taxa != 24000 or parte.ndim != 1:
                    raise ValueError(f"Formato inesperado em {nome}: use WAV mono a 24 kHz.")
                inicio = round(inicio_amostra * 1000 / taxa)
                marcas = [[t + inicio, posicao, tamanho] for t, posicao, tamanho in alinhamento["marcas"]]
                marca_quadros.append([inicio, texto, marcas])
                partes.extend([parte, np.zeros(round(0.30 * taxa), dtype="float32")])
                inicio_amostra += len(partes[-2]) + len(partes[-1])
            soundfile.write(wav, np.concatenate(partes), 24000)
            mp3 = temporaria / f"{slug}.mp3"
            subprocess.run([
                "ffmpeg", "-v", "error", "-nostdin", "-y", "-i", str(wav),
                "-af", "highpass=f=64,equalizer=f=140:t=q:w=1.1:g=2,acompressor=threshold=0.125:ratio=2,loudnorm=I=-18:TP=-2:LRA=8",
                "-ac", "1", "-ar", "24000", "-b:a", "48k", "-map_metadata", "-1", str(mp3),
            ], check=True)
            hash_audio = hashlib.sha256(mp3.read_bytes()).hexdigest()[:12]
            dados[slug] = {"audio": f"audio/{slug}.mp3?v={hash_audio}", "quadros": marca_quadros}

        for slug in roteiros:
            (pasta_audio / f"{slug}.mp3").write_bytes((temporaria / f"{slug}.mp3").read_bytes())
        js = "window.BIBLIE_NARRACOES = " + json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + ";\n"
        (PARABOLAS / "dados-narracoes.js").write_text(js, encoding="utf-8", newline="\n")
    print(f"{len(dados)} faixas montadas com as palavras alinhadas.")


def main():
    argumentos = argparse.ArgumentParser(description=__doc__)
    argumentos.add_argument("etapa", choices=("verificar", "montar"))
    argumentos.add_argument("--entrada", type=Path, required=True)
    argumentos.add_argument("--marcas", type=Path, required=True)
    argumentos.add_argument("--whisper", default="small")
    argumentos.add_argument("--acompanhar", action="store_true")
    opcoes = argumentos.parse_args()
    roteiros = json.loads((PARABOLAS / "narracoes.json").read_text(encoding="utf-8"))
    if opcoes.etapa == "verificar":
        verificar(opcoes, roteiros)
    else:
        montar(opcoes, roteiros)


if __name__ == "__main__":
    main()
