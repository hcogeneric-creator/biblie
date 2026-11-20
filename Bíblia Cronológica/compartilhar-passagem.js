(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const leitura = $("versiculos");
  const acoes = $("acoesVersiculos");
  const cartao = $("dialogoCartao");
  const copia = $("dialogoCopia");
  const previa = $("previaCartao");
  const baixar = $("salvarCartao");
  const compartilhar = $("enviarCartao");
  const status = $("statusCartao");
  const { criar, referencia, fonteTraducao } = window.BiblieCartaoPassagem;
  let selecao = null;
  let ancora = null;
  let geracao;
  let imagens = [];
  let indice = 0;
  let arquivo;
  let url;

  function apresentar(versos) {
    const { livro, capitulo } = leitura.dataset;
    const ref = versos.length ? referencia(livro, capitulo, versos[0].numero, versos.at(-1).numero) : "";
    selecao = ref ? { livro, capitulo, ref, versos } : null;
    const numeros = new Set(versos.map(verso => verso.numero));
    for (const elemento of leitura.querySelectorAll("[data-versiculo]")) {
      const marcado = numeros.has(Number(elemento.dataset.versiculo));
      elemento.classList.toggle("versiculo-selecionado", marcado);
      elemento.firstElementChild.setAttribute("aria-pressed", String(marcado));
    }
    $("referenciaSelecionada").textContent = ref;
    $("statusCopiaVersiculos").textContent = "";
    acoes.hidden = !selecao;
    document.body.classList.toggle("biblie-com-selecao", Boolean(selecao));
  }

  function limpar() {
    ancora = null;
    const nativa = window.getSelection();
    if (nativa?.anchorNode && leitura.contains(nativa.anchorNode)) nativa.removeAllRanges();
    apresentar([]);
  }

  leitura.addEventListener("biblie:passagem", () => {
    if (cartao.open) cartao.close();
    if (copia.open) copia.close();
    limpar();
  });

  leitura.addEventListener("click", event => {
    const botao = event.target.closest(".versiculo-marcar");
    if (!botao) return;
    const numero = Number(botao.parentElement.dataset.versiculo);
    if (ancora === numero && selecao?.versos.length === 1) {
      limpar();
      return;
    }
    window.getSelection()?.removeAllRanges();
    ancora ??= numero;
    const inicio = Math.min(ancora, numero);
    const fim = Math.max(ancora, numero);
    apresentar([...leitura.querySelectorAll("[data-versiculo]")].flatMap(elemento => {
      const valor = Number(elemento.dataset.versiculo);
      if (valor < inicio || valor > fim) return [];
      return [{ numero: valor, texto: elemento.querySelector("[data-texto-versiculo]").textContent }];
    }));
  });

  document.addEventListener("selectionchange", () => {
    const nativa = window.getSelection();
    if (!nativa?.rangeCount || nativa.isCollapsed || leitura.hidden || cartao.open || copia.open) return;
    const intervalo = nativa.getRangeAt(0);
    if (!leitura.contains(intervalo.startContainer) || !leitura.contains(intervalo.endContainer)) return;
    const versos = [];
    for (const elemento of leitura.querySelectorAll("[data-texto-versiculo]")) {
      if (!intervalo.intersectsNode(elemento)) continue;
      const trecho = document.createRange();
      trecho.selectNodeContents(elemento);
      if (elemento.contains(intervalo.startContainer)) trecho.setStart(intervalo.startContainer, intervalo.startOffset);
      if (elemento.contains(intervalo.endContainer)) trecho.setEnd(intervalo.endContainer, intervalo.endOffset);
      const texto = trecho.toString().trim();
      if (texto) versos.push({ numero: Number(elemento.parentElement.dataset.versiculo), texto });
    }
    if (versos.length) {
      ancora = null;
      apresentar(versos);
    }
  });

  $("limparVersiculos").addEventListener("click", () => {
    const primeiro = leitura.querySelector(".versiculo-selecionado .versiculo-marcar");
    limpar();
    primeiro?.focus({ preventScroll: true });
  });

  $("copiarVersiculos").addEventListener("click", async () => {
    const atual = selecao;
    if (!atual) return;
    const texto = atual.versos.map(verso => verso.texto).join("\n") + "\n\n" + atual.ref +
      "\n" + fonteTraducao + "\nhttps://creativecommons.org/licenses/by/4.0/";
    try {
      await navigator.clipboard.writeText(texto);
      if (selecao === atual) $("statusCopiaVersiculos").textContent = "Texto copiado.";
    } catch {
      if (selecao !== atual) return;
      const campo = $("textoParaCopiar");
      campo.value = texto;
      copia.showModal();
      campo.focus();
      campo.select();
    }
  });

  function liberarUrl() {
    if (url) URL.revokeObjectURL(url);
    url = null;
  }

  function limparCartao() {
    geracao?.abort();
    geracao = null;
    liberarUrl();
    imagens = [];
    arquivo = null;
    previa.removeAttribute("src");
    baixar.removeAttribute("href");
    for (const elemento of [previa, baixar, compartilhar, $("paginasCartao")]) elemento.hidden = true;
  }

  function mostrarCartao() {
    const { blob, nome, ref } = imagens[indice];
    liberarUrl();
    arquivo = new File([blob], nome, { type: "image/png" });
    url = URL.createObjectURL(arquivo);
    previa.src = url;
    previa.alt = "Cartão de " + ref;
    previa.hidden = false;
    baixar.href = url;
    baixar.download = nome;
    baixar.hidden = false;
    compartilhar.hidden = !(navigator.share && navigator.canShare?.({ files: [arquivo] }));
    status.textContent = compartilhar.hidden ? "Salve o PNG para anexar no WhatsApp." : "";
    $("paginasCartao").hidden = imagens.length === 1;
    $("posicaoCartao").textContent = "Cartão " + (indice + 1) + " de " + imagens.length;
    $("cartaoAnterior").disabled = indice === 0;
    $("cartaoSeguinte").disabled = indice === imagens.length - 1;
  }

  $("criarCartaoVersiculos").addEventListener("click", async () => {
    if (!selecao || cartao.open) return;
    limparCartao();
    const controle = new AbortController();
    geracao = controle;
    status.textContent = "Preparando imagem…";
    cartao.showModal();
    try {
      const novas = await criar(selecao, controle.signal);
      if (controle.signal.aborted || geracao !== controle || !cartao.open) return;
      imagens = novas;
      indice = 0;
      mostrarCartao();
    } catch {
      if (!controle.signal.aborted) status.textContent = "Não foi possível gerar a imagem. Feche e tente novamente.";
    }
  });

  $("cartaoAnterior").addEventListener("click", () => {
    if (indice > 0) {
      indice--;
      mostrarCartao();
    }
  });
  $("cartaoSeguinte").addEventListener("click", () => {
    if (indice < imagens.length - 1) {
      indice++;
      mostrarCartao();
    }
  });
  compartilhar.addEventListener("click", async () => {
    if (!arquivo) return;
    try {
      await navigator.share({ files: [arquivo] });
    } catch (error) {
      if (error.name !== "AbortError" && cartao.open) status.textContent = "Salve o PNG para anexar no WhatsApp.";
    }
  });
  cartao.addEventListener("close", () => {
    if (!cartao.open) limparCartao();
  });
})();
