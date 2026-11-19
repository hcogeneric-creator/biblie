(() => {
  "use strict";

  const [livros] = window.BIBLIE;
  const $ = id => document.getElementById(id);
  const campo = $("referenciaPassagem");
  const lista = $("sugestoesPassagem");
  const status = $("statusPassagem");
  const selecao = $("selecaoPassagem");
  const livroSelect = $("livroPassagem");
  const capituloSelect = $("capituloPassagem");
  const versoSelect = $("versiculoPassagem");
  const abrirSelect = $("abrirSelecaoPassagem");

  const siglas = (
    "gn ex lv nm dt js jz rt 1sm 2sm 1rs 2rs 1cr 2cr ed ne et jo sl pv ec ct is jr lm ez dn os jl am ob jn mq na hc sf ag zc ml " +
    "mt mc lc jo at rm 1co 2co gl ef fp cl 1ts 2ts 1tm 2tm tt fm hb tg 1pe 2pe 1jo 2jo 3jo jd ap"
  ).split(" ");
  const aliases = {
    JOB: ["job"], PSA: ["salmo", "sal"], SOL: ["canticos", "cantico dos canticos", "cantares de salomao", "sng"],
    EZE: ["ezk"], JOE: ["jol"], NAH: ["nam"], MAR: ["mrk"], JOH: ["jhn", "jn"], PHI: ["php"],
    JAM: ["jas"], "1JO": ["1jn"], "2JO": ["2jn"], "3JO": ["3jn"], PHM: ["filemon"],
  };

  function normalizar(texto) {
    return texto.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim()
      .replace(/^(iii|ii|i)\s+(?=[a-z])/, numeral => ({ i: "1", ii: "2", iii: "3" })[numeral.trim()])
      .replace(/\s+/g, "").replace(/[–—−]/g, "-");
  }

  const catalogo = Object.entries(livros).map(([codigo, [nome]], indice) => ({
    codigo,
    chaves: [nome, codigo, siglas[indice], ...(aliases[codigo] || [])].map(normalizar),
  }));
  let itens = [];
  let ativo = -1;

  function buscar(texto) {
    const consulta = normalizar(texto);
    if (!consulta) return {};
    const partes = /^(\d?[a-z]+)(\d+)?(?:[:.,](\d*)(?:-(\d*))?)?$/.exec(consulta);
    if (!partes) return { mensagem: "Digite uma referência como João 3:16 ou 1 Co 13:4-7." };
    const [, nome, cap, vers, fim] = partes;
    const exatos = catalogo.filter(({ chaves }) => chaves.includes(nome));
    // “Jo” costuma indicar João sem acento. “Jó” é um nome completo distinto.
    const primeiro = texto.trim().toLowerCase().replace(/\s/g, "").startsWith("jó") ? "JOB" : "JOH";
    exatos.sort(({ codigo: a }, { codigo: b }) => Number(b === primeiro) - Number(a === primeiro));
    const livrosEncontrados = cap && exatos.length ? exatos : [
      ...exatos,
      ...catalogo.filter(livro => !exatos.includes(livro) && livro.chaves.some(chave => chave.startsWith(nome))),
    ];
    if (!livrosEncontrados.length) return { mensagem: "Livro não encontrado." };

    const sugestoes = [];
    const alvos = [];
    for (const { codigo } of livrosEncontrados) {
      const [, , capitulos] = livros[codigo];
      if (!cap) {
        sugestoes.push({ codigo });
        continue;
      }
      if (vers === undefined) {
        if (capitulos[Number(cap)]) alvos.push({ codigo, capitulo: Number(cap) });
        for (const numero of Object.keys(capitulos)) {
          if (numero.startsWith(cap)) sugestoes.push({ codigo, capitulo: Number(numero) });
        }
        continue;
      }
      const versos = capitulos[Number(cap)]?.map(([numero]) => numero) || [];
      const capitulo = Number(cap);
      const inicio = Number(vers);
      const final = Number(fim);
      if (fim !== undefined) {
        if (versos.includes(inicio) && versos.includes(final) && final >= inicio) {
          alvos.push({ codigo, capitulo, inicio, final });
        }
        continue;
      }
      if (versos.includes(inicio)) alvos.push({ codigo, capitulo, inicio });
      for (const numero of versos) {
        if (String(numero).startsWith(vers)) sugestoes.push({ codigo, capitulo, inicio: numero });
      }
    }
    const resultado = [...alvos, ...sugestoes.filter(sugestao =>
      !alvos.some(alvo => rotulo(alvo) === rotulo(sugestao)))].slice(0, 8);
    if (resultado.length) return { resultado, alvo: cap ? alvos[0] : resultado[0] };
    return { mensagem: "Confira o capítulo e os versículos dessa referência." };
  }

  function rotulo({ codigo, capitulo, inicio, final }) {
    let nome = livros[codigo][0];
    if (capitulo) nome += " " + capitulo;
    if (inicio) nome += ":" + inicio;
    if (final && final !== inicio) nome += "–" + final;
    return nome;
  }

  function mensagem(valor) {
    status.hidden = !valor;
    status.textContent = valor || "";
  }

  function destacar(indice) {
    ativo = indice;
    [...lista.children].forEach((opcao, i) => opcao.setAttribute("aria-selected", String(i === indice)));
    const opcao = lista.children[indice];
    if (opcao) {
      campo.setAttribute("aria-activedescendant", opcao.id);
      opcao.scrollIntoView({ block: "nearest" });
    } else {
      campo.removeAttribute("aria-activedescendant");
    }
  }

  function mostrar(resultado = []) {
    itens = resultado;
    lista.replaceChildren(...itens.map((item, indice) => {
      const opcao = document.createElement("li");
      opcao.id = "sugestaoPassagem-" + indice;
      opcao.dataset.indice = indice;
      opcao.setAttribute("role", "option");
      opcao.textContent = rotulo(item);
      return opcao;
    }));
    lista.hidden = !itens.length;
    campo.setAttribute("aria-expanded", String(Boolean(itens.length)));
    destacar(-1);
  }

  function abrir(alvo) {
    campo.value = rotulo(alvo);
    mensagem();
    mostrar();
    if (!alvo.capitulo) {
      campo.value += " ";
      campo.focus({ preventScroll: true });
      return;
    }
    const { codigo, capitulo, inicio, final } = alvo;
    let hash = "#" + codigo + "." + capitulo;
    if (inicio) hash += "." + inicio;
    if (final && final !== inicio) hash += "-" + final;
    selecao.open = false;
    campo.blur();
    window.addEventListener("hashchange", () => {
      const destino = document.querySelector(".versiculo-destacado") || $("titulo");
      destino.scrollIntoView({ block: inicio ? "center" : "start" });
      destino.focus({ preventScroll: true });
    }, { once: true });
    if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange"));
    else location.hash = hash;
  }

  function atualizar() {
    const { resultado } = buscar(campo.value);
    mensagem();
    mostrar(resultado);
  }

  campo.addEventListener("input", atualizar);
  campo.addEventListener("focus", () => {
    if (campo.value.trim()) atualizar();
  });
  campo.addEventListener("keydown", evento => {
    if (evento.isComposing) return;
    if (evento.key === "Escape" && !lista.hidden) {
      evento.preventDefault();
      mostrar();
    } else if (["ArrowDown", "ArrowUp"].includes(evento.key)) {
      if (lista.hidden) atualizar();
      if (!itens.length) return;
      evento.preventDefault();
      const passo = evento.key === "ArrowDown" ? 1 : -1;
      destacar(ativo < 0 && passo < 0 ? itens.length - 1 : (ativo + passo + itens.length) % itens.length);
    }
  });
  lista.addEventListener("mousedown", evento => evento.preventDefault());
  lista.addEventListener("click", evento => {
    const opcao = evento.target.closest("[data-indice]");
    if (opcao) abrir(itens[Number(opcao.dataset.indice)]);
  });
  $("formPassagem").addEventListener("submit", evento => {
    evento.preventDefault();
    const { resultado, alvo, mensagem: erro } = buscar(campo.value);
    const selecionado = itens[ativo] || alvo;
    if (selecionado) abrir(selecionado);
    else {
      mostrar(resultado);
      mensagem(erro || (resultado ? "Escolha uma das sugestões." : "Digite o nome de um livro da Bíblia."));
    }
  });
  document.addEventListener("pointerdown", evento => {
    if (!$("formPassagem").contains(evento.target)) mostrar();
  });
  $("formPassagem").addEventListener("focusout", evento => {
    if (!$("formPassagem").contains(evento.relatedTarget)) mostrar();
  });

  function opcoes(select, rotuloInicial, pares = []) {
    select.replaceChildren(new Option(rotuloInicial, ""), ...pares.map(([valor, nome]) => new Option(nome, valor)));
  }

  opcoes(livroSelect, "Selecione", catalogo.map(({ codigo }) => [codigo, livros[codigo][0]]));
  opcoes(capituloSelect, "Selecione");
  opcoes(versoSelect, "Capítulo inteiro");

  livroSelect.addEventListener("change", () => {
    const capitulos = livros[livroSelect.value]?.[2];
    opcoes(capituloSelect, "Selecione", Object.keys(capitulos || {}).map(n => [n, n]));
    capituloSelect.disabled = !capitulos;
    capituloSelect.dispatchEvent(new Event("change"));
  });
  capituloSelect.addEventListener("change", () => {
    const versos = livros[livroSelect.value]?.[2][capituloSelect.value];
    opcoes(versoSelect, "Capítulo inteiro", versos?.map(([n]) => [n, n]));
    versoSelect.disabled = !versos;
    abrirSelect.disabled = !versos;
  });
  $("formSelecaoPassagem").addEventListener("submit", evento => {
    evento.preventDefault();
    abrir({ codigo: livroSelect.value, capitulo: Number(capituloSelect.value), inicio: Number(versoSelect.value) });
  });
  $("buscaPassagem").hidden = false;
})();
