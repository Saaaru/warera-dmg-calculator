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
  formatSkillValue
} from './ui.js';

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
    // Si los datos están corruptos, los eliminamos para evitar errores futuros.
    localStorage.removeItem(PRESETS_STORAGE_KEY);
    return [];
  }
}

function renderPresetsList() {
  const presets = getPresetsFromStorage();
  ui.presetsListContainer.innerHTML = ''; // Limpiar contenedor

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
function handleSavePreset() {
  // === INICIO: LÓGICA MODIFICADA PARA EL NOMBRE DEL PRESET ===

  // 1. Obtener la entrada del usuario.
  const userInput = ui.presetNameInput.value.trim();

  // 2. Generar siempre el resumen de habilidades.
  const keySkillsForNaming = [
    { code: 'attack', emoji: '🗡️' },
    { code: 'precision', emoji: '🎯' },
    { code: 'criticalChance', emoji: '💥' },
    { code: 'criticalDamages', emoji: '🔥' },
    { code: 'armor', emoji: '🛡️' },
    { code: 'dodge', emoji: '🌀' }
  ];
  
  const skillSummary = keySkillsForNaming.map(skill => {
    const level = playerState.skillLevelsAssigned[skill.code];
    return `${skill.emoji} ${level}`;
  }).join(' | ');

  // 3. Combinar la entrada del usuario y el resumen para crear el nombre final.
  let finalPresetName;
  if (userInput) {
    // Si el usuario escribió algo, lo usamos como prefijo.
    finalPresetName = `${userInput} || ${skillSummary}`;
  } else {
    // Si el campo está vacío, usamos solo el resumen como nombre.
    finalPresetName = skillSummary;
  }
  
  // === FIN: LÓGICA MODIFICADA ===

  const presets = getPresetsFromStorage();
  // Usamos el nombre final para buscar duplicados.
  const existingPresetIndex = presets.findIndex(p => p.name === finalPresetName);

  if (existingPresetIndex > -1) {
    if (!confirm(`A preset named "${finalPresetName}" already exists. Do you want to overwrite it?`)) {
      return;
    }
  }

  const stateSnapshot = {
    playerLevel: playerState.playerLevel,
    skillLevelsAssigned: JSON.parse(JSON.stringify(playerState.skillLevelsAssigned)),
    equippedItems: JSON.parse(JSON.stringify(playerState.equippedItems)),
    activeBuffs: JSON.parse(JSON.stringify(playerState.activeBuffs)),
  };

  const newPreset = {
    name: finalPresetName, // Guardar el nombre final combinado.
    timestamp: new Date().toISOString(),
    stateSnapshot,
  };

  if (existingPresetIndex > -1) {
    presets[existingPresetIndex] = newPreset;
  } else {
    presets.push(newPreset);
  }

  savePresetsToStorage(presets);
  ui.presetNameInput.value = ''; // Limpiar input
  renderPresetsList();
}

/**
 * Carga un preset seleccionado, sobreescribiendo el estado actual.
 * @param {string} presetName El nombre del preset a cargar.
 */
function handleLoadPreset(presetName) {
  if (!confirm('Are you sure you want to load this preset? Your current build will be overwritten.')) {
    return;
  }

  const presets = getPresetsFromStorage();
  const preset = presets.find(p => p.name === presetName);

  if (!preset) {
    alert(`Error: Preset "${presetName}" not found.`);
    return;
  }

  const { stateSnapshot } = preset;

  // Restaurar el estado desde el snapshot
  playerState.playerLevel = stateSnapshot.playerLevel;
  playerState.skillLevelsAssigned = JSON.parse(JSON.stringify(stateSnapshot.skillLevelsAssigned));
  playerState.equippedItems = JSON.parse(JSON.stringify(stateSnapshot.equippedItems));
  playerState.activeBuffs = JSON.parse(JSON.stringify(stateSnapshot.activeBuffs));

  // Crítico: Recalcular los puntos de habilidad en lugar de simplemente cargarlos.
  const totalPointsForLevel = playerState.playerLevel * SKILL_POINTS_PER_LEVEL;
  let spentPoints = 0;
  for (const skillCode in playerState.skillLevelsAssigned) {
    const level = playerState.skillLevelsAssigned[skillCode];
    spentPoints += calculateCumulativeSkillCost(skillCode, level);
  }
  playerState.skillPointsSpent = spentPoints;
  playerState.skillPointsAvailable = totalPointsForLevel - spentPoints;
  
  // Restaurar salud y hambre a sus valores máximos según la nueva build
  const maxHealth = getSkillData('health', playerState.skillLevelsAssigned.health)?.value || 50;
  const maxHunger = getSkillData('hunger', playerState.skillLevelsAssigned.hunger)?.value || 10;
  playerState.currentHealth = maxHealth;
  playerState.currentHunger = maxHunger;


  renderAllUI();
  // Animar el botón de carga para feedback visual
  const loadButton = ui.presetsListContainer.querySelector(`.load-btn[data-preset-name="${presetName}"]`);
  if (loadButton) applyButtonTransform(loadButton);

  alert(`Preset "${presetName}" loaded successfully.`);
}

/**
 * Elimina un preset guardado.
 * @param {string} presetName El nombre del preset a eliminar.
 */
function handleDeletePreset(presetName) {
  if (!confirm(`Are you sure you want to delete the preset "${presetName}"? This action cannot be undone.`)) {
    return;
  }

  let presets = getPresetsFromStorage();
  presets = presets.filter(p => p.name !== presetName);
  savePresetsToStorage(presets);

  renderPresetsList();
}

/**
 * Guarda el array de presets en localStorage.
 * @param {Array} presets El array de presets a guardar.
 */
function savePresetsToStorage(presets) {
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
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
  console.log(`Consumed ${foodData.name || foodData.code}, restored ${healthRestored} health.`);
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
  if (ui.simulationLog) ui.simulationLog.innerHTML = 'Simulation results will appear here.';
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
      stats: configuredStats
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
  if (!button || button.disabled) return;
  const buffCode = button.dataset.buffCode;
  const buffData = skillsData.skills[buffCode];
  if (!buffData) return;
  const buffType = buffData.usage === 'ammo' ? 'ammo' : 'consumable';
  const buffObject = {
      code: buffCode,
      name: formatCodeToName(buffCode),
      stats: buffData.flatStats,
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
    scale: 2 // === CAMBIO REALIZADO: Aumentar la escala para mejor calidad de imagen
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = `player-build-lvl-${playerState.playerLevel}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    // === CAMBIO REALIZADO: Corregido el texto del botón ===
    exportButton.textContent = '📤 Export Build'; 
    exportButton.disabled = false;
  }).catch(err => {
    console.error('Failed to export build:', err);
    alert('An error occurred while generating the image.');
    // === CAMBIO REALIZADO: Corregido el texto del botón también en caso de error ===
    exportButton.textContent = '📤 Export Build';
    exportButton.disabled = false;
  });
}

function populateExportCard(summary) {
  document.getElementById('export-level-badge').textContent = `LVL ${playerState.playerLevel}`;
  document.getElementById('export-simulation-summary').textContent = summary;
  const skillsList = document.getElementById('export-skills-list');
  skillsList.innerHTML = '';
  const skillIcons = { attack: ' 5e1  e0f', precision: ' 3af', criticalChance: ' 4a5', criticalDamages: ' 525', armor: ' 6e1  e0f', dodge: ' 300', health: ' 764  e0f', hunger: ' 357' };
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
          const imgSrc = `public/images/items/${item.code}.png`;
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

async function initialize() {
  const data = await fetchJsonData('public/data/skills.json');
  if (!data) {
    console.error("Failed to load skill data. Application cannot start.");
    return;
  }
  setSkillsData(data);
  const maxHealth = getSkillData('health', playerState.skillLevelsAssigned.health)?.value || 50;
  const maxHunger = getSkillData('hunger', playerState.skillLevelsAssigned.hunger)?.value || 10;
  playerState.currentHealth = maxHealth;
  playerState.currentHunger = maxHunger;
  cacheDOMElements();
  playerState.skillPointsAvailable = (playerState.playerLevel * SKILL_POINTS_PER_LEVEL) - playerState.skillPointsSpent;
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
  ui.modal.overlay.addEventListener('click', (event) => {
      if (event.target === ui.modal.overlay) hideFoodSelectionModal();
  });
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
    if (button.classList.contains('load-btn')) {
      handleLoadPreset(presetName);
    } else if (button.classList.contains('delete-btn')) {
      handleDeletePreset(presetName);
    }
  });
  renderPresetsList();
  renderAllUI();
}

document.addEventListener('DOMContentLoaded', initialize);