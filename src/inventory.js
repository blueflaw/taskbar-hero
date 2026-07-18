// Plain JS, no framework - this window is simple enough not to need one.
// State flows in one direction: main window -> main process -> here.
// Actions flow back the same path in reverse (see equip()).

let latestData = null;
let selectedItemId = null;

const partyList = document.getElementById('party-list');
const recruitList = document.getElementById('recruit-list');
const inventoryGrid = document.getElementById('inventory-grid');
const goldDisplay = document.getElementById('gold-display');
const selectedHint = document.getElementById('selected-hint');

function render() {
  if (!latestData) return;

  goldDisplay.textContent = `${latestData.gold} gold`;
  selectedHint.textContent = selectedItemId ? '— pick a hero slot to equip' : '';

  renderParty();
  renderRecruits();
  renderInventory();
}

function renderParty() {
  partyList.innerHTML = '';

  latestData.party.forEach((hero) => {
    const card = document.createElement('div');
    card.className = 'hero-card';

    const hpPct = Math.round((hero.hp / hero.maxHp) * 100);
    const selectedItem = selectedItemId
      ? latestData.inventory.find((i) => i.id === selectedItemId)
      : null;

    const slotsHtml = ['weapon', 'armor', 'trinket']
      .map((slot) => {
        const equipped = hero.equipment[slot];
        const classOk = !selectedItem?.allowedClasses || selectedItem.allowedClasses.includes(hero.classId);
        const canEquipHere = selectedItem && selectedItem.slot === slot && classOk;
        const classes = ['equip-slot'];
        if (equipped) classes.push('filled');
        if (canEquipHere) classes.push('equippable');
        if (selectedItem && selectedItem.slot === slot && !classOk) classes.push('wrong-class');

        const label = equipped ? equipped.label : `+ ${slot}`;
        return `<div class="${classes.join(' ')}" data-hero-id="${hero.id}" data-slot="${slot}">${label}</div>`;
      })
      .join('');

    card.innerHTML = `
      <div class="hero-card-top">
        <span class="hero-name">${hero.label}</span>
        <span class="hero-level">Lv. ${hero.level}</span>
      </div>
      <div class="hp-bar-track"><div class="hp-bar-fill" style="width:${hpPct}%"></div></div>
      <div class="equip-slots">${slotsHtml}</div>
    `;

    partyList.appendChild(card);
  });

  // Wire up equip-slot clicks after the HTML is in the DOM
  partyList.querySelectorAll('.equip-slot.equippable').forEach((el) => {
    el.addEventListener('click', () => {
      const heroId = Number(el.dataset.heroId);
      equip(heroId, selectedItemId);
    });
  });
}

const STAT_LABELS = {
  atk: 'ATK',
  attackSpeed: 'SPD',
  armor: 'ARM',
  critChance: 'CRIT%',
  critDamageMult: 'CRIT DMG',
  cooldownReduction: 'CDR',
  moveSpeed: 'MOVE',
  castSpeed: 'CAST',
  hp: 'HP',
};

function formatStats(stats) {
  return Object.entries(stats || {})
    .map(([key, value]) => `+${value} ${STAT_LABELS[key] ?? key}`)
    .join(', ');
}

function formatClassRestriction(item) {
  if (!item.allowedClasses) return '';
  // classId -> display label isn't sent over the wire for items (only for
  // party members) - title-casing the id is good enough for a small badge.
  const names = item.allowedClasses.map((id) => id.charAt(0).toUpperCase() + id.slice(1));
  return `<div class="item-class-restriction">${names.join('/')} only</div>`;
}

function renderInventory() {
  inventoryGrid.innerHTML = '';

  if (latestData.inventory.length === 0) {
    inventoryGrid.innerHTML = '<div class="empty-state">No items yet - keep fighting!</div>';
    return;
  }

  latestData.inventory.forEach((item) => {
    const card = document.createElement('div');
    card.className = `item-card rarity-${item.rarity}`;
    if (item.id === selectedItemId) card.classList.add('selected');

    card.innerHTML = `
      <div>${item.label}</div>
      <div class="item-stat">${formatStats(item.stats)}</div>
      ${formatClassRestriction(item)}
    `;

    card.addEventListener('click', () => {
      selectedItemId = selectedItemId === item.id ? null : item.id;
      render();
    });

    inventoryGrid.appendChild(card);
  });
}

function renderRecruits() {
  recruitList.innerHTML = '';

  if (latestData.partyFull) {
    recruitList.innerHTML = '<div class="empty-state">Party is full</div>';
    return;
  }

  if (latestData.recruitable.length === 0) {
    recruitList.innerHTML = '<div class="empty-state">Everyone available has joined</div>';
    return;
  }

  latestData.recruitable.forEach((option) => {
    const canAfford = latestData.gold >= option.cost;
    const card = document.createElement('div');
    card.className = 'recruit-card';
    card.innerHTML = `
      <div class="recruit-info">
        <span class="recruit-name">${option.label}</span>
        <span class="recruit-cost">${option.cost} gold</span>
      </div>
      <button class="recruit-button" ${canAfford ? '' : 'disabled'}>Recruit</button>
    `;

    card.querySelector('.recruit-button').addEventListener('click', () => {
      if (!canAfford) return;
      recruit(option.classId);
    });

    recruitList.appendChild(card);
  });
}

function recruit(classId) {
  window.inventoryBridge.recruitHero(classId);
  setTimeout(() => window.inventoryBridge.requestSync(), 100);
}

function equip(heroId, itemId) {
  window.inventoryBridge.equipItem(heroId, itemId);
  selectedItemId = null;
  // Don't wait for the next poll - the game window will push a fresh sync
  // right after it processes the equip, but request one now too for snappiness.
  setTimeout(() => window.inventoryBridge.requestSync(), 100);
}

window.inventoryBridge.onSyncData((data) => {
  latestData = data;
  render();
});

window.inventoryBridge.requestSync();
setInterval(() => window.inventoryBridge.requestSync(), 2000); // keep HP/gold fresh while open
