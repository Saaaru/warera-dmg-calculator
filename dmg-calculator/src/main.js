// --- START OF FILE main.js ---

// Main file: Handles initialization, events, and interaction logic for the damage simulator and player management.

import {
  playerState,
  setSkillsData,
  skillsData,
  resetPlayerState,
  SKILL_POINTS_PER_LEVEL,
  MIN_PLAYER_LEVEL,
  MAX_PLAYER_LEVEL,
  MAX_SKILL_LEVEL,
  MIN_SKILL_LEVEL
} from './state.js';
import {
  getSkillData,
  simulateCombatTick,
  calculateCumulativeSkillCost,
  simulateFullCombatWithFood,
  calculateStatDetails
} from './calculator.js';
import {
  ui,
  cacheDOMElements,
  renderAllUI,
  showItemConfigPanel,
  hideItemConfigPanel,
  handleStatMouseEnter,
  handleStatMouseLeave,
  applyButtonTransform,
  renderSimulationLog,
  handleProgressBlockMouseEnter,
  handleProgressBlockMouseLeave,
  showFoodSelectionModal,
  hideFoodSelectionModal,
  formatSkillValue,
  showConfirmationModal,
  renderApiLoader,
  showActionFeedbackTooltip
} from './ui.js';

// === PRESET HELPERS ===
const PRESETS_STORAGE_KEY = 'playerBuildPresets';

/**
 * Obtiene los presets del localStorage de forma segura.
 * @returns {Array} Un array de presets o un array vacío si no hay nada o hay un error.
 */
function getPresetsFromStorage() {
  try {
    const presetsJson = localStorage.getItem(PRESETS_STORAGE_KEY);
    return presetsJson ? JSON.parse(presetsJson) : [];
  } catch (error) {
    console.error("Error parsing presets from localStorage:", error);
    localStorage.removeItem(PRESETS_STORAGE_KEY);
    return [];
  }
}

/**
 * Guarda el array de presets en localStorage.
 * @param {Array} presets El array de presets a guardar.
 */
