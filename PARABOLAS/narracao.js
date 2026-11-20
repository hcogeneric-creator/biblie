(() => {
  const base = new URL('./', document.currentScript.src);
  const velocidade = 1.1;

  function indiceEm(instantes, tempo) {
    let indice = instantes.length - 1;
    while (indice > 0 && instantes[indice] > tempo) indice--;
    return indice;
  }

  function comporLegendas(quadros) {
    const grupos = [];
    for (const [, texto, marcas] of quadros) {
      let grupo;
      let inicioLinha = 0;
      for (const [indice, [tempo, inicio, tamanho]] of marcas.entries()) {
        const fim = marcas[indice + 1]?.[1] ?? texto.length;
        if (!indice || (fim - inicioLinha > 63 && grupo.palavras.length > 1)) {
          grupo = {linha: document.createElement('p'), palavras: [], tempos: []};
          grupo.linha.hidden = true;
          grupos.push(grupo);
          inicioLinha = inicio;
        }
        const palavra = document.createElement('span');
        palavra.textContent = texto.slice(inicio, inicio + tamanho);
        grupo.palavras.push(palavra);
        grupo.tempos.push(tempo);
        if (!indice && inicio) grupo.linha.append(texto.slice(0, inicio));
        grupo.linha.append(palavra, texto.slice(inicio + tamanho, fim));
      }
    }
    return grupos;
  }

  function criar(dialogo, eventos) {
    const legenda = dialogo.querySelector('[data-karaoke]');
    const status = dialogo.querySelector('[data-status-audio]');
    const audio = document.createElement('audio');
    audio.hidden = true;
    audio.preload = 'none';
    audio.defaultPlaybackRate = velocidade;
    dialogo.append(audio);
    let quadros;
    let inicioQuadros;
    let grupos;
    let inicioGrupos;
    let indiceAnterior;
    let grupoAnterior;
    let palavraAnterior;
    let animacao;
    let destinoPendente;
    let sessao = 0;

    function sincronizar(tempo = audio.currentTime * 1000) {
      if (!quadros) return;
      const indice = indiceEm(inicioQuadros, tempo);
      if (indice !== indiceAnterior) {
        indiceAnterior = indice;
        eventos.quadro(indice);
      }
      const grupo = grupos[indiceEm(inicioGrupos, tempo)];
      const palavra = tempo < grupo.tempos[0] ? -1 : indiceEm(grupo.tempos, tempo);
      if (grupo === grupoAnterior && palavra === palavraAnterior) return;
      if (grupo !== grupoAnterior) {
        if (grupoAnterior) grupoAnterior.linha.hidden = true;
        grupo.linha.hidden = false;
      }
      grupo.palavras.forEach((elemento, i) => {
        elemento.classList.toggle('falada', i <= palavra);
        elemento.classList.toggle('atual', i === palavra);
      });
      grupoAnterior = grupo;
      palavraAnterior = palavra;
    }

    function animar() {
      sincronizar();
      if (!audio.paused && !audio.ended) animacao = requestAnimationFrame(animar);
    }

    function desativar() {
      ++sessao;
      quadros = null;
      destinoPendente = null;
      cancelAnimationFrame(animacao);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      legenda.hidden = true;
      legenda.replaceChildren();
      status.hidden = true;
      dialogo.classList.remove('biblie-apresentacao-com-audio');
    }

    function falha(mensagem) {
      status.textContent = mensagem;
      status.hidden = false;
    }

    audio.addEventListener('playing', () => {
      if (!quadros) return;
      status.hidden = true;
      cancelAnimationFrame(animacao);
      animar();
    });
    audio.addEventListener('waiting', () => {
      if (quadros && !audio.paused) falha('Carregando narração…');
    });
    audio.addEventListener('timeupdate', () => {
      if (destinoPendente == null) sincronizar();
    });
    audio.addEventListener('loadedmetadata', () => {
      if (destinoPendente != null) audio.currentTime = destinoPendente;
      destinoPendente = null;
    });
    audio.addEventListener('ended', () => {
      if (quadros) eventos.terminou();
    });
    audio.addEventListener('error', () => {
      if (!quadros) return;
      desativar();
      falha('O áudio está indisponível. Os quadros e a transcrição continuam acessíveis.');
      eventos.indisponivel();
    });

    return {
      abrir(roteiro) {
        if (!roteiro) return false;
        quadros = roteiro.quadros;
        inicioQuadros = quadros.map(quadro => quadro[0]);
        grupos = comporLegendas(quadros);
        inicioGrupos = grupos.map(grupo => grupo.tempos[0]);
        grupoAnterior = palavraAnterior = null;
        indiceAnterior = 0;
        legenda.replaceChildren(...grupos.map(grupo => grupo.linha));
        legenda.hidden = false;
        dialogo.classList.add('biblie-apresentacao-com-audio');
        audio.src = new URL(roteiro.audio, base);
        audio.playbackRate = velocidade;
        sincronizar(0);
        return true;
      },
      tocar(tocando) {
        if (!tocando) {
          audio.pause();
          status.hidden = true;
          return;
        }
        const atual = sessao;
        audio.play().catch((erro) => {
          if (!quadros || sessao !== atual || erro.name === 'AbortError') return;
          eventos.terminou();
          falha('Toque em Play para ouvir a narração.');
        });
      },
      ir(indice) {
        const tempo = inicioQuadros[indice];
        if (audio.readyState) audio.currentTime = tempo / 1000;
        else destinoPendente = tempo / 1000;
        sincronizar(tempo);
      },
      terminou: () => audio.ended,
      desativar,
    };
  }

  window.BiblieNarracao = {criar};
})();
