"""Renderiza os quadros em WAV com o Chatterbox PT-BR local do Video2MD."""

import argparse
import json
import os
import re
import time
from pathlib import Path

import numpy as np
import soundfile
import torch
from chatterbox.models.s3tokenizer import drop_invalid_tokens
from chatterbox.mtl_tts import ChatterboxMultilingualTTS, punc_norm
from torch.nn.functional import pad


PARABOLAS = Path(__file__).resolve().parents[1] / "PARABOLAS"


def sintetizar(modelo, texto, dispositivo, semente):
    tokens = modelo.tokenizer.text_to_tokens(punc_norm(texto), language_id="pt").to(dispositivo)
    tokens = torch.cat([tokens, tokens])
    tokens = pad(tokens, (1, 0), value=modelo.t3.hp.start_text_token)
    tokens = pad(tokens, (0, 1), value=modelo.t3.hp.stop_text_token)
    torch.manual_seed(semente)

    atencoes = [camada.self_attn for camada in modelo.t3.tfmr.layers]
    hooks_originais = [set(atencao._forward_hooks) for atencao in atencoes]
    with torch.inference_mode():
        try:
            fala = modelo.t3.inference(
                t3_cond=modelo.conds.t3,
                text_tokens=tokens,
                max_new_tokens=850,
                temperature=0.59,
                cfg_weight=0.4,
                repetition_penalty=2.0,
                min_p=0.05,
                top_p=1.0,
            )
        finally:
            # A versão instalada do Chatterbox registra novos hooks a cada chamada.
            for atencao, antes in zip(atencoes, hooks_originais):
                for identificador in set(atencao._forward_hooks) - antes:
                    del atencao._forward_hooks[identificador]
            if hasattr(modelo.t3, "patched_model"):
                del modelo.t3.patched_model
        fala = drop_invalid_tokens(fala[0])
        destino_vocoder = modelo.s3gen.device
        try:
            if modelo.s3gen.dtype == torch.float16:
                mel = modelo.s3gen.flow_inference(
                    fala.to(destino_vocoder), ref_dict=modelo.conds.gen, finalize=True,
                )
                cache = torch.zeros(1, 1, 0, device=destino_vocoder)
                wav, _ = modelo.s3gen.hift_inference(mel.float(), cache)
                wav[:, :len(modelo.s3gen.trim_fade)] *= modelo.s3gen.trim_fade
            else:
                wav, _ = modelo.s3gen.inference(
                    speech_tokens=fala.to(destino_vocoder), ref_dict=modelo.conds.gen,
                )
        except torch.cuda.OutOfMemoryError:
            modelo.s3gen.to("cpu", dtype=torch.float32)
            modelo.conds.gen = {
                k: v.cpu() if torch.is_tensor(v) else v for k, v in modelo.conds.gen.items()
            }
            torch.cuda.empty_cache()
            wav, _ = modelo.s3gen.inference(speech_tokens=fala.cpu(), ref_dict=modelo.conds.gen)
        return modelo.watermarker.apply_watermark(wav.squeeze(0).cpu().numpy(), sample_rate=modelo.sr)


def main():
    argumentos = argparse.ArgumentParser(description=__doc__)
    argumentos.add_argument("--modelo", type=Path, required=True)
    argumentos.add_argument("--referencia", type=Path, required=True)
    argumentos.add_argument("--saida", type=Path, required=True)
    argumentos.add_argument("--dispositivo", choices=("cuda", "cpu"), default="cuda")
    argumentos.add_argument("--quadros", nargs="+", help="Identificadores específicos no formato maior-amor-1")
    argumentos.add_argument("--variacao", type=int, default=0)
    argumentos.add_argument("--frases", action="store_true", help="Grava frases separadas e insere uma pausa curta.")
    argumentos.add_argument("--vocoder-fp16", action="store_true", help="Reduz a memória usada pela conversão de tokens em espectrograma.")
    opcoes = argumentos.parse_args()
    opcoes.saida.mkdir(parents=True, exist_ok=True)
    roteiros = json.loads((PARABOLAS / "narracoes.json").read_text(encoding="utf-8"))

    os.environ["HF_HUB_OFFLINE"] = "1"
    torch.set_num_threads(4)
    torch.backends.cuda.matmul.allow_tf32 = True
    modelo = ChatterboxMultilingualTTS.from_local(opcoes.modelo, "cpu")
    modelo.prepare_conditionals(str(opcoes.referencia), exaggeration=0.38)
    tipo = torch.float16 if opcoes.dispositivo == "cuda" else torch.float32
    modelo.t3.to(device=opcoes.dispositivo, dtype=tipo)
    modelo.conds.t3.to(device=opcoes.dispositivo, dtype=tipo)
    try:
        if opcoes.vocoder_fp16 and opcoes.dispositivo == "cuda":
            modelo.s3gen.flow.half()
        modelo.s3gen.to(opcoes.dispositivo)
        modelo.conds.gen = {
            k: v.to(opcoes.dispositivo) if torch.is_tensor(v) else v for k, v in modelo.conds.gen.items()
        }
    except torch.cuda.OutOfMemoryError:
        modelo.s3gen.to("cpu", dtype=torch.float32)
        torch.cuda.empty_cache()
    print(f"Chatterbox PT-BR pronto em {opcoes.dispositivo}.", flush=True)

    for livro, (slug, cenas) in enumerate(roteiros.items(), 1):
        for indice, texto in enumerate(cenas, 1):
            id_quadro = f"{slug}-{indice}"
            arquivo = opcoes.saida / f"{id_quadro}.wav"
            if opcoes.quadros is not None and id_quadro not in opcoes.quadros:
                continue
            if arquivo.exists() and not opcoes.variacao:
                continue
            inicio = time.monotonic()
            semente = 1300 + 3 * livro + indice + 1000 * opcoes.variacao
            if opcoes.frases:
                frases = re.split(r"(?<=[.!?])\s+", texto)
                pausa = np.zeros(round(0.11 * modelo.sr), dtype="float32")
                trechos = []
                for ordem, frase in enumerate(frases):
                    trechos.extend([sintetizar(modelo, frase, opcoes.dispositivo, semente + ordem), pausa])
                audio = np.concatenate(trechos[:-1])
            else:
                audio = sintetizar(modelo, texto, opcoes.dispositivo, semente)
            provisoria = arquivo.with_suffix(".wav.tmp")
            soundfile.write(provisoria, audio, modelo.sr, format="WAV")
            provisoria.replace(arquivo)
            duracao = len(audio) / modelo.sr
            print(f"{livro:02d}/{len(roteiros)} · {id_quadro} · {duracao:.1f}s em {time.monotonic() - inicio:.1f}s", flush=True)


if __name__ == "__main__":
    main()
