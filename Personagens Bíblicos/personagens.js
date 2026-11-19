"use strict";

(() => {
  const {people, contexts, books, links} = window.BIBLIE_PERSONAGENS;
  const byId = (id) => document.getElementById(id);
  const normalize = (value) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
  const fmt = new Intl.NumberFormat("pt-BR");
  const sortNames = new Intl.Collator("pt-BR", {sensitivity: "base", numeric: true});
  const reader = "../B%C3%ADblia%20Cronol%C3%B3gica/index.html";
  const initial = "jesus_905";
  const pageSize = 50;
  const ids = Object.keys(people).sort((a, b) => sortNames.compare(people[a].name, people[b].name));
  const sameNames = new Map();
  const narrative = Object.fromEntries(ids.map((id) => [id, []]));
  const search = new Map();
  const labels = new Map();
  const reverseLabels = new Map();
  let current = initial;
  let limit = pageSize;

  for (const id of ids) {
    const person = people[id];
    const name = normalize(person.name);
    search.set(id, [name, ...person.aliases.map(normalize)]);
    sameNames.set(name, (sameNames.get(name) || 0) + 1);
  }

  for (const [from, to, relation, citation] of links) {
    narrative[from].push({to, relation, citation});
    narrative[to].push({to: from, relation, citation});
  }

  function el(tag, content, attrs = {}) {
    const node = document.createElement(tag);
    if (content) node.textContent = content;
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  function refText([book, chapter, verse]) {
    return `${books[book]} ${chapter}:${verse}`;
  }

  function profileUrl(id) {
    return `#p/${encodeURIComponent(id)}`;
  }

  function personLink(id) {
    return el("a", people[id].name, {href: profileUrl(id), class: "pessoa"});
  }

  function description(person) {
    if (person.profile) return person.profile;
    const refs = person.refs;
    const bookNames = [...new Set(refs.map(([book]) => books[book]))].slice(0, 3);
    const bookList = new Intl.ListFormat("pt-BR").format(bookNames);
    const kinship = [
      ["pai", "Filiação vinculada a"], ["mãe", "Filiação vinculada a"],
      ["genitor", "Filiação vinculada a"], ["cônjuge", "Vínculo conjugal indicado com"],
      ["filhos", "Descendência vinculada a"], ["irmãos", "Vínculo fraterno indicado com"],
    ];
    const statements = kinship.flatMap(([label, intro]) => {
      const relatives = person.family[label];
      if (!relatives?.length) return [];
      const displayed = relatives.slice(0, 3).map((id) => people[id].name);
      return [`${intro} ${new Intl.ListFormat("pt-BR").format(displayed)}` + (relatives.length > 3 ? ", entre outros." : ".")];
    });
    const chosen = refs.length === 1
      ? `Figura indexada em ${refText(refs[0])}.`
      : `Figura indexada em ${fmt.format(refs.length)} passagens. Primeiros livros indexados: ${bookList}.`;
    return [chosen, ...statements.slice(0, 2)].join(" ");
  }

  function syncSearch() {
    const query = normalize(byId("busca").value);
    const tokens = query.split(/\s+/).filter(Boolean);
    const period = byId("epoca").value;
    const matches = ids.filter((id) => {
      if (period && people[id].context !== period) return false;
      return tokens.every((token) => search.get(id).some((name) => name.includes(token)));
    });
    if (query) {
      const score = (id) => {
        const [title, ...aliases] = search.get(id);
        if (title === query) return 0;
        if (title.startsWith(query)) return 1;
        if (aliases.includes(query)) return 2;
        return 3;
      };
      matches.sort((a, b) => score(a) - score(b));
    }
    const shown = matches.slice(0, limit);
    byId("quantidade").textContent = matches.length
      ? `${fmt.format(shown.length)} de ${fmt.format(matches.length)} fichas`
      : "Nenhum personagem encontrado.";
    byId("resultados").replaceChildren(...shown.map((id) => {
      const item = el("li");
      const link = personLink(id);
      link.append(el("small", refText(people[id].refs[0])));
      if (id === current) {
        link.classList.add("selecionado");
        link.setAttribute("aria-current", "page");
      }
      item.append(link);
      return item;
    }));
    byId("mais").hidden = shown.length === matches.length;
  }

  function familyList(id, direction) {
    const groups = direction === "up" ? ["pai", "mãe", "genitor"] : ["filhos"];
    return groups.flatMap((role) => (people[id].family[role] || []).map((relative) => ({id: relative, role})));
  }

  function branches(id, direction, depth, seen = new Set([id])) {
    const relatives = familyList(id, direction).filter((relative) => !seen.has(relative.id));
    const list = el("ul");
    for (const relative of relatives) {
      const item = el("li");
      const label = relative.role === "filhos" ? "Filiação / descendência" : relative.role;
      item.append(el("small", label, {class: "rotulo"}), personLink(relative.id));
      const nextSeen = new Set([...seen, relative.id]);
      const canExpand = depth > 1 && familyList(relative.id, direction).some((entry) => !nextSeen.has(entry.id));
      if (canExpand) {
        const details = el("details");
        details.append(el("summary", "Abrir ramo"), branches(relative.id, direction, depth - 1, nextSeen));
        item.append(details);
      }
      list.append(item);
    }
    return list.childElementCount ? list : el("p", "Nenhum vínculo registrado.", {class: "nota"});
  }

  function familyGroups(id) {
    const family = people[id].family;
    const labels = ["cônjuge", "irmãos", "meio-irmãos pelo pai", "meio-irmãos pela mãe"];
    const list = el("ul");
    for (const label of labels) {
      for (const relative of family[label] || []) {
        const item = el("li");
        item.append(personLink(relative), document.createTextNode(` · ${label}`));
        list.append(item);
      }
    }
    return list.childElementCount ? list : el("p", "Sem outros vínculos de família no índice.", {class: "nota"});
  }

  function presentConnections(id) {
    const list = el("ul");
    for (const link of narrative[id]) {
      const item = el("li");
      item.append(personLink(link.to), document.createTextNode(` · ${link.relation} (${link.citation})`));
      list.append(item);
    }
    return list.childElementCount ? list : el("p", "Sem conexões narrativas editadas nesta ficha.", {class: "nota"});
  }

  function pathBetween(start, target) {
    const visited = new Map([[start, null]]);
    const queue = [start];
    for (let index = 0; index < queue.length; index += 1) {
      const from = queue[index];
      if (from === target) break;
      const family = Object.entries(people[from].family)
        .flatMap(([role, relatives]) => relatives.map((to) => ({to, relation: role, citation: "índice genealógico"})));
      for (const edge of [...family, ...narrative[from]]) {
        if (visited.has(edge.to)) continue;
        visited.set(edge.to, {from, ...edge});
        queue.push(edge.to);
      }
    }
    if (!visited.has(target)) return null;
    const result = [];
    for (let step = visited.get(target); step; step = visited.get(step.from)) result.push(step);
    return result.reverse();
  }

  function makePrompt(person) {
    const [, context, title, source] = contexts[person.context];
    const visualReference = source.startsWith("https:") ? `Referência visual de contexto: ${title}. ${source}` : "";
    const specificReference = person.source ? `Fonte complementar: ${person.source[0]}. ${person.source[1]}` : "";
    return [
      `ChatGPT, gere um avatar quadrado (1:1) de ${person.name} para um catálogo brasileiro de personagens bíblicos.`,
      `Use como referência textual ${person.citation || refText(person.refs[0])}. ${description(person)}`,
      context, person.art, visualReference, specificReference,
      "Faça um retrato editorial do busto em três quartos, com luz natural difusa e fundo discreto. Priorize materiais compatíveis com a cena. Trate feições, tom de pele, idade e penteado sem atestação individual como escolhas artísticas. Evite estereótipos modernos, texto sobre a imagem e objetos anacrônicos.",
    ].filter(Boolean).join("\n\n");
  }

  function showProfile(id, moveFocus = false) {
    current = id;
    const person = people[id];
    const [period, , sourceTitle, source] = contexts[person.context];
    byId("contexto").textContent = period + (person.profile ? "" : " · contexto aproximado");
    byId("nome").textContent = person.name;
    byId("outros").textContent = person.aliases.length ? `Variantes e títulos de origem: ${person.aliases.slice(0, 12).join(", ")}` : "";
    byId("descricao").textContent = description(person);
    byId("citacao").textContent = person.citation || refText(person.refs[0]);
    byId("ascendentes").replaceChildren(branches(id, "up", 3));
    byId("descendentes").replaceChildren(branches(id, "down", 3));
    byId("familia").replaceChildren(familyGroups(id));
    byId("relacoes").replaceChildren(presentConnections(id));
    byId("prompt").value = makePrompt(person);
    byId("base-visual").replaceChildren(
      document.createTextNode("Referência visual de contexto: "),
      el("a", sourceTitle, {href: source}),
    );
    if (person.source) {
      byId("base-visual").append(document.createTextNode(" · "), el("a", person.source[0], {href: person.source[1]}));
    }
    byId("versos").replaceChildren(...person.refs.map((ref) => {
      const item = el("li");
      item.append(el("a", refText(ref), {href: `${reader}#${ref.join(".")}`}));
      return item;
    }));
    byId("passagens").open = false;
    byId("caminho").replaceChildren();
    byId("alvo").value = "";
    byId("copiado").textContent = "";
    document.title = `${person.name} · Personagens bíblicos · Biblie`;
    syncSearch();
    if (moveFocus) byId("nome").focus();
  }

  for (const [key, [title]] of Object.entries(contexts)) {
    byId("epoca").append(el("option", title, {value: key}));
  }
  const names = document.createDocumentFragment();
  for (const id of ids) {
    const person = people[id];
    const distinguish = sameNames.get(normalize(person.name)) > 1;
    let label = distinguish ? `${person.name} — ${refText(person.refs[0])}` : person.name;
    if (reverseLabels.has(normalize(label))) label += ` [${id}]`;
    labels.set(id, label);
    reverseLabels.set(normalize(label), id);
    names.append(el("option", "", {value: label}));
  }
  byId("nomes").append(names);

  function followLocation(focus) {
    if (location.hash.startsWith("#p/")) {
      let slug;
      try {
        slug = decodeURIComponent(location.hash.slice(3));
      } catch {
        slug = initial;
      }
      showProfile(Object.hasOwn(people, slug) ? slug : initial, focus);
    } else if (!location.hash) {
      showProfile(initial, focus);
    }
  }

  for (const event of ["input", "change"]) {
    byId(event === "input" ? "busca" : "epoca").addEventListener(event, () => {
      limit = pageSize;
      syncSearch();
    });
  }
  byId("mais").addEventListener("click", () => {
    limit += pageSize;
    syncSearch();
  });
  byId("atalhos").addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    event.preventDefault();
    const section = byId(link.getAttribute("href").slice(1));
    if (section.tagName === "DETAILS") section.open = true;
    section.scrollIntoView();
  });
  byId("trajeto").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = normalize(byId("alvo").value);
    const exact = reverseLabels.get(query);
    const candidates = exact ? [exact] : ids.filter((id) => search.get(id).some((name) => name === query));
    if (candidates.length !== 1) {
      byId("caminho").replaceChildren(el("p", "Selecione um nome completo nas sugestões."));
      return;
    }
    const target = candidates[0];
    byId("alvo").value = labels.get(target);
    const route = pathBetween(current, target);
    if (!route?.length) {
      byId("caminho").replaceChildren(el("p", route ? "Esta já é a ficha aberta." : "Nenhum caminho registrado entre as duas fichas."));
      return;
    }
    const list = el("ol");
    for (const step of route) {
      const item = el("li");
      item.append(
        personLink(step.from),
        document.createTextNode(` · ${step.relation} · `),
        personLink(step.to),
        el("small", step.citation, {class: "rotulo"}),
      );
      list.append(item);
    }
    byId("caminho").replaceChildren(list);
  });
  byId("copiar").addEventListener("click", async () => {
    const field = byId("prompt");
    try {
      await navigator.clipboard.writeText(field.value);
      byId("copiado").textContent = "Prompt copiado.";
    } catch {
      field.select();
      const copied = document.execCommand("copy");
      byId("copiado").textContent = copied ? "Prompt copiado." : "Texto selecionado. Use Ctrl+C para copiar.";
    }
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a.pessoa");
    if (link && link.hash === location.hash && people[current]) byId("nome").focus();
  });
  window.addEventListener("hashchange", () => followLocation(true));
  showProfile(initial);
  followLocation(false);
})();
