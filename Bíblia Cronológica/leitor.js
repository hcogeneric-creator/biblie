(() => {
  "use strict";
  const [livros, blocos, resumos] = window.BIBLIE;
  const codigos = Object.keys(livros);
  const aliasesUsfm = {
    SNG: "SOL", EZK: "EZE", JOL: "JOE", NAM: "NAH", MRK: "MAR",
    JHN: "JOH", PHP: "PHI", JAS: "JAM", "1JN": "1JO", "2JN": "2JO", "3JN": "3JO",
  };
  const codigosUsfm = Object.fromEntries(Object.entries(aliasesUsfm).map(([usfm, vpl]) => [vpl, usfm]));
  const epocas = [...new Set(blocos.map(([epoca]) => epoca))];
  const cronologia = blocos.flatMap((bloco, i) => bloco[2].map((item, j) => ({ item, i, j })));
  const canonica = codigos.flatMap(codigo => Object.keys(livros[codigo][2]).map(n => [codigo, Number(n)]));
  const ui = Object.fromEntries(
    [...document.querySelectorAll("[id]")].map(elemento => [elemento.id, elemento])
  );
  let modo = "cronologico";
  let posicao = 0;
  let mostrandoResumo = false;
  let versoSelecionado = 0;

  function opcoes(select, items, selecionado) {
    select.replaceChildren(...items.map(([value, label]) => new Option(label, value)));
    select.value = selecionado;
  }

  function referencia([codigo, capitulo, inicio, fim]) {
    const parte = inicio ? `:${inicio}–${fim}` : "";
    return `${livros[codigo][0]} ${capitulo}${parte}`;
  }

  function exibir(focar = false) {
    const cronologica = modo === "cronologico";
    const entrada = cronologica ? cronologia[posicao] : null;
    const item = entrada ? entrada.item : canonica[posicao];
    const [codigo, capitulo, inicio, fim] = item;
    const [nomeLivro, pasta, capitulos] = livros[codigo];
    ui.cronologico.checked = cronologica;
    ui.canonico.checked = !cronologica;
    ui.filtroCronologico.hidden = !cronologica;
    ui.filtroCanonico.hidden = cronologica;
    if (cronologica) {
      const [epoca, titulo, trechos] = blocos[entrada.i];
      const blocosDaEpoca = blocos.flatMap(([grupo, nome], i) => grupo === epoca ? [[i, nome]] : []);
      ui.epoca.value = epoca;
      opcoes(ui.bloco, blocosDaEpoca, entrada.i);
      opcoes(ui.trecho, trechos.map((trecho, i) => [i, referencia(trecho)]), entrada.j);
      ui.contexto.textContent = epoca;
      ui.subtitulo.textContent = mostrandoResumo ? "Resumo do livro" : titulo;
    } else {
      ui.livro.value = codigo;
      opcoes(ui.capitulo, Object.keys(capitulos).map(n => [n, `Capítulo ${n}`]), capitulo);
      ui.contexto.textContent = codigos.indexOf(codigo) < 39 ? "Antigo Testamento" : "Novo Testamento";
      ui.subtitulo.textContent = mostrandoResumo ? "Resumo do livro" : "";
    }
    const titulo = mostrandoResumo ? nomeLivro : referencia(item);
    ui.titulo.textContent = titulo;
    document.title = `${titulo} · Biblie`;
    const hashAtual = cronologica ? `#bloco-${entrada.i + 1}.${entrada.j + 1}` : `#${codigo}.${capitulo}`;
    ui.resumo.href = mostrandoResumo ? hashAtual : `${hashAtual}.resumo`;
    ui.resumo.textContent = mostrandoResumo ? `Voltar a ${referencia(item)}` : `Resumo de ${nomeLivro}`;
    ui.texto.href = `../Livros/${pasta}/TEXTO.md`;
    const codigoUsfm = codigosUsfm[codigo] || codigo;
    ui.mapaCapitulo.href = `../Mapa/index.html?livro=${codigoUsfm}${mostrandoResumo ? "" : `&capitulo=${capitulo}`}`;
    ui.versiculos.hidden = mostrandoResumo;
    ui.conteudoResumo.hidden = !mostrandoResumo;
    ui.navegacao.hidden = mostrandoResumo;
    const fragmento = document.createDocumentFragment();
    if (mostrandoResumo) {
      for (const linha of resumos[codigo]) {
        const cabecalho = linha.startsWith("## ");
        const parte = document.createElement(cabecalho ? "h2" : "p");
        const prefixo = "**Passagens de referência.** ";
        if (linha.startsWith(prefixo)) {
          const rotulo = document.createElement("strong");
          rotulo.textContent = "Passagens de referência. ";
          parte.append(rotulo);
          const referencias = linha.slice(prefixo.length).split(/(, |\.$)/);
          for (const referencia of referencias) {
            const primeiroCapitulo = /^\d+/.exec(referencia)?.[0];
            if (primeiroCapitulo && capitulos[primeiroCapitulo]) {
              const link = document.createElement("a");
              link.href = `#${codigo}.${primeiroCapitulo}`;
              link.textContent = referencia;
              parte.append(link);
            } else {
              parte.append(referencia);
            }
          }
        } else {
          parte.textContent = cabecalho ? linha.slice(3) : linha.replaceAll("**", "");
        }
        fragmento.append(parte);
      }
      ui.conteudoResumo.replaceChildren(fragmento);
    } else {
      for (const [numero, versiculo] of capitulos[capitulo]) {
        if (inicio && (numero < inicio || numero > fim)) continue;
        const p = document.createElement("p");
        const marca = document.createElement("sup");
        marca.textContent = numero;
        p.append(marca, versiculo);
        if (numero === versoSelecionado) p.className = "versiculo-destacado";
        fragmento.append(p);
      }
      ui.versiculos.replaceChildren(fragmento);
    }
    ui.anterior.disabled = posicao === 0;
    ui.seguinte.disabled = posicao === (cronologica ? cronologia : canonica).length - 1;
    if (versoSelecionado) {
      ui.versiculos.querySelector(".versiculo-destacado")?.scrollIntoView({ block: "center" });
    } else if (focar) {
      ui.titulo.scrollIntoView({ block: "start" });
      ui.titulo.focus({ preventScroll: true });
    }
  }

  function abrir() {
    const hash = location.hash.slice(1);
    const trecho = /^bloco-(\d+)(?:\.(\d+))?(\.resumo)?$/.exec(hash);
    const capitulo = /^([A-Z0-9]{3})\.(\d+)(?:\.(resumo|\d+))?$/.exec(hash);
    mostrandoResumo = false;
    versoSelecionado = 0;
    if (capitulo) {
      const [, livro, n, tipo] = capitulo;
      const codigo = aliasesUsfm[livro] || livro;
      const indice = canonica.findIndex(([c, numero]) => c === codigo && numero === Number(n));
      if (indice !== -1) {
        modo = "canonico";
        posicao = indice;
        mostrandoResumo = Boolean(tipo === "resumo" && resumos[codigo]);
        versoSelecionado = mostrandoResumo ? 0 : Number(tipo) || 0;
        exibir();
        return;
      }
    }
    modo = "cronologico";
    const indice = trecho ? cronologia.findIndex(({ i, j }) => i === Number(trecho[1]) - 1 && j === Number(trecho[2] || 1) - 1) : -1;
    posicao = Math.max(indice, 0);
    mostrandoResumo = Boolean(indice >= 0 && trecho[3] && resumos[cronologia[indice].item[0]]);
    exibir();
  }

  function selecionar(novoModo, indice, focar = false) {
    if (indice < 0) return;
    modo = novoModo;
    posicao = indice;
    mostrandoResumo = false;
    versoSelecionado = 0;
    let hash;
    if (modo === "cronologico") {
      const { i, j } = cronologia[indice];
      hash = `bloco-${i + 1}.${j + 1}`;
    } else {
      hash = canonica[indice].join(".");
    }
    if (location.hash !== `#${hash}`) history.pushState(null, "", `#${hash}`);
    exibir(focar);
  }

  opcoes(ui.epoca, epocas.map(epoca => [epoca, epoca]), epocas[0]);
  opcoes(ui.livro, codigos.map(codigo => [codigo, livros[codigo][0]]), codigos[0]);
  ui.epoca.addEventListener("change", () => selecionar("cronologico", cronologia.findIndex(({ i }) => blocos[i][0] === ui.epoca.value)));
  ui.bloco.addEventListener("change", () => selecionar("cronologico", cronologia.findIndex(({ i }) => i === Number(ui.bloco.value))));
  ui.trecho.addEventListener("change", () => selecionar("cronologico", cronologia.findIndex(({ i, j }) => i === Number(ui.bloco.value) && j === Number(ui.trecho.value))));
  ui.livro.addEventListener("change", () => selecionar("canonico", canonica.findIndex(([c]) => c === ui.livro.value)));
  ui.capitulo.addEventListener("change", () => selecionar("canonico", canonica.findIndex(([c, n]) => c === ui.livro.value && n === Number(ui.capitulo.value))));
  ui.cronologico.addEventListener("change", () => {
    const [c, n] = canonica[posicao];
    selecionar("cronologico", cronologia.findIndex(({ item }) => item[0] === c && item[1] === n));
  });
  ui.canonico.addEventListener("change", () => {
    const [c, n] = cronologia[posicao].item;
    selecionar("canonico", canonica.findIndex(([codigo, capitulo]) => codigo === c && capitulo === n));
  });
  ui.anterior.addEventListener("click", () => selecionar(modo, posicao - 1, true));
  ui.seguinte.addEventListener("click", () => selecionar(modo, posicao + 1, true));
  window.addEventListener("hashchange", abrir);
  window.addEventListener("popstate", abrir);
  abrir();
})();