function savePresetsToStorage(presets) {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

async function fetchJsonData(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Could not load data from ${path}:`, error);
    return null;
  }
}

function handleSkillButtonClick(button) {
  const skillCode = button.dataset.skill;
  const action = button.dataset.action;
  let currentLevel = playerState.skillLevelsAssigned[skillCode];
  const maxHealthBefore = getSkillData('health', playerState.skillLevelsAssigned.health)?.value || 50;
  const maxHungerBefore = getSkillData('hunger', playerState.skillLevelsAssigned.hunger)?.value || 10;
  const wasHealthMax = playerState.currentHealth >= maxHealthBefore;
  const wasHungerMax = playerState.currentHunger >= maxHungerBefore;

  if (action === 'plus') {
    const nextLevel = Math.min(currentLevel + 1, MAX_SKILL_LEVEL);
    const nextSkillInfo = getSkillData(skillCode, nextLevel);
    if (nextSkillInfo && playerState.skillPointsAvailable >= nextSkillInfo.cost && playerState.playerLevel >= nextSkillInfo.unlockAtLevel) {
      playerState.skillLevelsAssigned[skillCode] = nextLevel;
      playerState.skillPointsAvailable -= nextSkillInfo.cost;
      playerState.skillPointsSpent += nextSkillInfo.cost;
    }
  } else if (action === 'minus') {
    if (currentLevel > MIN_SKILL_LEVEL) {
        const refundedCost = getSkillData(skillCode, currentLevel)?.cost || 0;
        playerState.skillLevelsAssigned[skillCode] = currentLevel - 1;
        playerState.skillPointsAvailable += refundedCost;
        playerState.skillPointsSpent -= refundedCost;
    }
  }

  if (action === 'plus') {
    if (skillCode === 'health' && wasHealthMax) {
        const maxHealthAfter = getSkillData('health', playerState.skillLevelsAssigned.health)?.value || 50;
        playerState.currentHealth = maxHealthAfter;
    }
    if (skillCode === 'hunger' && wasHungerMax) {
        const maxHungerAfter = getSkillData('hunger', playerState.skillLevelsAssigned.hunger)?.value || 10;
        playerState.currentHunger = maxHungerAfter;
    }
  }
  renderAllUI();
}

function handleLevelButtonClick(event) {
  const button = event.target;
  const action = button.id === 'level-plus-btn' ? 'plus' : 'minus';
  let newLevel = playerState.playerLevel;
  if (action === 'plus') {
    newLevel = Math.min(playerState.playerLevel + 1, MAX_PLAYER_LEVEL);
  } else {
    newLevel = Math.max(playerState.playerLevel - 1, MIN_PLAYER_LEVEL);
  }
  if (newLevel !== playerState.playerLevel) {
    const oldTotalPoints = playerState.playerLevel * SKILL_POINTS_PER_LEVEL;
    playerState.playerLevel = newLevel;
    const newTotalPoints = newLevel * SKILL_POINTS_PER_LEVEL;
    playerState.skillPointsAvailable += (newTotalPoints - oldTotalPoints);
    if (playerState.skillPointsSpent > newTotalPoints) {
      for (const skillCode in playerState.skillLevelsAssigned) {
        playerState.skillLevelsAssigned[skillCode] = 0;
      }
      playerState.skillPointsSpent = 0;
      playerState.skillPointsAvailable = newTotalPoints;
    }
  }
  renderAllUI();
}

function handleInventoryItemClick(event) {
  const itemElement = event.target.closest('.inventory-item');
  if (!itemElement) return;
  const itemCode = itemElement.dataset.code;
  const itemData = skillsData.skills[itemCode];
  if (!itemData) {
    console.warn(`Item with code "${itemCode}" not found in skills data.`);
    return;
  }
  if (itemData.isConsumable && itemData.flatStats && itemData.flatStats.healthRegen) {
    handleConsumeFood(itemData);
  } else {
    playerState.selectedConfigItem = { ...itemData, code: itemCode };
    showItemConfigPanel(itemData);
  }
}

function handleConsumeFood(foodData) {
  if (playerState.currentHunger < 1) {
    console.log("Not enough hunger to eat.");
    return;
  }
  const maxHealth = getSkillData('health', playerState.skillLevelsAssigned.health)?.value || 50;
  if (playerState.currentHealth >= maxHealth) {
    console.log("Cannot eat, health is already full or overcharged.");
    return;
  }
  const healthRestored = foodData.flatStats.healthRegen || 0;
  playerState.currentHunger -= 1;
  playerState.currentHealth += healthRestored;
  renderAllUI();
}

function handleResetGame() {
  resetPlayerState();
  playerState.skillPointsAvailable = SKILL_POINTS_PER_LEVEL;
  playerState.skillPointsSpent = 0;
  const maxHealth = getSkillData('health', 0)?.value || 50;
  const maxHunger = getSkillData('hunger', 0)?.value || 10;
  playerState.currentHealth = maxHealth;
  playerState.currentHunger = maxHunger;

  if (ui.simulationLog) {
    ui.simulationLog.innerHTML = 'Simulation results will appear here.';
  }

  renderApiLoader();
  ui.loadFromApiBtn.addEventListener('click', handleLoadFromAPI);
  
  const avatarImg = document.querySelector('.avatar');
  if (avatarImg) {
    avatarImg.src = 'public/images/items/avatar.png';
  }
  
  renderAllUI();
  applyButtonTransform(ui.resetBtn);
}


function handleEquipItem() {
  const itemToConfigure = playerState.selectedConfigItem;
  if (!itemToConfigure) return;
  const itemSlot = itemToConfigure.usage;
  if (!itemSlot) return;
  const configuredStats = {};
  const statSliders = ui.itemStatsConfig.querySelectorAll('input[type="range"]');
  if (statSliders.length > 0) {
      statSliders.forEach(slider => {
          configuredStats[slider.dataset.stat] = parseFloat(slider.value);
      });
  } else if (itemToConfigure.flatStats) {
      Object.assign(configuredStats, itemToConfigure.flatStats);
  }
  const equippedItem = {
      code: itemToConfigure.code,
      name: formatCodeToName(itemToConfigure.code),
      stats: configuredStats,
      tier: itemToConfigure.tier
  };
  playerState.equippedItems[itemSlot] = equippedItem;
  Object.keys(equippedItem.stats).forEach(statCode => {
      if(ui.characterStats[statCode]) {
          const statSpan = ui.characterStats[statCode].parentNode.querySelector('span:last-child');
          statSpan.classList.add('stat-updated');
          setTimeout(() => statSpan.classList.remove('stat-updated'), 700);
      }
  });
  hideItemConfigPanel();
  renderAllUI();
}

function handleUnequipItem(event) {
    event.preventDefault();
    const slotElement = event.target.closest('.equipment-slot');
    if (!slotElement) return;
    const slot = slotElement.dataset.slot;
    if (slot && playerState.equippedItems[slot]) {
        playerState.equippedItems[slot] = null;
        renderAllUI();
    }
}

function handleBuffButtonClick(event) {
  const button = event.target.closest('.buff-btn');
  if (!button) return;

  // === INICIO DE LA CORRECCIÓN ===
  // Ahora verificamos la clase '.btn-inactive' en lugar del atributo 'disabled'.
  // Esto funcionará porque el botón ya no está realmente deshabilitado.
  if (button.classList.contains('btn-inactive')) {
    showActionFeedbackTooltip(button, "You can't use ammo without a weapon equipped!");
    return; // Detenemos la ejecución aquí.
  }
  // === FIN DE LA CORRECCIÓN ===

  const buffCode = button.dataset.buffCode;
  const buffData = skillsData.skills[buffCode];
  if (!buffData) return;

  const buffType = buffData.usage === 'ammo' ? 'ammo' : 'consumable';
  const buffObject = {
      code: buffCode,
      name: formatCodeToName(buffCode),
      stats: buffData.flatStats,
      tier: buffData.tier
  };
  
  if (buffType === 'ammo') {
    if (playerState.activeBuffs.ammo?.code === buffCode) {
      playerState.activeBuffs.ammo = null;
      playerState.equippedItems.ammo = null;
    } else {
      playerState.activeBuffs.ammo = buffObject;
      playerState.equippedItems.ammo = buffObject;
    }
  } else {
    if (playerState.activeBuffs[buffType]?.code === buffCode) {
        playerState.activeBuffs[buffType] = null;
    } else {
        playerState.activeBuffs[buffType] = buffObject;
    }
  }
  renderAllUI();
}

function handleDamageSimulation() {
  if (playerState.currentHealth <= 0) {
      console.log("Cannot simulate, character has no health.");
      return;
  }
  const simulationResult = simulateCombatTick();
  playerState.currentHealth = Math.max(0, playerState.currentHealth - simulationResult.healthLost);
  playerState.cumulativeDamage += simulationResult.finalDamageDealt;
  renderSimulationLog(simulationResult);
  applyButtonTransform(ui.simulateBtn);
  renderAllUI();
}

function handleFullCombatModalOpening() {
  if (playerState.currentHealth <= 0) {
      console.log("Cannot simulate, character has no health.");
      return;
  }
  showFoodSelectionModal();
  applyButtonTransform(ui.simulateFullBtn);
}

function formatCodeToName(code) {
  if (!code) return '';
  return code.replace(/([A-Z])/g, ' $1').replace(/(\d+)/g, ' $1').replace(/^./, (str) => str.toUpperCase());
}

function startFullCombatWithFood() {
  const selectedItemElement = ui.modal.foodOptions.querySelector('.selected');
  if (!selectedItemElement) return;
  const itemCode = selectedItemElement.dataset.code;
  const foodItem = skillsData.skills[itemCode];
  const fullResult = simulateFullCombatWithFood({ ...foodItem, name: formatCodeToName(itemCode) });
  
  playerState.currentHealth = fullResult.finalHealth;
  playerState.currentHunger = fullResult.finalHunger;
  
  const summary = `Survived ${fullResult.ticksSurvived} hits using ${formatCodeToName(itemCode)}, dealing ${fullResult.totalDamageDealt} total damage.`;
  playerState.lastSimulationSummary = summary;
  playerState.lastFullSimulationResult = {
    totalDamage: fullResult.totalDamageDealt,
    ticksSurvived: fullResult.ticksSurvived
  };
  
  renderSimulationLog(fullResult, summary);
  hideFoodSelectionModal();
  renderAllUI(); 
}

function handleExportBuild() {
  const exportButton = ui.exportBtn;
  if (!window.html2canvas) {
    console.error('html2canvas library is not loaded.');
    alert('Error: Export library not found.');
    return;
  }
  populateExportCard(playerState.lastSimulationSummary);
  exportButton.textContent = 'Generating...';
  exportButton.disabled = true;
  const cardElement = document.getElementById('build-export-card');

  html2canvas(cardElement, {
    backgroundColor: '#0d1117',
    useCORS: true,
    scale: 2
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = `player-build-lvl-${playerState.playerLevel}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    exportButton.textContent = '📤 Export Build';
    exportButton.disabled = false;
  }).catch(err => {
    console.error('Failed to export build:', err);
    alert('An error occurred while generating the image.');
    exportButton.textContent = '📤 Export Build';
    exportButton.disabled = false;
  });
}

