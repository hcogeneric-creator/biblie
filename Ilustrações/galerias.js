(() => {
  const base = new URL('./imagens/', document.currentScript.src);
  const dados = window.BIBLIE_CENAS;

  function galeria(categoria, id, titulo) {
    const cenas = dados[categoria]?.[id];
    if (!cenas?.length) return null;
    const bloco = document.createElement('details');
    bloco.className = 'biblie-quadros';
    const resumo = document.createElement('summary');
    resumo.textContent = `${titulo} · ${cenas.length} ${cenas.length === 1 ? 'quadro' : 'quadros'}`;
    const lista = document.createElement('ol');
    for (const [arquivo, legenda, referencia] of cenas) {
      const item = document.createElement('li');
      const quadro = document.createElement('figure');
      const link = document.createElement('a');
      const imagem = document.createElement('img');
      const descricao = document.createElement('figcaption');
      link.href = new URL(arquivo, base);
      link.setAttribute('aria-label', `Ampliar: ${legenda}`);
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
