(() => {
  "use strict";

  const largura = 1080;
  const altura = 1350;
  const margem = 108;
  const larguraTexto = largura - margem * 2;
  const fonteTexto = '400 56px Georgia, "Times New Roman", serif';
  const alturaLinha = 69;
  const espacoVersiculo = 16;
  const alturaTexto = 760;
  const fonteTraducao = "Bíblia Livre · © Diego Santos, Mario Sérgio e Marco Teles, 2018";
  const licenca = "CC BY 4.0 · creativecommons.org/licenses/by/4.0";

  function referencia(livro, capitulo, primeiro, ultimo) {
    return livro + " " + capitulo + ":" + primeiro + (primeiro === ultimo ? "" : "–" + ultimo);
  }

  function quebrar(contexto, texto) {
    const linhas = [];
    let linha = "";
    for (const palavra of texto.split(/\s+/)) {
      if (linha && contexto.measureText(linha + " " + palavra).width > larguraTexto) {
        linhas.push(linha);
        linha = "";
      }
      if (contexto.measureText(palavra).width > larguraTexto) {
        for (const caractere of palavra) {
          if (contexto.measureText(linha + caractere).width > larguraTexto) {
            linhas.push(linha);
            linha = "";
          }
          linha += caractere;
        }
      } else {
        linha += (linha ? " " : "") + palavra;
      }
    }
    if (linha) linhas.push(linha);
    return linhas;
  }

  function dividir(contexto, versos) {
    const paginas = [];
    let blocos = [];
    let usado = 0;
    function fecharPagina() {
      paginas.push({ blocos, usado });
      blocos = [];
      usado = 0;
    }
    contexto.font = fonteTexto;
    for (const { numero, texto } of versos) {
      const linhas = quebrar(contexto, texto);
      if (blocos.length && usado + espacoVersiculo + linhas.length * alturaLinha > alturaTexto) fecharPagina();
      while (linhas.length) {
        const intervalo = blocos.length ? espacoVersiculo : 0;
        const cabem = Math.floor((alturaTexto - usado - intervalo) / alturaLinha);
        const parte = linhas.splice(0, cabem);
        blocos.push({ numero, linhas: parte, intervalo });
        usado += intervalo + parte.length * alturaLinha;
        if (linhas.length) fecharPagina();
      }
    }
    if (blocos.length) fecharPagina();
    return paginas;
  }

  function riscar(contexto, y) {
    contexto.beginPath();
    contexto.moveTo(margem, y);
    contexto.lineTo(largura - margem, y);
    contexto.stroke();
  }

  function desenhar(contexto, pagina, ref, indice, total) {
    const papel = contexto.createLinearGradient(0, 0, largura, altura);
    papel.addColorStop(0, "#fdf8eb");
    papel.addColorStop(1, "#f0e6cd");
    contexto.fillStyle = papel;
    contexto.fillRect(0, 0, largura, altura);
    contexto.lineWidth = 2;
    contexto.strokeStyle = "#b5a67e";
    contexto.strokeRect(43, 43, largura - 86, altura - 86);
    riscar(contexto, 155);
    riscar(contexto, 1144);

    contexto.fillStyle = "#344b3a";
    contexto.font = '600 52px Fraunces, Georgia, serif';
    contexto.fillText("Biblie", margem, 130);
    if (total > 1) {
      contexto.textAlign = "right";
      contexto.font = '600 25px "DM Sans", sans-serif';
      contexto.fillText(String(indice + 1) + " / " + total, largura - margem, 125);
      contexto.textAlign = "left";
    }
    let y = 315 + (alturaTexto - pagina.usado) * .38;
    contexto.fillStyle = "#9c8251";
    contexto.font = '500 116px Fraunces, Georgia, serif';
    contexto.fillText("“", margem - 7, y - 76);

    contexto.fillStyle = "#21372b";
    contexto.font = fonteTexto;
    for (const bloco of pagina.blocos) {
      y += bloco.intervalo;
      for (const linha of bloco.linhas) {
        contexto.fillText(linha, margem, y);
        y += alturaLinha;
      }
    }
    contexto.font = '700 45px "DM Sans", sans-serif';
    contexto.fillText(ref, margem, Math.min(1091, y + 25), larguraTexto);
    contexto.fillStyle = "#4f5a49";
    contexto.font = '500 24px "DM Sans", sans-serif';
    contexto.fillText(fonteTraducao, margem, 1192, larguraTexto);
    contexto.fillText(licenca, margem, 1230, larguraTexto);
  }

  function exportar(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error("Não foi possível gerar a imagem."));
      }, "image/png");
    });
  }

  async function criar({ livro, capitulo, versos }, signal) {
    await Promise.allSettled([
      document.fonts.load("600 52px Fraunces"),
      document.fonts.load('700 45px "DM Sans"'),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const contexto = canvas.getContext("2d", { alpha: false });
    const paginas = dividir(contexto, versos);
    const imagens = [];
    for (const [indice, pagina] of paginas.entries()) {
      signal.throwIfAborted();
      const ref = referencia(livro, capitulo, pagina.blocos[0].numero, pagina.blocos.at(-1).numero);
      desenhar(contexto, pagina, ref, indice, paginas.length);
      const blob = await exportar(canvas);
      const nome = ref.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const final = paginas.length > 1 ? "-cartao-" + (indice + 1) : "";
      imagens.push({ blob, ref, nome: nome + final + ".png" });
    }
    return imagens;
  }

  window.BiblieCartaoPassagem = { criar, referencia, fonteTraducao, licenca };
})();
