# Ilustrações do Biblie

- [Parábolas](../PARABOLAS/index.html) — abra **História ilustrada** na ficha para acompanhar os quadros em ordem.
- [Livros da Bíblia](../index.html#livros) — abra **Resumo** junto ao título do livro para ver suas cenas.
- [Atlas bíblico](../Mapa/index.html) — abra uma ficha de região ou povo para consultar **Região e vida na época**. A identificação geográfica e suas alternativas ficam no mapa interativo.

Cada imagem é uma interpretação artística gerada por IA. O Biblie conserva as referências bíblicas ao lado dos quadros e identifica cenas simbólicas e reconstruções de contexto.

## Prompts de geração

Cada linha dos arquivos abaixo descreve um quadro completo e registra o título, a referência e o nome do arquivo correspondente.

- [Parábolas, 144 quadros](prompts-parabolas.jsonl)
- [Livros, 132 quadros](prompts-livros.jsonl) e [24 quadros complementares](prompts-livros-extra.jsonl)
- [Atlas, 192 quadros](prompts-atlas.jsonl) e [25 quadros complementares de vida cotidiana](prompts-povos-extra.jsonl). [Fontes e critérios do atlas](FONTES-ATLAS.md).

A geração usa GPT Image 2.6 Flare via OpenAI Image API, em 1536 × 1024 pixels, qualidade média. As imagens estão em WebP para leitura local. O [plano de produção](PLANO.md) detalha as quatro etapas e a estimativa de custos.

Depois de incluir ou atualizar os arquivos locais, o comando `python scripts/gerar_galerias.py` regenera o índice das galerias a partir dos prompts. Use `--exigir-completude` para conferir se todas as imagens previstas estão presentes.
