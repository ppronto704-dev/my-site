const API_URL = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/base_weapons.json';
const categoryLabels = {
  Pistols: 'Пистолет',
  SMGs: 'ПП',
  Rifles: 'Винтовка',
  Heavy: 'Тяжёлое',
  Knives: 'Нож',
  Grenades: 'Граната',
  Equipment: 'Снаряжение',
  C4: 'Взрывчатка'
};
const categoryOrder = ['Pistols', 'SMGs', 'Rifles', 'Heavy', 'Knives', 'Grenades', 'Equipment', 'C4'];
const includedCategories = new Set(categoryOrder);
const grid = document.querySelector('#weapon-grid');
const searchInput = document.querySelector('#search');
const filters = document.querySelector('#filters');
const emptyState = document.querySelector('#empty-state');
const errorState = document.querySelector('#error-state');
const favoritesOnly = document.querySelector('#favorites-only');
const dialog = document.querySelector('#weapon-dialog');
let weapons = [];
let activeCategory = 'all';
let favorites = new Set(JSON.parse(localStorage.getItem('cs2-armory-favorites') || '[]'));

function isCatalogItem(item) {
  const category = item.category?.name;
  if (!includedCategories.has(category)) return false;
  if (category === 'Equipment') return item.name === 'Zeus x27';
  return Boolean(item.name && item.image);
}

function renderFilters() {
  const counts = Object.fromEntries(categoryOrder.map((category) => [category, weapons.filter((weapon) => weapon.category === category).length]));
  filters.querySelector('[data-category="all"] span').textContent = weapons.length;
  filters.querySelectorAll('[data-category]').forEach((button) => {
    const category = button.dataset.category;
    if (category !== 'all') button.querySelector('span').textContent = counts[category] || 0;
  });
  document.querySelector('#total-count').textContent = weapons.length;
}

function getVisibleWeapons() {
  const query = searchInput.value.trim().toLocaleLowerCase('ru');
  return weapons.filter((weapon) => {
    const inCategory = activeCategory === 'all' || weapon.category === activeCategory;
    const isFavorite = !favoritesOnly.checked || favorites.has(weapon.id);
    const matchesQuery = `${weapon.name} ${weapon.nameRu} ${weapon.categoryLabel}`.toLocaleLowerCase('ru').includes(query);
    return inCategory && isFavorite && matchesQuery;
  });
}

function render() {
  const visible = getVisibleWeapons();
  document.querySelector('#results-count').textContent = `${String(visible.length).padStart(2, '0')} / ${weapons.length} ПОЗИЦИЙ`;
  grid.replaceChildren();
  emptyState.hidden = visible.length > 0;
  if (!visible.length) return;

  const fragment = document.createDocumentFragment();
  visible.forEach((weapon, index) => {
    const card = document.createElement('article');
    card.className = 'weapon-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `${weapon.name}, ${weapon.categoryLabel}. Подробнее`);
    card.style.animationDelay = `${Math.min(index % 12, 8) * 35}ms`;

    const top = document.createElement('div');
    top.className = 'card-topline';
    const type = document.createElement('span');
    type.className = 'card-category';
    const tick = document.createElement('i');
    tick.className = 'category-tick';
    const label = document.createElement('span');
    label.textContent = weapon.categoryLabel.toLocaleUpperCase('ru');
    type.append(tick, label);
    const number = document.createElement('span');
    number.className = 'card-index';
    number.textContent = `#${String(index + 1).padStart(2, '0')}`;
    top.append(type, number);

    const favorite = document.createElement('button');
    favorite.type = 'button';
    favorite.className = `favorite-button${favorites.has(weapon.id) ? ' is-favorite' : ''}`;
    favorite.setAttribute('aria-label', favorites.has(weapon.id) ? 'Убрать из избранного' : 'Добавить в избранное');
    favorite.setAttribute('aria-pressed', String(favorites.has(weapon.id)));
    favorite.textContent = favorites.has(weapon.id) ? '★' : '☆';
    favorite.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFavorite(weapon.id);
    });

    const art = document.createElement('div');
    art.className = 'card-art';
    const image = document.createElement('img');
    image.src = weapon.image;
    image.alt = weapon.name;
    image.loading = index < 8 ? 'eager' : 'lazy';
    image.onerror = () => {
      image.remove();
      const fallback = document.createElement('span');
      fallback.className = 'image-fallback';
      fallback.textContent = weapon.name.toLocaleUpperCase('ru');
      art.append(fallback);
    };
    art.append(image);

    const copy = document.createElement('div');
    copy.className = 'card-copy';
    const name = document.createElement('h3');
    name.textContent = weapon.name;
    const open = document.createElement('span');
    open.className = 'card-open';
    open.textContent = '↗';
    copy.append(name, open);
    card.append(top, favorite, art, copy);
    card.addEventListener('click', () => openWeapon(weapon));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openWeapon(weapon);
      }
    });
    fragment.append(card);
  });
  grid.append(fragment);
}

function toggleFavorite(id) {
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  localStorage.setItem('cs2-armory-favorites', JSON.stringify([...favorites]));
  render();
}

function openWeapon(weapon) {
  const image = document.querySelector('#dialog-image');
  image.src = weapon.image;
  image.alt = weapon.name;
  image.hidden = false;
  image.onerror = () => { image.hidden = true; };
  document.querySelector('#dialog-category').textContent = weapon.categoryLabel;
  document.querySelector('#dialog-name').textContent = weapon.name;
  document.querySelector('#dialog-description').textContent = weapon.description || 'Базовый предмет арсенала Counter-Strike 2.';
  document.querySelector('#dialog-id').textContent = weapon.id.toLocaleUpperCase('ru');
  dialog.showModal();
}

async function loadWeapons() {
  errorState.hidden = true;
  grid.hidden = false;
  grid.innerHTML = '<div class="loading-state"><span class="loader"></span><span>ЗАПРОС К БАЗЕ АРСЕНАЛА...</span></div>';
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    weapons = data.filter(isCatalogItem).map((item) => ({
      id: item.id,
      name: item.name,
      nameRu: item.name,
      category: item.category.name,
      categoryLabel: categoryLabels[item.category.name],
      image: item.image,
      description: item.description
    })).sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) || a.name.localeCompare(b.name, 'en'));
    renderFilters();
    render();
  } catch (error) {
    console.error('Не удалось загрузить базу оружия CS2:', error);
    grid.hidden = true;
    errorState.hidden = false;
    document.querySelector('#results-count').textContent = 'ОШИБКА ЗАГРУЗКИ';
  }
}

filters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-category]');
  if (!button) return;
  activeCategory = button.dataset.category;
  filters.querySelectorAll('.filter-button').forEach((filter) => filter.classList.toggle('is-active', filter === button));
  render();
});
searchInput.addEventListener('input', render);
favoritesOnly.addEventListener('change', render);
document.querySelector('#reset-filters').addEventListener('click', () => {
  activeCategory = 'all';
  searchInput.value = '';
  favoritesOnly.checked = false;
  filters.querySelectorAll('.filter-button').forEach((button) => button.classList.toggle('is-active', button.dataset.category === 'all'));
  render();
});
document.querySelector('#retry-load').addEventListener('click', loadWeapons);
document.querySelector('#dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !dialog.open && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});
loadWeapons();
