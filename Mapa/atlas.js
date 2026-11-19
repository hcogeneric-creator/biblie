'use strict';

const byId = id => document.getElementById(id);
const normalize = value => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '');
const number = new Intl.NumberFormat('pt-BR');
const compareNames = new Intl.Collator('pt-BR', { numeric: true }).compare;
const statuses = {
  strong: 'Localização bem identificada',
  approximate: 'Localização aproximada',
  disputed: 'Localização disputada',
  unknown: 'Sem localização mapeada',
};
const filters = {
  episode: byId('episode'), book: byId('book'), kind: byId('kind'), chapter: byId('chapter'),
  search: byId('search'), all: byId('all-places'),
};
const focusLabels = new Set([
  'jerusalem', 'alexandria', 'rome', 'babylon-1', 'nineveh', 'damascus', 'susa',
  'canaan', 'moab-1', 'edom', 'philistia', 'persia', 'assyria', 'egypt', 'cush-1',
  'nile', 'euphrates', 'joppa', 'tyre', 'antioch-1', 'ephesus', 'athens', 'malta',
  'haran', 'ur-1', 'midian', 'perga', 'galilee-1', 'tarsus', 'capernaum',
]);
const episodePlaces = new Set(STORIES.flatMap(story => story.places));
const featured = new Set(PLACES.filter(place => place.name !== place.original || episodePlaces.has(place.slug)));
const sortedPlaces = [...PLACES].sort((a, b) => compareNames(a.name, b.name));
const searchIndex = new Map(PLACES.map(place => [place, normalize([
  place.name, place.original, place.slug, ...place.options.map(option => option.label),
].join(' '))]));
const initialView = [[25.5, 18], [41, 50]];
const placeLayer = L.layerGroup();
const selectedLayer = L.layerGroup();
const modernLabels = L.layerGroup();
const ancientLabels = L.layerGroup();
const map = L.map('map', {
  center: [33.5, 34], zoom: 5, minZoom: 3, maxZoom: 13,
  maxBounds: [[-2, -31], [61, 93]], maxBoundsViscosity: .55,
  zoomSnap: .5, zoomDelta: .5, attributionControl: false,
});
const modernPane = map.createPane('modern');
const modernLabelPane = map.createPane('modernLabels');
modernPane.style.zIndex = '450';
modernLabelPane.style.zIndex = '460';
modernPane.style.pointerEvents = modernLabelPane.style.pointerEvents = 'none';
L.control.scale({ imperial: false }).addTo(map);
L.geoJSON(LAND, { interactive: false, style: { fillColor: '#edf0d6', fillOpacity: 1, weight: 0 } }).addTo(map);
L.geoJSON(LAKES, { interactive: false, style: { fillColor: '#c4d9dd', fillOpacity: 1, weight: 0 } }).addTo(map);
L.geoJSON(RIVERS, { interactive: false, style: { color: '#92b8bf', weight: 1.1, opacity: .7 } }).addTo(map);
L.geoJSON(COUNTRIES, {
  pane: 'modern', interactive: false,
  style: { color: '#64827f', weight: 1.1, fillColor: '#c8d2b0', fillOpacity: .18, opacity: .76, dashArray: '4 3' },
}).addTo(map);
modernLabels.addTo(map);
ancientLabels.addTo(map);
placeLayer.addTo(map);
selectedLayer.addTo(map);

let visible = [];
let activePlace = null;
let activeOption = 0;
let resultsLimit = 35;

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function link(label, url, external = false) {
  const a = element('a', '', label);
  a.href = url;
  if (external) {
    a.target = '_blank';
    a.rel = 'noopener';
  }
  return a;
}

function bibleLink(code, position) {
  const [, chapter, verse] = /^(\d+)(?::(\d+))?/.exec(position);
  const fragment = [code, chapter, verse].filter(Boolean).join('.');
  return link(`${BOOKS[code] ?? code} ${position}`, `../B%C3%ADblia%20Cronol%C3%B3gica/index.html#${fragment}`);
}

function externalMap(point) {
  return `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lon}#map=13/${point.lat}/${point.lon}`;
}

function iconAt(label, className, origin) {
  return L.divIcon({ className, html: element('span', '', label), iconAnchor: origin });
}

function locationOf(option) {
  return [option.lat, option.lon];
}

function labelAt(layer, coords, markerPane, label, className, origin) {
  L.marker(coords, {
    pane: markerPane, icon: iconAt(label, className, origin), interactive: false, keyboard: false,
  }).addTo(layer);
}

