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
        <button type="button" data-fechar>Fechar</button>
      </header>
      <div class="biblie-visor-palco"></div>
      <div class="biblie-visor-base">
        <p data-legenda aria-live="polite"></p>
        <nav aria-label="Navegar pelos quadros">
          <button type="button" data-anterior>Anterior</button>
          <button type="button" data-proximo>Próximo</button>
        </nav>
      </div>`;
    document.body.append(dialogo);
    const palco = dialogo.querySelector('.biblie-visor-palco');
    const anterior = dialogo.querySelector('[data-anterior]');
    const proximo = dialogo.querySelector('[data-proximo]');
    const fechar = dialogo.querySelector('[data-fechar]');
    const legenda = dialogo.querySelector('[data-legenda]');
    let cenas;
    let posicao;

    function atualizar() {
      const [arquivo, nome, referencia] = cenas[posicao];
      const imagem = new Image(1536, 1024);
      imagem.src = new URL(arquivo, base);
      imagem.alt = nome;
      palco.replaceChildren(imagem);
      legenda.textContent = `${posicao + 1} de ${cenas.length} · ${nome} · ${referencia}`;
      const foco = document.activeElement;
      anterior.disabled = posicao === 0;
      proximo.disabled = posicao === cenas.length - 1;
      if (foco === anterior && anterior.disabled) (proximo.disabled ? fechar : proximo).focus();
      if (foco === proximo && proximo.disabled) (anterior.disabled ? fechar : anterior).focus();
    }

    function percorrer(passo) {
      const destino = posicao + passo;
      if (destino < 0 || destino >= cenas.length) return;
      posicao = destino;
      atualizar();
    }

    anterior.addEventListener('click', () => percorrer(-1));
    proximo.addEventListener('click', () => percorrer(1));
    fechar.addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('keydown', (evento) => {
      if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return;
      evento.preventDefault();
      percorrer(evento.key === 'ArrowLeft' ? -1 : 1);
    });

    return (titulo, sequencia, indice) => {
      dialogo.querySelector('h2').textContent = titulo;
      cenas = sequencia;
      posicao = indice;
      atualizar();
      dialogo.showModal();
      fechar.focus();
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

  window.BiblieIlustracoes = {galeria};
})();
