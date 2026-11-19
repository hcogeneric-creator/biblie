(() => {
  const busca = document.querySelector('#busca');
  const tema = document.querySelector('#tema');
  const total = document.querySelector('#total');
  const aviso = document.querySelector('#aviso-copia');
  const narracoes = window.BIBLIE_NARRACOES;
  const normalizar = texto => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  const grupos = Array.from(document.querySelectorAll('.grupo'), secao => ({
    secao,
    fichas: Array.from(secao.querySelectorAll('.ficha'), ficha => ({
      ficha,
      texto: normalizar([
        ...Array.from(ficha.querySelectorAll('h3, .referencias, .historia, .ensinamento'), item => item.textContent),
        ...(narracoes?.[ficha.id]?.quadros.map(quadro => quadro[1]) ?? []),
      ].join(' ')),
    })),
  }));

  function filtrar() {
    const consulta = normalizar(busca.value).split(/\s+/).filter(Boolean);
    let quantidade = 0;
    for (const { secao, fichas } of grupos) {
      const temaCorresponde = !tema.value || secao.dataset.tema === tema.value;
      for (const { ficha, texto } of fichas) {
        ficha.hidden = !(temaCorresponde && consulta.every(termo => texto.includes(termo)));
        if (!ficha.hidden) quantidade++;
      }
      secao.hidden = fichas.every(({ ficha }) => ficha.hidden);
    }
    total.textContent = quantidade === 1 ? '1 ficha' : `${quantidade} fichas`;
    if (!quantidade) total.textContent = 'Nenhuma ficha corresponde à busca.';
  }

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      const selecao = document.createElement('textarea');
      const focoAnterior = document.activeElement;
      selecao.className = 'somente-leitor';
      selecao.value = texto;
      document.body.append(selecao);
      selecao.select();
      try {
        return document.execCommand('copy');
      } catch {
        return false;
      } finally {
        selecao.remove();
        focoAnterior.focus({ preventScroll: true });
      }
    }
  }

  for (const botao of document.querySelectorAll('.copiar')) {
    botao.hidden = false;
    botao.addEventListener('click', async () => {
      const ficha = botao.closest('.ficha');
      const partes = Array.from(ficha.querySelectorAll('h3, .referencias, .historia, .ensinamento'), item => item.textContent.trim());
      const copiado = await copiar(partes.join('\n\n'));
      botao.textContent = copiado ? 'Copiada' : 'Copiar ficha';
      aviso.textContent = copiado ? `Ficha copiada: ${partes[0]}.` : 'A cópia automática falhou. Selecione o texto da ficha para copiá-lo.';
      if (!copiado) {
        const selecao = window.getSelection();
        const intervalo = document.createRange();
        intervalo.setStartBefore(ficha.querySelector('h3'));
        intervalo.setEndAfter(ficha.querySelector('.ensinamento'));
        selecao.removeAllRanges();
        selecao.addRange(intervalo);
      }
    });
  }

  function mostrarFichaDoLink() {
    const ficha = document.getElementById(location.hash.slice(1));
    if (!ficha?.matches('.ficha') || (!ficha.hidden && !ficha.closest('.grupo').hidden)) return;
    busca.value = '';
    tema.value = '';
    filtrar();
    ficha.scrollIntoView();
  }

  for (const ficha of document.querySelectorAll('.ficha')) {
    const galeria = window.BiblieIlustracoes.galeria('parabolas', ficha.id, 'História ilustrada');
    if (!galeria) continue;
    ficha.querySelector('.historia').after(galeria);
    const roteiro = narracoes?.[ficha.id];
    if (roteiro) {
      const transcricao = document.createElement('details');
      transcricao.className = 'biblie-quadros narracao-transcricao';
      const titulo = document.createElement('summary');
      titulo.textContent = 'Ler a transcrição da narração';
      transcricao.append(titulo);
      for (const [, texto] of roteiro.quadros) {
        const paragrafo = document.createElement('p');
        paragrafo.textContent = texto;
        transcricao.append(paragrafo);
      }
      galeria.after(transcricao);
    }
    const apresentar = window.BiblieIlustracoes.apresentarParabola(ficha.id, ficha.querySelector('h3').textContent);
    if (apresentar) ficha.querySelector('.acoes').prepend(apresentar);
  }

  busca.addEventListener('input', filtrar);
  tema.addEventListener('change', filtrar);
  window.addEventListener('hashchange', mostrarFichaDoLink);
  document.querySelector('.filtros').hidden = false;
  total.hidden = false;
  filtrar();
  mostrarFichaDoLink();
})();