function populateExportCard(summary) {
  document.getElementById('export-level-badge').textContent = `LVL ${playerState.playerLevel}`;
  document.getElementById('export-simulation-summary').textContent = summary;
  const skillsList = document.getElementById('export-skills-list');
  skillsList.innerHTML = '';
  const skillIcons = { attack: '🗡️', precision: '🎯', criticalChance: '💥', criticalDamages: '🔥', armor: '🛡️', dodge: '🌀', health: '❤️', hunger: '🍗' };
  Object.keys(skillIcons).forEach(code => {
      const level = playerState.skillLevelsAssigned[code];
      const li = document.createElement('li');
      li.className = 'export-skills-list-item';
      li.innerHTML = `
          <span class="icon">${skillIcons[code]}</span>
          <span class="name">${formatCodeToName(code)}</span>
          <span class="points">${level} / ${MAX_SKILL_LEVEL}</span>
      `;
      skillsList.appendChild(li);
  });
  const statsContainer = document.getElementById('export-stats-list');
  statsContainer.innerHTML = '';
  const statsToDisplay = ['attack', 'precision', 'criticalChance', 'criticalDamages', 'armor', 'dodge'];
  statsToDisplay.forEach(code => {
      const details = calculateStatDetails(code);
      const statItemDiv = document.createElement('div');
      statItemDiv.className = 'export-stat-item';
      let breakdownHtml = '<ul class="export-stat-breakdown">';
      breakdownHtml += `<li><span class="source">Base Skill:</span> <span class="value">${formatSkillValue(code, details.skillValue)}</span></li>`;
      if (details.equipmentValue > 0) {
          const itemNames = details.equipmentItems.map(item => item.name).join(', ');
          breakdownHtml += `<li><span class="source">Equipment (${itemNames}):</span> <span class="value">+${formatSkillValue(code, details.equipmentValue)}</span></li>`;
      }
      if (code === 'attack') {
          if (details.ammoPercent > 0) {
              breakdownHtml += `<li><span class="source">Ammo Buff:</span> <span class="value">+${details.ammoPercent}%</span></li>`;
          }
          if (details.buffPercent > 0) {
              breakdownHtml += `<li><span class="source">Consumable Buff:</span> <span class="value">+${details.buffPercent}%</span></li>`;
          }
      }
      breakdownHtml += '</ul>';
      statItemDiv.innerHTML = `
          <div class="export-stat-header">
              <span class="name">${formatCodeToName(code)}</span>
              <span class="total-value">${formatSkillValue(code, details.total)}</span>
          </div>
          ${breakdownHtml}
      `;
      statsContainer.appendChild(statItemDiv);
  });
  const equipmentGrid = document.getElementById('export-equipment-grid');
  equipmentGrid.innerHTML = '';
  Object.entries(playerState.equippedItems).forEach(([slot, item]) => {
      const slotDiv = document.createElement('div');
      slotDiv.className = 'export-equipment-slot';
      let content = `<span class="slot-name">${formatCodeToName(slot)}</span>`;
      if (item) {
          let imgCode = item.code;
          if (imgCode.startsWith('pants')) imgCode = 'pants1';
          else if (imgCode.startsWith('helmet')) imgCode = 'helmet1';
          else if (imgCode.startsWith('gloves')) imgCode = 'gloves1';
          else if (imgCode.startsWith('chest')) imgCode = 'chest1';
          else if (imgCode.startsWith('boots')) imgCode = 'boots1';
          const imgSrc = `public/images/items/${imgCode}.png`;
          content += `<img src="${imgSrc}" alt="${item.name}">`;
      } else {
          content += '<span>-</span>';
      }
      slotDiv.innerHTML = content;
      equipmentGrid.appendChild(slotDiv);
  });
}

