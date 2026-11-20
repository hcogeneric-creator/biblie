(() => {
  const mobile = matchMedia("(max-width: 740px), (pointer: coarse)");
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "biblie-voltar-topo";
  botao.setAttribute("aria-label", "Voltar ao topo");
  botao.textContent = "↑";
  document.body.append(botao);

  function atualizar() {
    botao.hidden = !mobile.matches || window.scrollY < window.innerHeight;
  }

  botao.addEventListener("click", () => {
    document.querySelector("body > header a[href]")?.focus({ preventScroll: true });
    const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduzir ? "instant" : "smooth" });
  });
  window.addEventListener("scroll", atualizar, { passive: true });
  window.addEventListener("resize", atualizar);
  window.addEventListener("pageshow", atualizar);
  atualizar();
})();