function renderModernLabels() {
  modernLabels.clearLayers();
  if (!byId('modern').checked || Number(byId('opacity').value) === 0) return;
  const zoom = map.getZoom();
  const bounds = map.getBounds().pad(.08);
  if (zoom < 8) {
    for (const { properties } of COUNTRIES.features) {
      const { name, lat, lon } = properties;
      if (name && Number.isFinite(lat) && Number.isFinite(lon) && bounds.contains([lat, lon])) {
        labelAt(modernLabels, [lat, lon], 'modernLabels', name.toLocaleUpperCase('pt-BR'), 'map-label', [15, 0]);
      }
    }
  }
  if (zoom < 5.5) return;
  const cells = new Set();
  const cities = [...CITIES.features].sort((a, b) => a.properties.rank - b.properties.rank);
  for (const { properties, geometry } of cities) {
    const [lon, lat] = geometry.coordinates;
    if (!bounds.contains([lat, lon]) || (zoom < 7 && properties.rank > 4)) continue;
    const { x, y } = map.latLngToContainerPoint([lat, lon]);
    const cell = `${Math.floor(x / 100)}:${Math.floor(y / 26)}`;
    if (cells.has(cell)) continue;
    cells.add(cell);
    labelAt(modernLabels, [lat, lon], 'modernLabels', `· ${properties.name}`, 'map-label', [-2, 0]);
  }
}

function updateOpacity() {
  const enabled = byId('modern').checked;
  const level = Number(byId('opacity').value);
  byId('opacity').disabled = !enabled;
  byId('opacity-value').value = `${level}%`;
  modernPane.style.opacity = enabled ? `${level / 100}` : '0';
  modernLabelPane.style.opacity = modernPane.style.opacity;
  renderModernLabels();
}

function activeStory() {
  return STORIES.find(story => story.id === filters.episode.value);
}

function chapterOf(position) {
  return position.match(/^\d+/)?.[0];
}

function fillChapters(requested = '') {
  const book = filters.book.value;
  const chapters = new Set(PLACES.flatMap(place => (place.refs[book] ?? []).map(chapterOf)).filter(Boolean));
  if (book && /^[1-9]\d*$/.test(requested)) chapters.add(requested);
  const order = [...chapters].sort((a, b) => Number(a) - Number(b));
  filters.chapter.replaceChildren(new Option('Todos os capítulos', ''), ...order.map(chapter => new Option(`Capítulo ${chapter}`, chapter)));
  filters.chapter.value = chapters.has(requested) ? requested : '';
  byId('chapter-field').hidden = !book;
}

function getResults() {
  const story = activeStory();
  const query = normalize(filters.search.value.trim());
  const book = filters.book.value;
  const chapter = filters.chapter.value;
  const kind = filters.kind.value;
  const full = filters.all.checked || Boolean(query || book || kind || story);
  const matched = sortedPlaces.filter(place =>
    (full || featured.has(place)) &&
    (!story || story.places.includes(place.slug)) &&
    (!book || Object.prototype.hasOwnProperty.call(place.refs, book)) &&
    (!chapter || place.refs[book]?.some(ref => chapterOf(ref) === chapter)) &&
    (!kind || place.kind === kind) &&
    (!query || searchIndex.get(place).includes(query))
  );
  if (story) return matched.sort((a, b) => story.places.indexOf(a.slug) - story.places.indexOf(b.slug));
  if (!query) return matched;
  const rank = place => {
    const names = [place.name, place.original, place.slug].map(normalize);
    if (names.includes(query)) return 0;
    if (names.some(name => name.startsWith(query))) return 1;
    if (names.some(name => name.includes(query))) return 2;
    return 3;
  };
  return matched.sort((a, b) => rank(a) - rank(b));
}

function renderStory() {
  const story = activeStory();
  byId('story').hidden = !story;
  if (!story) return;
  byId('story-title').textContent = story.title;
  byId('story-note').textContent = story.note;
  byId('story-refs').replaceChildren(...story.refs.map(ref => bibleLink(...ref.split('.'))));
}

function renderList() {
  const list = byId('result-list');
  const total = visible.length;
  const unmapped = visible.filter(place => !place.options.length).length;
  const missingText = unmapped ? ` · ${number.format(unmapped)} sem ponto` : '';
  byId('result-count').textContent = `${number.format(total)} ${total === 1 ? 'entrada' : 'entradas'}${missingText}`;
  byId('more-results').hidden = total <= resultsLimit;
  if (!total) {
    const row = element('li');
    row.append(element('p', 'empty-result', 'Nenhum lugar corresponde a estes filtros.'));
    list.replaceChildren(row);
    return;
  }
  const rows = visible.slice(0, resultsLimit).map(place => {
    const row = element('li');
    const button = element('button', 'place-button');
    button.type = 'button';
    button.dataset.place = place.id;
    if (place === activePlace) button.setAttribute('aria-current', 'true');
    button.append(
      element('i', `dot ${place.status}`), element('span', 'place-name', place.name),
      element('small', '', `${place.type} · ${statuses[place.status]}`),
    );
    button.addEventListener('click', () => selectPlace(place, 0, true, true));
    row.append(button);
    return row;
  });
  list.replaceChildren(...rows);
}