function handleFullRestore() {
  const maxHealth = getSkillData('health', playerState.skillLevelsAssigned.health)?.value || 50;
  const maxHunger = getSkillData('hunger', playerState.skillLevelsAssigned.hunger)?.value || 10;
  playerState.currentHealth = maxHealth;
  playerState.currentHunger = maxHunger;
  applyButtonTransform(ui.fullRestoreBtn);
  renderAllUI();
}

/**
 * Renderiza la lista de presets guardados en el DOM.
 */
function renderPresetsList() {
  const presets = getPresetsFromStorage();
  ui.presetsListContainer.innerHTML = '';

  if (presets.length === 0) {
    ui.presetsListContainer.innerHTML = '<p>No presets saved yet.</p>';
    return;
  }

  presets.forEach(preset => {
    const presetElement = document.createElement('div');
    presetElement.className = 'preset-item';
    presetElement.innerHTML = `
      <span class="preset-name" title="${preset.name}">${preset.name}</span>
      <div class="preset-actions">
        <button class="action-btn preset-btn load-btn" data-preset-name="${preset.name}">Load</button>
        <button class="action-btn preset-btn delete-btn" data-preset-name="${preset.name}">Delete</button>
      </div>
    `;
    ui.presetsListContainer.appendChild(presetElement);
  });
}

