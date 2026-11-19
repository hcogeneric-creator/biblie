(() => {
  const busca = document.querySelector('#buscar-mulheres');
  const resultado = document.querySelector('.resultado-mulheres');
  const testamentos = document.querySelectorAll('.testamento-mulheres');
  const normalizar = (texto) => texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const fichas = Array.from(document.querySelectorAll('.ficha-mulher'), (ficha) => [
    ficha, normalizar(ficha.textContent), document.querySelector(`.nomes-mulheres a[href="#${ficha.id}"]`).parentElement,
  ]);

  function filtrar() {
    const consulta = normalizar(busca.value).trim();
    const palavras = consulta ? consulta.split(/\s+/) : [];
    let total = 0;
    for (const [ficha, texto, indice] of fichas) {
      const mostrar = palavras.every((palavra) => texto.includes(palavra));
      ficha.hidden = indice.hidden = !mostrar;
      total += Number(mostrar);
    }
    for (const testamento of testamentos) {
      testamento.hidden = !testamento.querySelector('.ficha-mulher:not([hidden])');
    }
    resultado.hidden = !consulta;
    resultado.textContent = total === 0 ? 'Nenhuma ficha encontrada.' : `${total} ${total === 1 ? 'ficha encontrada' : 'fichas encontradas'}.`;
  }

  busca.closest('.busca-mulheres').hidden = false;
  busca.addEventListener('input', filtrar);
  window.addEventListener('hashchange', () => {
    const destino = document.getElementById(location.hash.slice(1));
    if (!destino?.hidden) return;
    busca.value = '';
    filtrar();
    destino.scrollIntoView();
  });
})();