function fitAll() {
  const coordinates = visible.flatMap(place => place.options.slice(0, 1).map(locationOf));
  if (!coordinates.length) return;
  if (visible.length > 110 && !activeStory()) {
    map.fitBounds(initialView, { padding: [20, 20], animate: false });
    return;
  }
  map.fitBounds(coordinates, { padding: [46, 46], maxZoom: coordinates.length === 1 ? 10 : 8.5, animate: false });
}

function marker(place, point, layer, index = 0, selected = false) {
  const alternative = index > 0 ? ' alternative' : '';
  const current = selected ? ' selected' : '';
  const markerName = index ? `${place.name} · ${point.label}` : place.name;
  const type = selected && index ? 'disputed' : place.status;
  const zIndexOffset = selected ? 1100 : place.kind === 'region' ? 100 : 0;
  return L.marker(locationOf(point), {
    icon: L.divIcon({
      className: `atlas-marker ${type} ${place.kind}${current}${alternative}`,
      html: '<span aria-hidden="true"></span>', iconSize: [19, 19], iconAnchor: [9, 9],
    }),
    title: markerName, alt: markerName, riseOnHover: true, zIndexOffset,
    opacity: selected || featured.has(place) ? 1 : .72,
  }).bindTooltip(element('span', '', markerName), { direction: 'top', offset: [0, -7] })
    .on('click', () => selectPlace(place, index, false)).addTo(layer);
}