/**
 * Maneja el guardado de un nuevo preset.
 */
async function handleSavePreset() {
  const userInput = ui.presetNameInput.value.trim();
  const keySkillsForNaming = [
    { code: 'attack', emoji: '🗡️' }, { code: 'precision', emoji: '🎯' }, { code: 'criticalChance', emoji: '💥' },
    { code: 'criticalDamages', emoji: '🔥' }, { code: 'armor', emoji: '🛡️' }, { code: 'dodge', emoji: '🌀' }
  ];
  const skillSummary = keySkillsForNaming.map(skill => `${skill.emoji} ${playerState.skillLevelsAssigned[skill.code]}`).join(' | ');

  const finalPresetName = userInput ? `${userInput} || ${skillSummary}` : skillSummary;
  
  const presets = getPresetsFromStorage();
  const existingPresetIndex = presets.findIndex(p => p.name === finalPresetName);

  if (existingPresetIndex > -1) {
    try {
      await showConfirmationModal({
        title: 'Overwrite Preset?',
        text: `A preset named "<strong>${finalPresetName}</strong>" already exists. Do you want to overwrite it?`
      });
    } catch {
      return;
    }
  }

  const stateSnapshot = {
    playerLevel: playerState.playerLevel,
    skillLevelsAssigned: JSON.parse(JSON.stringify(playerState.skillLevelsAssigned)),
    equippedItems: JSON.parse(JSON.stringify(playerState.equippedItems)),
    activeBuffs: JSON.parse(JSON.stringify(playerState.activeBuffs)),
  };

  const newPreset = { name: finalPresetName, timestamp: new Date().toISOString(), stateSnapshot };

  if (existingPresetIndex > -1) {
    presets[existingPresetIndex] = newPreset;
  } else {
    presets.push(newPreset);
  }

  savePresetsToStorage(presets);
  ui.presetNameInput.value = '';
  renderPresetsList();
}

