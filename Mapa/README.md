# Atlas bíblico

Abra [index.html](index.html) em um navegador. O atlas e a base cartográfica funcionam localmente, sem instalar bibliotecas ou acessar a internet. Os links para fontes e para o OpenStreetMap abrem sites externos.

1. Escolha um **episódio bíblico** para ver os lugares relacionados, o contexto e os links para a Bíblia do repositório. Os 44 episódios são uma seleção que vai de Gênesis a Apocalipse.
2. Use **Livro** e **Capítulo do livro** para encontrar as referências geográficas de uma passagem. Busque também por nome antigo, grafia equivalente em inglês ou nome de uma identificação moderna. A busca consulta todo o índice.
3. Ligue ou desligue **Mapa atual** e ajuste a opacidade para comparar os pontos bíblicos com as fronteiras e cidades modernas da base regional. A geografia física de fundo usa costa, lagos e rios modernos.
4. Clique em um lugar para ler os capítulos correspondentes, examinar as hipóteses e abrir uma posição no **Mapa atual detalhado**. Um marcador tracejado representa uma região ou povo.

## Cobertura e interpretação

O índice reúne as 1.342 entradas do gazetteer consultado, incluindo referências difíceis de localizar. O recorte inicial prioriza lugares conhecidos e os episódios do atlas. A seleção tem 190 nomes e variantes em português. O restante preserva a grafia da base em inglês. Povos aparecem associados a uma região ou a um ponto de referência, e fronteiras históricas podem mudar bastante conforme a época.

Cada lugar exibe até três candidatos com coordenadas, ordenados por uma pontuação adaptada do OpenBible.info. Lugares sem coordenadas utilizáveis aparecem na lista. As cores descrevem a evidência da **identificação geográfica**. Marcadores regionais representam a posição usada no atlas e podem ter uma área estimada quando a fonte fornece um raio. Círculos e pontos aproximados indicam referências espaciais. Os recortes por episódio reúnem lugares do texto ou do contexto e não traçam estradas presumidas. A localização de um sítio arqueológico e a comprovação dos acontecimentos narrados são perguntas distintas.

As categorias usam o escore ponderado da hipótese, ajustado pelo escore de resolução quando disponível. Um ponto com escore de pelo menos 800, sem concorrente que alcance metade do escore e com identificação pontual na fonte, aparece como bem identificado. Identificações não pontuais ou de escore entre 550 e 799, sem concorrência equivalente, aparecem como aproximadas. As demais aparecem como disputadas. Essa classificação editorial simplifica a evidência disponível, sem pretensão de medir probabilidades estatísticas. Cada ficha aponta para a bibliografia original.

A base cartográfica abrange o Mediterrâneo, nordeste da África, Oriente Médio e áreas adjacentes. Os limites modernos seguem os dados de referência do Natural Earth, cuja metodologia geral adota controle de facto. Topônimos, hidrografia e fronteiras refletem a escala do levantamento. [Sobre os dados do Natural Earth](https://www.naturalearthdata.com/about/)

## Fontes e licenças

- **OpenBible.info**, *Bible Geocoding Data*. Atribuição dos nomes originais, referências, posições e escores. O atlas seleciona candidatos, adiciona nomes e notas em português e converte os dados para uso local. [Conjunto de dados consultado](https://github.com/openbibleinfo/Bible-Geocoding-Data/tree/7eb18a5ee62f27b9b93bd6689ea272d76dd23b8f) · [Licença CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- **Natural Earth**, camadas Admin 0 Countries, Land e Lakes em escala 1:10 milhões, e Rivers + Lake Centerlines e Populated Places em 1:50 milhões. O atlas aplica recorte regional e simplificação geométrica. [Base consultada](https://github.com/nvkelso/natural-earth-vector/tree/ca96624a56bd078437bca8184e78163e5039ad19) · [Domínio público](https://www.naturalearthdata.com/about/terms-of-use/)
- **UNESCO World Heritage Centre** e **Departamento de Antiguidades e Patrimônio do Iraque**, para contexto e identificação de sítios selecionados. [Jericó antiga](https://whc.unesco.org/en/list/1687/) · [Babilônia](https://whc.unesco.org/en/list/278/) · [Nínive](https://whc.unesco.org/en/tentativelists/1465/) · [Megido, Hazor e Berseba](https://whc.unesco.org/en/list/1108/) · [Susã](https://whc.unesco.org/en/list/1455/) · [Éfeso](https://whc.unesco.org/en/list/1018/) · [Filipos](https://whc.unesco.org/en/list/1517/) · [Tiro](https://whc.unesco.org/en/list/299/) · [Sítio batismal de Al-Maghtas](https://whc.unesco.org/en/list/1446/)
- **Leaflet 1.9.4**, biblioteca de navegação do mapa distribuída na pasta `leaflet`. [Página oficial](https://leafletjs.com/download) · [Licença BSD de 2 cláusulas](leaflet/LICENSE)

## Links diretos

| Exemplo | Abre |
| --- | --- |
| [index.html?lugar=jerusalem](index.html?lugar=jerusalem) | Ficha de Jerusalém |
| [index.html?episodio=44](index.html?episodio=44) | Patmos e as sete igrejas |
| [index.html?livro=GEN&capitulo=12](index.html?livro=GEN&capitulo=12) | Lugares indexados em Gênesis 12 |
| [index.html?q=Fil%C3%ADstia](index.html?q=Fil%C3%ADstia) | Busca por Filístia |
