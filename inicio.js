(() => {
  const imagens = [...document.querySelectorAll(".quadro-inicio")];
  const controles = document.querySelector(".vitrine-controles");
  const botoes = [...controles.querySelectorAll("button")];
  const legenda = document.querySelector("#cena-link");
  const cenas = [
    ["A travessia do mar · Êxodo 14", "Bíblia Cronológica/index.html#EXO.14"],
    ["O bom samaritano · Lucas 10", "PARABOLAS/index.html#o-bom-samaritano"],
    ["Um porto fenício · Atlas bíblico", "Mapa/index.html?lugar=phoenicia"],
  ];
  let selecao = 0;

  async function mostrarCena(indice) {
    const imagem = imagens[indice];
    selecao = indice;
    if (imagem.dataset.fonte) {
      imagem.src = imagem.dataset.fonte;
      delete imagem.dataset.fonte;
    }
    try {
      await imagem.decode();
    } catch {
      return;
    }
    if (indice !== selecao) return;
    for (const [i, quadro] of imagens.entries()) {
      quadro.classList.toggle("ativo", i === indice);
      botoes[i].setAttribute("aria-pressed", String(i === indice));
    }
    const [titulo, href] = cenas[indice];
    legenda.textContent = titulo;
    legenda.href = href;
  }

  for (const [indice, botao] of botoes.entries()) {
    botao.addEventListener("click", () => mostrarCena(indice));
  }
  controles.hidden = false;
})();
