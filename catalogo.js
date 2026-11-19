(() => {
  const [livros] = window.BIBLIE;
  const busca = document.querySelector("#buscaLivros");
  const nenhum = document.querySelector("#semLivros");
  const normalizar = valor => valor.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
  const entradas = Object.entries(livros).map(([codigo, [nome]], i) => {
    const lista = document.querySelector(i < 39 ? "#antigo" : "#novo");
    const li = document.createElement("li");
    const texto = document.createElement("a");
    const resumo = document.createElement("a");
    texto.href = `Bíblia Cronológica/index.html#${codigo}.1`;
    texto.textContent = nome;
    resumo.href = `Bíblia Cronológica/index.html#${codigo}.1.resumo`;
    resumo.textContent = "Resumo";
    resumo.setAttribute("aria-label", `Resumo de ${nome}`);
    li.append(texto, resumo);
    lista.append(li);
    return [normalizar(nome), li];
  });
  busca.addEventListener("input", () => {
    const termo = normalizar(busca.value);
    for (const [nome, li] of entradas) li.hidden = !nome.includes(termo);
    nenhum.hidden = entradas.some(([, li]) => !li.hidden);
  });
})();