/**
 * Carga un preset seleccionado, sobreescribiendo el estado actual.
 * @param {string} presetName El nombre del preset a cargar.
 */
async function handleLoadPreset(presetName) {
  try {
    await showConfirmationModal({
        title: 'Load Preset?',
        text: 'Are you sure you want to load this preset? Your current build will be overwritten.'
    });
  } catch {
    return;
  }

  const preset = getPresetsFromStorage().find(p => p.name === presetName);
  if (!preset) return;

  const { stateSnapshot } = preset;
  playerState.playerLevel = stateSnapshot.playerLevel;
  playerState.skillLevelsAssigned = JSON.parse(JSON.stringify(stateSnapshot.skillLevelsAssigned));
  playerState.equippedItems = JSON.parse(JSON.stringify(stateSnapshot.equippedItems));
  playerState.activeBuffs = JSON.parse(JSON.stringify(stateSnapshot.activeBuffs));
  
  const totalPointsForLevel = playerState.playerLevel * SKILL_POINTS_PER_LEVEL;
  let spentPoints = 0;
  for (const skillCode in playerState.skillLevelsAssigned) {
    spentPoints += calculateCumulativeSkillCost(skillCode, playerState.skillLevelsAssigned[skillCode]);
  }
  playerState.skillPointsSpent = spentPoints;
  playerState.skillPointsAvailable = totalPointsForLevel - spentPoints;
  
  const maxHealth = getSkillData('health', playerState.skillLevelsAssigned.health)?.value || 50;
  const maxHunger = getSkillData('hunger', playerState.skillLevelsAssigned.hunger)?.value || 10;
  playerState.currentHealth = maxHealth;
  playerState.currentHunger = maxHunger;
  
  renderAllUI();
  const loadButton = ui.presetsListContainer.querySelector(`.load-btn[data-preset-name="${presetName}"]`);
  if (loadButton) applyButtonTransform(loadButton);
}

/**
 * Elimina un preset guardado.
 * @param {string} presetName El nombre del preset a eliminar.
 */
async function handleDeletePreset(presetName) {
  try {
    await showConfirmationModal({
        title: 'Delete Preset?',
        text: `Are you sure you want to delete the preset "<strong>${presetName}</strong>"? This action cannot be undone.`
    });
  } catch {
    return;
  }

  const newPresets = getPresetsFromStorage().filter(p => p.name !== presetName);
  savePresetsToStorage(newPresets);
  renderPresetsList();
}

/**
 * Extrae un Player ID de 24 caracteres de una cadena.
 * @param {string} input La cadena de entrada (ID, URL, etc.).
 * @returns {string|null} El ID del jugador o null si no se encuentra.
 */
function getPlayerIdFromInput(input) {
  if (!input) return null;
  const match = input.match(/([a-f0-9]{24})/i);
  return match ? match[1] : null;
}

/**
 * Busca un Player ID a partir de un nombre de usuario.
 * @param {string} username El nombre de usuario.
 * @returns {Promise<string|null>} El primer ID de jugador encontrado o null.
 */
async function searchPlayerIdByUsername(username) {
    const apiObject = { "searchText": username };
    const encodedInput = encodeURIComponent(JSON.stringify(apiObject));
    const searchUrl = `https://api2.warera.io/trpc/search.searchAnything?input=${encodedInput}`;
    const response = await fetch(searchUrl);
    if (!response.ok) throw new Error(`Search API returned an error: ${response.status}`);
    const data = await response.json();
    return data.result?.data?.userIds?.[0] || null;
}

