# Biblie

Abra o [portal Biblie](index.html) no navegador para acessar a biblioteca local. Os livros, as parábolas e o catálogo de personagens podem ser consultados sem instalar um servidor.

Nas parábolas, use **Apresentar em tela cheia** para ouvir a história em três quadros. A legenda acompanha cada palavra da narração. **Play** e **Pause** controlam a reprodução, as setas do teclado mudam de quadro e **Fechar** volta à ficha. A transcrição também está disponível para leitura.

Em **Personagens ilustrados**, selecione um card para abrir a ficha. Na genealogia, abra **Ascendência** ou **Descendência** e expanda os ramos disponíveis para explorar até três gerações por ficha.

Antes de publicar no GitHub Pages, execute `python scripts/versionar_site.py` e inclua as páginas e `versao.json` no commit. O navegador consulta a versão publicada ao abrir a página ou voltar para a aba e carrega os scripts e estilos pelo hash do conteúdo.

| Área | Conteúdo |
| --- | --- |
| [Bíblia Cronológica](B%C3%ADblia%20Cronol%C3%B3gica/index.html) | Leitor em sequência cronológica ou canônica, com o texto dos 66 livros. |
| [Roteiro cronológico](B%C3%ADblia%20Cronol%C3%B3gica/ROTEIRO.md) | 58 blocos de leitura, com épocas, temas e referências. |
| [Livros e resumos](index.html#livros) | Índice por livro. As pastas em `Livros/` contêm `TEXTO.md` e `RESUMO.md`. |
| [Personagens Bíblicos](Personagens%20B%C3%ADblicos/index.html) | Perfis, genealogias, relações documentadas e prompts de avatar para o ChatGPT. |
| [Mulheres da Bíblia](Mulheres%20da%20B%C3%ADblia/index.html) | Seleção do Antigo e do Novo Testamento com passagens da Bíblia Livre, contexto e links para o leitor. |
| [Parábolas](PARABOLAS/index.html) | Histórias em linguagem própria, ensinamentos e referências ao texto bíblico. |
| [Mapa](Mapa/index.html) | Cidades e povos citados na Bíblia, com filtros por episódio, livro e capítulo e uma camada de geografia atual. |
| [Ilustrações](Ilustra%C3%A7%C3%B5es/README.md) | Quadros das parábolas, dos resumos e do atlas, com os prompts de geração e o plano de produção. |
| [Fonte bíblica e licença](Fonte/README.md) | Arquivo baixado, proveniência, licença e verificação de integridade. |

O projeto usa os **66 livros do cânon protestante**, conforme a edição escolhida da Bíblia Livre (BLIVRE), em português do Brasil. A cronologia é uma organização editorial aproximada. Os critérios explicam as associações temáticas e as datas debatidas. [Critérios e fontes](B%C3%ADblia%20Cronol%C3%B3gica/README.md).

## Conferência

A [tabela de proporções](Livros/VERIFICACAO.md) compara a contagem de palavras de cada resumo com a do texto do respectivo livro. Para recriar o leitor, o roteiro e a tabela e conferir os 31.102 versículos e os 66 resumos, execute na raiz do repositório com Python 3.10 ou mais recente:

```sh
python scripts/gerar_biblia.py --exigir-resumos
```

Os roteiros de narração estão em `PARABOLAS/narracoes.json`. Para gerar uma nova edição com o Chatterbox PT-BR, use o ambiente Python do Chatterbox com os pesos já baixados e um WAV curto da voz de referência. Para alinhar as palavras e montar os MP3, use um ambiente com faster-whisper, o modelo Whisper já baixado, NumPy, SoundFile e FFmpeg.

```sh
python scripts/sintetizar_parabolas.py --modelo pasta-do-modelo --referencia voz.wav --saida wavs
python scripts/montar_narracoes.py verificar --entrada wavs --marcas marcas --whisper medium
python scripts/montar_narracoes.py montar --entrada wavs --marcas marcas
python scripts/versionar_site.py
```
