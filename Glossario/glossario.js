(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const busca = $("buscarTermo");
  const idioma = $("idiomaTermo");
  const letras = $("letrasGlossario");
  const total = $("totalGlossario");
  const lista = $("listaGlossario");
  const mais = $("maisGlossario");
  const leitor = "../B%C3%ADblia%20Cronol%C3%B3gica/index.html";
  const comparar = new Intl.Collator("pt-BR").compare;
  let letra = "";
  const porPagina = 30;
  let limite = porPagina;

  function normalizar(texto) {
    return texto.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "")
      .replace(/[-‐‑–—]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function idDoTermo(nome) {
    return "termo-" + nome.replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");
  }

  function elemento(tag, classe, texto) {
    const node = document.createElement(tag);
    if (classe) node.className = classe;
    if (texto) node.textContent = texto;
    return node;
  }

  const verbetes = window.BIBLIE_GLOSSARIO
    .map(verbete => {
      const nome = normalizar(verbete.termo);
      const termos = [nome, ...verbete.variantes.map(normalizar)];
      const conteudo = normalizar([verbete.original, verbete.traducao, verbete.contexto, verbete.referencia].join(" "));
      return { ...verbete, nome, termos, conteudo, letra: nome[0].toUpperCase(), origem: normalizar(verbete.idioma) };
    })
    .sort((a, b) => comparar(a.termo, b.termo));

  function cartao(verbete) {
    const artigo = elemento("article", "glossario-verbete");
    artigo.id = idDoTermo(verbete.nome);
    const origem = elemento("p", "glossario-origem");
    if (verbete.original) origem.append(elemento("bdi", "", verbete.original));
    origem.append(elemento("span", "", verbete.idioma));
    artigo.append(
      elemento("h2", "", verbete.termo), origem,
      elemento("p", "glossario-definicao", verbete.traducao),
      elemento("p", "glossario-contexto", verbete.contexto),
    );
    if (verbete.referencia || verbete.fonte) {
      const links = elemento("div", "glossario-links");
      if (verbete.referencia) {
        const passagem = elemento("a", "", verbete.referencia);
        passagem.href = leitor + "#" + verbete.link;
        links.append(passagem);
      }
      if (verbete.fonte) {
        const fonte = elemento("a", "", "Fonte do verbete");
        fonte.href = verbete.fonte;
        links.append(fonte);
      }
      artigo.append(links);
    }
    return artigo;
  }

  function atualizar(focar = null) {
    const consulta = normalizar(busca.value);
    const grafia = consulta.replace(/\s/g, "");
    const palavras = consulta ? consulta.split(/\s+/) : [];
    const resultados = [];
    for (const verbete of verbetes) {
      if ((letra && verbete.letra !== letra) || (idioma.value && !verbete.origem.includes(idioma.value))) continue;
      const indice = verbete.termos.findIndex(termo => termo.replace(/\s/g, "") === grafia);
      const prioridade = !consulta ? 0 : indice === 0 ? 0 : indice > 0 ? 1 :
        verbete.termos.some(termo => termo.startsWith(consulta)) ? 2 : 3;
      if (prioridade < 3 || palavras.every(palavra => verbete.termos.some(termo => termo.includes(palavra)) || verbete.conteudo.includes(palavra))) {
        resultados.push({ verbete, prioridade });
      }
    }
    resultados.sort((a, b) => a.prioridade - b.prioridade);
    total.textContent = resultados.length === 1 ? "1 verbete" :
      resultados.length ? resultados.length + " verbetes" : "Nenhum verbete encontrado.";
    lista.replaceChildren(...resultados.slice(0, limite).map(({ verbete }) => cartao(verbete)));
    mais.hidden = resultados.length <= limite;
    if (focar !== null) {
      const primeiroNovo = lista.children[focar];
      primeiroNovo?.setAttribute("tabindex", "-1");
      primeiroNovo?.focus();
    }
  }

  function reiniciar() {
    limite = porPagina;
    atualizar();
  }

  for (const valor of ["", ...new Set(verbetes.map(verbete => verbete.letra))]) {
    const botao = elemento("button", "", valor || "Todas");
    botao.type = "button";
    botao.setAttribute("aria-pressed", String(valor === ""));
    botao.addEventListener("click", () => {
      letra = valor;
      letras.querySelector('[aria-pressed="true"]').setAttribute("aria-pressed", "false");
      botao.setAttribute("aria-pressed", "true");
      reiniciar();
    });
    letras.append(botao);
  }

  busca.value = new URLSearchParams(location.search).get("q") ?? "";
  busca.addEventListener("input", reiniciar);
  idioma.addEventListener("change", reiniciar);
  busca.form.addEventListener("submit", event => event.preventDefault());
  mais.addEventListener("click", () => {
    const anterior = limite;
    limite += porPagina;
    atualizar(anterior);
  });
  const destino = location.hash.slice(1);
  const posicao = verbetes.findIndex(verbete => idDoTermo(verbete.nome) === destino);
  if (posicao >= limite) limite = Math.ceil((posicao + 1) / porPagina) * porPagina;
  atualizar();
  $("consultaGlossario").hidden = false;
  if (posicao >= 0) document.getElementById(destino)?.scrollIntoView();
})();