function renderAncientLabels() {
  ancientLabels.clearLayers();
  const zoom = map.getZoom();
  const bounds = map.getBounds().pad(.08);
  const accepted = new Set();
  const named = visible.filter(place => place.options.length && (
    visible.length <= 15 || focusLabels.has(place.slug) || (zoom >= 8 && featured.has(place))
  ));
  for (const place of named) {
    const coordinates = locationOf(place.options[0]);
    if (!bounds.contains(coordinates)) continue;
    const { x, y } = map.latLngToContainerPoint(coordinates);
    const cell = `${Math.floor(x / 125)}:${Math.floor(y / 24)}`;
    if (accepted.has(cell)) continue;
    accepted.add(cell);
    labelAt(ancientLabels, coordinates, 'markerPane', place.name.split(/ · | \(|, /)[0], 'ancient-label', [-9, 14]);
  }
}

function renderPlaces() {
  placeLayer.clearLayers();
  for (const place of visible) {
    if (place.options.length && place !== activePlace) marker(place, place.options[0], placeLayer);
  }
  renderAncientLabels();
}

function renderSelection() {
  selectedLayer.clearLayers();
  if (!activePlace) return;
  activePlace.options.forEach((point, index) => {
    const current = index === activeOption;
    const pointMarker = marker(activePlace, point, selectedLayer, index, current);
    if (current) {
      pointMarker.openTooltip();
      if (Number.isFinite(point.radius)) {
        L.circle(locationOf(point), {
          radius: point.radius, weight: 1, color: '#a34624', fillOpacity: .08, dashArray: '4 4', interactive: false,
        }).addTo(selectedLayer);
      }
    }
  });
}

function detailsReferences(place) {
  const refs = element('details');
  const selected = filters.book.value;
  const selectedChapter = filters.chapter.value;
  const entries = Object.keys(BOOKS)
    .filter(code => (!selected || code === selected) && Object.prototype.hasOwnProperty.call(place.refs, code))
    .map(code => [code, place.refs[code].filter(position => !selectedChapter || chapterOf(position) === selectedChapter)]);
  const total = entries.reduce((sum, entry) => sum + entry[1].length, 0);
  refs.append(element('summary', '', `Referências bíblicas (${number.format(total)})`));
  refs.open = total <= 24 || Boolean(selected);
  for (const [code, positions] of entries) {
    const chapters = [...new Set(positions.map(chapterOf).filter(Boolean))];
    const links = element('div', 'refs');
    for (const chapter of chapters) {
      const verses = positions.filter(position => position.split(':')[0] === chapter);
      const passage = verses.length === 1 ? verses[0] : chapter;
      const chapterLink = bibleLink(code, passage);
      chapterLink.title = `${BOOKS[code]} ${verses.join(', ')}`;
      links.append(chapterLink);
    }
    refs.append(element('h3', '', BOOKS[code] ?? code), links);
  }
  return refs;
}

function renderDetails() {
  const target = byId('details');
  const place = activePlace;
  if (!place) {
    const title = element('h2', '', 'Informações do lugar');
    title.id = 'details-title';
    target.replaceChildren(title, element('p', '', 'Selecione um ponto no mapa ou na lista para ver a identificação moderna, as referências e outras hipóteses.'));
    return;
  }

  const title = element('h2', '', place.name);
  title.id = 'details-title';
  const evidence = element('span', 'confidence');
  evidence.append(element('i', `dot ${place.status}`), document.createTextNode(`${statuses[place.status]} · ${place.type}`));
  target.replaceChildren(title, evidence);
  if (place.note) target.append(element('p', '', place.note));
  const galeria = window.BiblieIlustracoes.galeria('atlas', place.slug, 'Região e vida na época');
  if (galeria) target.append(galeria);
  if (place.options.length) {
    const options = element('ul');
    place.options.forEach((point, index) => {
      const item = element('li');
      const button = element('button', `map-action${index === activeOption ? ' selected-option' : ''}`, point.label);
      button.type = 'button';
      button.title = `Enquadrar ${point.label} no mapa`;
      button.setAttribute('aria-pressed', String(index === activeOption));
      button.addEventListener('click', () => {
        selectPlace(place, index, true);
        byId('details').querySelectorAll('.map-action')[index]?.focus({ preventScroll: true });
      });
      item.append(button, document.createTextNode(` · ${point.lat.toFixed(4)}°, ${point.lon.toFixed(4)}° · `),
        link('Mapa atual detalhado', externalMap(point), true));
      options.append(item);
    });
    target.append(element('h3', '', 'Identificações geográficas'), options);
  }
  if (Object.keys(place.refs).length) target.append(detailsReferences(place));
  const sources = element('p');
  sources.append(link('Ficha e bibliografia em OpenBible.info', `https://www.openbible.info/geo/ancient/${place.id}/${place.slug}`, true));
  if (place.primary) sources.append(document.createTextNode(' · '), link(...place.primary, true));
  target.append(sources);
}

function selectPlace(place, index, zoom, mobileDetails = false) {
  const changedPlace = activePlace !== place;
  activePlace = place;
  activeOption = index;
  if (changedPlace) {
    const previous = document.querySelector('.place-button[aria-current]');
    if (previous) previous.removeAttribute('aria-current');
    document.querySelector(`.place-button[data-place="${place.id}"]`)?.setAttribute('aria-current', 'true');
    renderPlaces();
  }
  const point = place.options[index];
  if (zoom && point) map.setView(locationOf(point), Math.max(8, map.getZoom()), { animate: false });
  renderSelection();
  renderDetails();
  if (mobileDetails && window.matchMedia('(max-width: 660px)').matches) {
    byId('details').scrollIntoView({ block: 'nearest' });
  }
}

function updateResults(reframe) {
  visible = getResults();
  if (!visible.includes(activePlace)) {
    activePlace = null;
    activeOption = 0;
  }
  resultsLimit = 35;
  renderStory();
  renderList();
  renderPlaces();
  renderSelection();
  renderDetails();
  if (reframe) fitAll();
}

function setup() {
  byId('place-total').textContent = number.format(PLACES.length);
  byId('story-total').textContent = number.format(STORIES.length);
  for (const [code, name] of Object.entries(BOOKS)) filters.book.add(new Option(name, code));
  const eras = new Map();
  for (const story of STORIES) {
    if (!eras.has(story.era)) {
      const group = element('optgroup');
      group.label = story.era;
      eras.set(story.era, group);
    }
    eras.get(story.era).append(new Option(story.title, story.id));
  }
  filters.episode.append(...eras.values());
  for (const field of [filters.episode, filters.kind, filters.chapter, filters.all]) {
    field.addEventListener('change', () => updateResults(true));
  }
  filters.book.addEventListener('change', () => { fillChapters(); updateResults(true); });
  filters.search.addEventListener('input', () => updateResults(true));
  byId('reframe').addEventListener('click', fitAll);
  byId('modern').addEventListener('change', updateOpacity);
  byId('opacity').addEventListener('input', updateOpacity);
  byId('more-results').addEventListener('click', () => {
    const next = resultsLimit;
    resultsLimit += 35;
    renderList();
    byId('result-list').querySelectorAll('button')[next]?.focus();
  });
  map.on('moveend', () => { renderModernLabels(); renderAncientLabels(); });

  const params = new URLSearchParams(location.search);
  filters.book.value = params.get('livro')?.toUpperCase() ?? '';
  fillChapters(params.get('capitulo') ?? '');
  filters.episode.value = params.get('episodio') ?? '';
  filters.search.value = params.get('q') ?? '';
  if (params.has('lugar')) filters.all.checked = true;
  updateOpacity();
  updateResults(true);
  const deepPlace = visible.find(place => place.slug === params.get('lugar') || place.id === params.get('lugar'));
  if (deepPlace) selectPlace(deepPlace, 0, true);
}

setup();
