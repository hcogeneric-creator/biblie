(() => {
  if (!/^https?:$/.test(location.protocol)) return;
  const pagina = document.querySelector('meta[name="biblie-versao"]');
  const raiz = new URL('../', document.currentScript.src);
  const versaoURL = new URL('versao.json', raiz);
  let emCurso = false;
  let ultimaConsulta = 0;

  async function conferirVersao() {
    if (emCurso || document.hidden || Date.now() - ultimaConsulta < 30_000) return;
    if (document.querySelector('dialog[open]')) return;
    ultimaConsulta = Date.now();
    emCurso = true;
    try {
      versaoURL.searchParams.set('_', String(ultimaConsulta));
      const resposta = await fetch(versaoURL, {cache: 'no-store'});
      if (!resposta.ok) return;
      const {versao} = await resposta.json();
      if (!/^[a-f0-9]{12}$/.test(versao) || versao === pagina.content) return;
      if (document.querySelector('dialog[open]')) return;
      const destino = new URL(location.href);
      if (destino.searchParams.get('v') === versao) return;
      destino.searchParams.set('v', versao);
      location.replace(destino);
    } catch {
      // A cópia aberta continua disponível se a consulta falhar.
    } finally {
      emCurso = false;
    }
  }

  window.addEventListener('pageshow', (evento) => {
    if (evento.persisted) ultimaConsulta = 0;
    conferirVersao();
  });
  document.addEventListener('visibilitychange', conferirVersao);
  document.addEventListener('click', (evento) => {
    const link = evento.target.closest?.('a[href]');
    if (!link || link.getAttribute('href').startsWith('#')) return;
    const destino = new URL(link.href, location.href);
    if (!destino.href.startsWith(raiz.href) || !destino.pathname.endsWith('/index.html')) return;
    destino.searchParams.set('v', pagina.content);
    link.href = destino.href;
  });
})();
