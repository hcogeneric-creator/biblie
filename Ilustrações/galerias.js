(() => {
  const base = new URL('./imagens/', document.currentScript.src);
  const dados = window.BIBLIE_CENAS;
  let visor;

  function criarVisor() {
    const dialogo = document.createElement('dialog');
    dialogo.className = 'biblie-visor';
    dialogo.setAttribute('aria-labelledby', 'visor-titulo');
    dialogo.innerHTML = `
      <header>
        <h2 id="visor-titulo"></h2>
        <div class="biblie-visor-acoes">
          <button type="button" data-tela-cheia hidden>Tela cheia</button>
          <button type="button" data-fechar>Fechar</button>
        </div>
      </header>
      <div class="biblie-visor-palco"></div>
      <div class="biblie-visor-base">
        <p data-legenda aria-live="polite"></p>
        <nav aria-label="Navegar pelos quadros">
          <button type="button" data-anterior>Anterior</button>
          <button type="button" data-play hidden>Play</button>
          <button type="button" data-proximo>Próximo</button>
        </nav>
      </div>`;
    document.body.append(dialogo);
    const palco = dialogo.querySelector('.biblie-visor-palco');
    const anterior = dialogo.querySelector('[data-anterior]');
    const proximo = dialogo.querySelector('[data-proximo]');
    const fechar = dialogo.querySelector('[data-fechar]');
    const legenda = dialogo.querySelector('[data-legenda]');
    const play = dialogo.querySelector('[data-play]');
    const telaCheia = dialogo.querySelector('[data-tela-cheia]');
    const tempoQuadro = 5000;
    let cenas;
    let posicao;
    let tocando = false;
    let apresentacao = false;
    let carregando = false;
    let versao = 0;
    let relogio;
    let retorno;
    let telaAtivada = false;

    function agendar() {
      clearTimeout(relogio);
      if (!tocando || carregando) return;
      relogio = setTimeout(() => {
        if (posicao === cenas.length - 1) controlar(false);
        else percorrer(1);
      }, tempoQuadro);
    }

    function controlar(valor) {
      tocando = valor;
      play.textContent = tocando ? 'Pause' : 'Play';
      agendar();
    }

    async function atualizar() {
      const pedido = ++versao;
      carregando = true;
      clearTimeout(relogio);
      const [arquivo, nome, referencia] = cenas[posicao];
      const imagem = new Image(1536, 1024);
      imagem.src = new URL(arquivo, base);
      imagem.alt = nome;
      const foco = document.activeElement;
      anterior.disabled = posicao === 0;
      proximo.disabled = posicao === cenas.length - 1;
      if (foco === anterior && anterior.disabled) (proximo.disabled ? fechar : proximo).focus();
      if (foco === proximo && proximo.disabled) (anterior.disabled ? fechar : anterior).focus();
      try { await imagem.decode(); } catch { /* O texto alternativo continua disponível. */ }
      if (pedido !== versao || !dialogo.open) return;
      const anteriorImagem = palco.lastElementChild;
      anteriorImagem?.classList.remove('quadro-entrando');
      imagem.className = 'quadro-entrando';
      imagem.addEventListener('animationend', () => anteriorImagem?.remove(), {once: true});
      palco.replaceChildren(...(anteriorImagem ? [anteriorImagem, imagem] : [imagem]));
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) anteriorImagem?.remove();
      legenda.textContent = `${posicao + 1} de ${cenas.length} · ${nome} · ${referencia}`;
      if (apresentacao && cenas[posicao + 1]) new Image().src = new URL(cenas[posicao + 1][0], base);
      carregando = false;
      agendar();
    }

    function percorrer(passo) {
      const destino = posicao + passo;
      if (destino < 0 || destino >= cenas.length) return;
      posicao = destino;
      atualizar();
    }

    anterior.addEventListener('click', () => percorrer(-1));
    proximo.addEventListener('click', () => percorrer(1));
    play.addEventListener('click', () => {
      if (tocando) controlar(false);
      else {
        if (posicao === cenas.length - 1) {
          posicao = 0;
          atualizar();
        }
        controlar(true);
      }
    });

    async function alternarTelaCheia() {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await document.documentElement.requestFullscreen();
          telaAtivada = true;
          if (!dialogo.open) await document.exitFullscreen();
        }
      } catch { /* O modo de apresentação já ocupa a janela. */ }
    }
    telaCheia.addEventListener('click', alternarTelaCheia);
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) telaAtivada = false;
      telaCheia.textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia';
    });
    fechar.addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('close', () => {
      if (dialogo.open) return;
      ++versao;
      controlar(false);
      if (telaAtivada && document.fullscreenElement) document.exitFullscreen().catch(() => {});
      palco.replaceChildren();
      retorno?.focus({preventScroll: true});
    });
    dialogo.addEventListener('keydown', (evento) => {
      if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
      evento.preventDefault();
      percorrer(evento.key === 'ArrowLeft' ? -1 : 1);
    });

    return (titulo, sequencia, indice, exibirApresentacao = false) => {
      dialogo.querySelector('h2').textContent = titulo;
      cenas = sequencia;
      posicao = indice;
      apresentacao = exibirApresentacao;
      retorno = document.activeElement;
      dialogo.classList.toggle('biblie-apresentacao', apresentacao);
      play.hidden = !apresentacao;
      telaCheia.hidden = !apresentacao || !document.fullscreenEnabled;
      telaCheia.textContent = document.fullscreenElement ? 'Sair da tela cheia' : 'Tela cheia';
      dialogo.showModal();
      fechar.focus();
      atualizar();
      controlar(apresentacao);
      if (apresentacao && document.fullscreenEnabled && !document.fullscreenElement) alternarTelaCheia();
    };
  }

  function galeria(categoria, id, titulo) {
    const cenas = dados[categoria]?.[id];
    if (!cenas?.length) return null;
    const bloco = document.createElement('details');
    bloco.className = 'biblie-quadros';
    const resumo = document.createElement('summary');
    resumo.textContent = `${titulo} · ${cenas.length} ${cenas.length === 1 ? 'quadro' : 'quadros'}`;
    const lista = document.createElement('ol');
    for (const [indice, [arquivo, legenda, referencia]] of cenas.entries()) {
      const item = document.createElement('li');
      const quadro = document.createElement('figure');
      const link = document.createElement('a');
      const imagem = document.createElement('img');
      const descricao = document.createElement('figcaption');
      link.href = new URL(arquivo, base);
      link.setAttribute('aria-label', `Ampliar: ${legenda}`);
      link.addEventListener('click', (evento) => {
        if (evento.ctrlKey || evento.metaKey || evento.altKey || evento.shiftKey ||
            typeof HTMLDialogElement === 'undefined' || !HTMLDialogElement.prototype.showModal) return;
        evento.preventDefault();
        visor ??= criarVisor();
        visor(titulo, cenas, indice);
      });
      imagem.src = link.href;
      imagem.alt = legenda;
      imagem.loading = 'lazy';
      imagem.decoding = 'async';
      imagem.width = 1536;
      imagem.height = 1024;
      descricao.textContent = categoria === 'parabolas' ? legenda : `${legenda} · ${referencia}`;
      link.append(imagem);
      quadro.append(link, descricao);
      item.append(quadro);
      lista.append(item);
    }
    const credito = document.createElement('small');
    credito.textContent = 'Ilustrações geradas por IA';
    bloco.append(resumo, lista, credito);
    return bloco;
  }

  function apresentarParabola(id, titulo) {
    const cenas = dados.parabolas?.[id];
    if (!cenas?.length || typeof HTMLDialogElement === 'undefined' ||
        !HTMLDialogElement.prototype.showModal) return null;
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'biblie-apresentar';
    botao.textContent = 'Apresentar em tela cheia';
    botao.addEventListener('click', () => {
      visor ??= criarVisor();
      visor(titulo, cenas, 0, true);
    });
    return botao;
  }

  window.BiblieIlustracoes = {galeria, apresentarParabola};
})();