async function mapApiDataToPlayerState(apiData) {
  try {
    await showConfirmationModal({
      title: 'Load Player Data?',
      text: `Player data for <strong>${apiData.username}</strong> found! Do you want to load this build? Your current build will be overwritten.`
    });
  } catch {
    return;
  }
  
  playerState.playerLevel = apiData.leveling.level;
  Object.keys(playerState.skillLevelsAssigned).forEach(skillCode => {
    playerState.skillLevelsAssigned[skillCode] = apiData.skills[skillCode]?.level || 0;
  });

  const totalPointsForLevel = playerState.playerLevel * SKILL_POINTS_PER_LEVEL;
  let spentPoints = 0;
  for (const skillCode in playerState.skillLevelsAssigned) {
    spentPoints += calculateCumulativeSkillCost(skillCode, playerState.skillLevelsAssigned[skillCode]);
  }
  playerState.skillPointsSpent = spentPoints;
  playerState.skillPointsAvailable = totalPointsForLevel - spentPoints;
  
  const maxHealth = getSkillData('health', playerState.skillLevelsAssigned.health)?.value || 50;
  const maxHunger = getSkillData('hunger', playerState.skillLevelsAssigned.hunger)?.value || 10;
  playerState.currentHealth = maxHealth;
  playerState.currentHunger = maxHunger;

  playerState.loadedFromApi = { username: apiData.username, avatarUrl: apiData.avatarUrl };
  
  showConfirmationModal({
    title: 'Success',
    text: `Build for user "<strong>${apiData.username}</strong>" (Level ${apiData.leveling.level}) loaded successfully!`,
    showCancel: false, confirmText: 'OK'
  });
  
  renderAllUI();
}

/**
 * Maneja la llamada a la API para cargar los datos de un jugador por ID, URL o nombre.
 */
