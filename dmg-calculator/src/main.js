// --- START OF FILE src/main.js (CORRECTED & CLEANED) ---

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
  showItemInConfigPanel,
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

// --- Event Handlers ---

function handleSkillButtonClick(button) {
  const skillCode = button.dataset.skill;
  const action = button.dataset.action;
  let currentLevel = playerState.assignedSkillLevels[skillCode];

  const maxHealthBefore = getSkillData('health', playerState.assignedSkillLevels.health)?.value || 50;
  const maxHungerBefore = getSkillData('hunger', playerState.assignedSkillLevels.hunger)?.value || 10;
  const wasHealthMax = playerState.currentHealth >= maxHealthBefore;
  const wasHungerMax = playerState.currentHunger >= maxHungerBefore;

  if (action === 'plus') {
    const nextLevel = Math.min(currentLevel + 1, MAX_SKILL_LEVEL);
    const nextSkillInfo = getSkillData(skillCode, nextLevel);
    
    if (nextSkillInfo && playerState.skillPointsAvailable >= nextSkillInfo.cost && playerState.playerLevel >= nextSkillInfo.unlockAtLevel) {
      playerState.assignedSkillLevels[skillCode] = nextLevel;
      playerState.skillPointsAvailable -= nextSkillInfo.cost;
      playerState.skillPointsSpent += nextSkillInfo.cost;
    }
  } else if (action === 'minus') {
    if (currentLevel > MIN_SKILL_LEVEL) {
        const refundedCost = getSkillData(skillCode, currentLevel)?.cost || 0;
        playerState.assignedSkillLevels[skillCode] = currentLevel - 1;
        playerState.skillPointsAvailable += refundedCost;
        playerState.skillPointsSpent -= refundedCost;
    }
  }

  if (action === 'plus') {
    if (skillCode === 'health' && wasHealthMax) {
        const maxHealthAfter = getSkillData('health', playerState.assignedSkillLevels.health)?.value || 50;
        playerState.currentHealth = maxHealthAfter;
    }
    if (skillCode === 'hunger' && wasHungerMax) {
        const maxHungerAfter = getSkillData('hunger', playerState.assignedSkillLevels.hunger)?.value || 10;
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
      console.warn("Player level decreased, resetting skills as spent points exceed new total.");
      for (const skillCode in playerState.assignedSkillLevels) {
        playerState.assignedSkillLevels[skillCode] = 0;
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
    playerState.selectedItemForConfig = { ...itemData, code: itemCode };
    showItemInConfigPanel(itemData);
  }
}

function handleConsumeFood(foodData) {
  if (playerState.currentHunger < 1) {
    console.log("Not enough hunger to eat.");
    return;
  }
  const maxHealth = getSkillData('health', playerState.assignedSkillLevels.health)?.value || 50;
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
  const itemToConfigure = playerState.selectedItemForConfig;
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
      if(ui.charStats[statCode]) {
          const statSpan = ui.charStats[statCode].parentNode.querySelector('span:last-child');
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
  if (!button || button.disabled) return; // No hacer nada si el botón está deshabilitado

  const buffCode = button.dataset.buffCode;
  const buffData = skillsData.skills[buffCode];
  if (!buffData) return;

  const buffType = buffData.usage === 'ammo' ? 'ammo' : 'consumable';
  const buffObject = {
      code: buffCode,
      name: formatCodeToName(buffCode),
      stats: buffData.flatStats,
  };

  // CORRECCIÓN: Lógica de sincronización de Munición
  if (buffType === 'ammo') {
    // Si la munición seleccionada ya está activa, la desactivamos de ambos sitios.
    if (playerState.activeBuffs.ammo?.code === buffCode) {
      playerState.activeBuffs.ammo = null;
      playerState.equippedItems.ammo = null;
    } else {
      // Si no, la activamos en ambos sitios.
      playerState.activeBuffs.ammo = buffObject;
      playerState.equippedItems.ammo = buffObject; // Sincronizamos con el slot de equipamiento
    }
  } else { // Lógica para otros buffs (consumables)
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

// CORRECCIÓN: Esta función ahora tiene UNA SOLA responsabilidad: abrir el modal.
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
  
  // CORRECCIÓN: Actualizar el estado del jugador con el resultado final.
  playerState.currentHealth = fullResult.finalHealth;
  playerState.currentHunger = fullResult.finalHunger;

  const summary = `Survived ${fullResult.ticksSurvived} hits using ${formatCodeToName(itemCode)}, dealing ${fullResult.totalDamageDealt} total damage.`;
  playerState.lastSimulationSummary = summary;
  renderSimulationLog(fullResult, summary);
  hideFoodSelectionModal();
  
  // renderAllUI ya actualiza las barras con los nuevos valores del estado.
  renderAllUI(); 
}

function handleExportBuild() {
  const exportButton = ui.exportBtn;
  if (!window.html2canvas) {
    console.error('html2canvas library is not loaded.');
    alert('Error: Export library not found.');
    return;
  }

  // Poblar la tarjeta con los datos actuales
  populateExportCard(playerState.lastSimulationSummary);

  exportButton.textContent = 'Generating...';
  exportButton.disabled = true;

  const cardElement = document.getElementById('build-export-card');

  html2canvas(cardElement, { 
    backgroundColor: '#0d1117', // Fondo para evitar transparencias
    useCORS: true // Para cargar imágenes externas si las hubiera
  }).then(canvas => {
    // Crear un enlace temporal para la descarga
    const link = document.createElement('a');
    link.download = `player-build-lvl-${playerState.playerLevel}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    // Limpiar
    exportButton.textContent = '📤 Export Build';
    exportButton.disabled = false;
  }).catch(err => {
    console.error('Failed to export build:', err);
    alert('An error occurred while generating the image.');
    exportButton.textContent = '📤 Export Build';
    exportButton.disabled = false;
  });
}

// NUEVA FUNCIÓN PARA POBLAR LA TARJETA
function populateExportCard(summary) {
  // --- INFO GENERAL ---
  document.getElementById('export-level-badge').textContent = `LVL ${playerState.playerLevel}`;
  document.getElementById('export-simulation-summary').textContent = summary;

  // --- 1. POBLAR SKILLS ---
  const skillsList = document.getElementById('export-skills-list');
  skillsList.innerHTML = '';
  const skillIcons = { attack: '🗡️', precision: '🎯', criticalChance: '💥', criticalDamages: '🔥', armor: '🛡️', dodge: '🌀', health: '❤️', hunger: '🍗' };
  
  // Iterar sobre los iconos para mantener el orden y filtrar `lootChance`
  Object.keys(skillIcons).forEach(code => {
      const level = playerState.assignedSkillLevels[code];
      const li = document.createElement('li');
      li.className = 'export-skills-list-item';
      li.innerHTML = `
          <span class="icon">${skillIcons[code]}</span>
          <span class="name">${formatCodeToName(code)}</span>
          <span class="points">${level} / ${MAX_SKILL_LEVEL}</span>
      `;
      skillsList.appendChild(li);
  });

  // --- 2. POBLAR STATS CON DESGLOSE ---
  const statsContainer = document.getElementById('export-stats-list');
  statsContainer.innerHTML = '';
  const statsToDisplay = ['attack', 'precision', 'criticalChance', 'criticalDamages', 'armor', 'dodge'];

  statsToDisplay.forEach(code => {
      const details = calculateStatDetails(code);
      
      const statItemDiv = document.createElement('div');
      statItemDiv.className = 'export-stat-item';

      let breakdownHtml = '<ul class="export-stat-breakdown">';
      
      // Base de la Skill
      breakdownHtml += `<li><span class="source">Base Skill:</span> <span class="value">${formatSkillValue(code, details.skillValue)}</span></li>`;

      // Equipo
      if (details.equipmentValue > 0) {
          const itemNames = details.equipmentItems.map(item => item.name).join(', ');
          breakdownHtml += `<li><span class="source">Equipment (${itemNames}):</span> <span class="value">+${formatSkillValue(code, details.equipmentValue)}</span></li>`;
      }

      // Buffs específicos de Ataque
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

  // --- 3. POBLAR EQUIPO (sin cambios en esta sección) ---
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

async function initialize() {
  const data = await fetchJsonData('public/data/skills.json');
  if (!data) {
    console.error("Failed to load skill data. Application cannot start.");
    return;
  }
  setSkillsData(data);
  
  const maxHealth = getSkillData('health', playerState.assignedSkillLevels.health)?.value || 50;
  const maxHunger = getSkillData('hunger', playerState.assignedSkillLevels.hunger)?.value || 10;
  playerState.currentHealth = maxHealth;
  playerState.currentHunger = maxHunger;

  cacheDOMElements();
  playerState.skillPointsAvailable = (playerState.playerLevel * SKILL_POINTS_PER_LEVEL) - playerState.skillPointsSpent;

  // --- Event Listeners ---
  document.querySelector('.skills-section').addEventListener('click', (event) => {
    const button = event.target.closest('.skill-btn');
    if (button && !button.disabled) {
      applyButtonTransform(button);
      handleSkillButtonClick(button);
    }
  });

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
  ui.equipItemBtn.addEventListener('click', handleEquipItem);
  ui.buffSelection.addEventListener('click', handleBuffButtonClick);
  ui.simulateBtn.addEventListener('click', handleDamageSimulation);

  // CORRECCIÓN: Se asocia el botón a la función correcta y se elimina el listener duplicado.
  ui.simulateFullBtn.addEventListener('click', handleFullCombatModalOpening);

  const skillsSection = document.querySelector('.skills-section');
  skillsSection.addEventListener('mouseover', (event) => {
      if (event.target.classList.contains('progress-block')) handleProgressBlockMouseEnter(event);
  });
  skillsSection.addEventListener('mouseout', (event) => {
      if (event.target.classList.contains('progress-block')) handleProgressBlockMouseLeave(event);
  });

  // MODAL LISTENERS
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
  
  renderAllUI();
}

document.addEventListener('DOMContentLoaded', initialize);