async function handleLoadFromAPI() {
  const userInput = ui.playerNameApiInput.value.trim();
  if (!userInput) {
    showConfirmationModal({ title: 'Input Required', text: 'Please enter a Player ID, Profile URL, or Username.', showCancel: false, confirmText: 'OK' });
    return;
  }
  
  const originalButtonText = ui.loadFromApiBtn.textContent;
  ui.loadFromApiBtn.disabled = true;
  ui.loadFromApiBtn.textContent = 'Searching...';

  try {
    let playerId = getPlayerIdFromInput(userInput);

    if (!playerId) {
      ui.loadFromApiBtn.textContent = 'Finding User...';
      playerId = await searchPlayerIdByUsername(userInput);
      if (!playerId) throw new Error(`No player found with the name "${userInput}".`);
    }
    
    ui.loadFromApiBtn.textContent = 'Fetching Data...';
    const apiObject = { "userId": playerId };
    const encodedInput = encodeURIComponent(JSON.stringify(apiObject));
    const apiUrl = `https://api2.warera.io/trpc/user.getUserLite?input=${encodedInput}`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error(`API returned an error: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    if (!data.result || !data.result.data) throw new Error('API response format is invalid or data is missing.');
    
    await mapApiDataToPlayerState(data.result.data);

  } catch (error) {
    console.error("Failed to fetch player data:", error);
    let errorMessage = `${error.message}`;
    if (error instanceof TypeError) {
        errorMessage += '<br><br>This might be a network or CORS issue.';
    }
    showConfirmationModal({ title: 'API Error', text: errorMessage, showCancel: false, confirmText: 'Close' });
  } finally {
    ui.loadFromApiBtn.disabled = false;
    ui.loadFromApiBtn.textContent = originalButtonText;
  }
}

async function initialize() {
  const loadingOverlay = document.getElementById('loading-overlay');
  const mainContainer = document.querySelector('.container');

  try {
    const data = await fetchJsonData('public/data/skills.json');
    if (!data) throw new Error("Skill data file is empty or invalid.");

    setSkillsData(data);
    const maxHealth = getSkillData('health', playerState.skillLevelsAssigned.health)?.value || 50;
    const maxHunger = getSkillData('hunger', playerState.skillLevelsAssigned.hunger)?.value || 10;
    playerState.currentHealth = maxHealth;
    playerState.currentHunger = maxHunger;
    playerState.skillPointsAvailable = (playerState.playerLevel * SKILL_POINTS_PER_LEVEL) - playerState.skillPointsSpent;

    cacheDOMElements();

    // Register all event listeners
    document.querySelector('.skills-section').addEventListener('click', (event) => {
      const button = event.target.closest('.skill-btn');
      if (button && !button.disabled) {
        applyButtonTransform(button);
        handleSkillButtonClick(button);
      }
    });
    ui.fullRestoreBtn.addEventListener('click', handleFullRestore);
    ui.equipmentSlotsContainer.addEventListener('contextmenu', handleUnequipItem);
    ui.levelMinusBtn.addEventListener('click', (event) => { applyButtonTransform(event.target); handleLevelButtonClick(event); });
    ui.levelPlusBtn.addEventListener('click', (event) => { applyButtonTransform(event.target); handleLevelButtonClick(event); });
    ui.resetBtn.addEventListener('click', handleResetGame);
    ui.exportBtn.addEventListener('click', handleExportBuild);
    ui.inventoryGrid.addEventListener('click', handleInventoryItemClick);
    document.querySelectorAll('.character-stats .stat-item').forEach(statItem => {
      statItem.addEventListener('mouseenter', handleStatMouseEnter);
      statItem.addEventListener('mouseleave', handleStatMouseLeave);
    });
    ui.equipItemButton.addEventListener('click', handleEquipItem);
    ui.buffSelection.addEventListener('click', handleBuffButtonClick);
    ui.simulateBtn.addEventListener('click', handleDamageSimulation);
    ui.simulateFullBtn.addEventListener('click', handleFullCombatModalOpening);
    const skillsSection = document.querySelector('.skills-section');
    skillsSection.addEventListener('mouseover', (event) => {
        if (event.target.classList.contains('progress-block')) handleProgressBlockMouseEnter(event);
    });
    skillsSection.addEventListener('mouseout', (event) => {
        if (event.target.classList.contains('progress-block')) handleProgressBlockMouseLeave(event);
    });
    ui.modal.cancelBtn.addEventListener('click', hideFoodSelectionModal);
    ui.modal.overlay.addEventListener('click', (event) => { if (event.target === ui.modal.overlay) hideFoodSelectionModal(); });
    ui.modal.foodOptions.addEventListener('click', (event) => {
        const itemElement = event.target.closest('.modal-food-item');
        if (!itemElement) return;
        const currentSelected = ui.modal.foodOptions.querySelector('.selected');
        if (currentSelected) currentSelected.classList.remove('selected');
        itemElement.classList.add('selected');
        ui.modal.startBtn.disabled = false;
    });
    ui.modal.startBtn.addEventListener('click', startFullCombatWithFood);
    ui.savePresetBtn.addEventListener('click', handleSavePreset);
    ui.presetsListContainer.addEventListener('click', (event) => {
      const button = event.target.closest('.preset-btn');
      if (!button) return;
      const presetName = button.dataset.presetName;
      if (button.classList.contains('load-btn')) handleLoadPreset(presetName);
      else if (button.classList.contains('delete-btn')) handleDeletePreset(presetName);
    });
    renderPresetsList();
    ui.loadFromApiBtn.addEventListener('click', handleLoadFromAPI);

    renderAllUI();

    loadingOverlay.classList.add('hidden');
    mainContainer.classList.remove('hidden');

  } catch (error) {
    console.error("Fatal error during initialization:", error);
    const loadingText = loadingOverlay.querySelector('p');
    const spinner = loadingOverlay.querySelector('.loading-spinner');
    if (spinner) spinner.style.display = 'none';
    if (loadingText) loadingText.innerHTML = `<strong>Error:</strong> Could not load application data.<br>Please try refreshing the page.`;
  }
}

document.addEventListener('DOMContentLoaded', initialize);