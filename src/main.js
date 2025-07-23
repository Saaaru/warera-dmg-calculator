// --- START OF FILE src/main.js (CORRECTED) ---

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
import { getSkillData, simulateCombatTick, calculateCumulativeSkillCost, simulateFullCombat } from './calculator.js';
// CLEANUP: Reorganized UI imports for clarity
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
  handleProgressBlockMouseLeave
} from './ui.js';

/**
* Fetches JSON data from a given path.
* @param {string} path - The path to the JSON file.
* @returns {Promise<object>} - A promise that resolves with the JSON data.
*/
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

  // Dispatch based on item properties
  if (itemData.isConsumable && itemData.flatStats && itemData.flatStats.healthRegen) {
    handleConsumeFood(itemData);
  } else { // Assume it's equippable
    playerState.selectedItemForConfig = { ...itemData, code: itemCode };
    showItemInConfigPanel(itemData);
  }
}

function handleConsumeFood(foodData) {
    if (playerState.currentHunger < 1) {
        console.log("Not enough hunger to eat.");
        // Optional: show visual feedback to user
        return;
    }

    const maxHealth = getSkillData('health', playerState.assignedSkillLevels.health)?.value || 50;
    const healthRestored = foodData.flatStats.healthRegen || 0;
    
    playerState.currentHunger -= 1;
    playerState.currentHealth = Math.min(maxHealth, playerState.currentHealth + healthRestored);
    
    console.log(`Consumed ${foodData.name || foodData.code}, restored ${healthRestored} health.`);
    renderAllUI(); // Re-render to update resource bars and stats
}

function handleResetGame() {
  resetPlayerState(); // Resets skills, level, etc.
  
  // Re-initialize dynamic stats based on the reset state
  const maxHealth = getSkillData('health', playerState.assignedSkillLevels.health)?.value || 50;
  const maxHunger = getSkillData('hunger', playerState.assignedSkillLevels.hunger)?.value || 10;
  playerState.currentHealth = maxHealth;
  playerState.currentHunger = maxHunger;

  // Clear historical log
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
          setTimeout(() => {
              statSpan.classList.remove('stat-updated');
          }, 700);
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

  const buffCode = button.dataset.buffCode;
  const buffData = skillsData.skills[buffCode];
  if (!buffData) return;

  const buffType = buffData.usage === 'ammo' ? 'ammo' : 'consumable';
  const buffObject = {
      code: buffCode,
      name: formatCodeToName(buffCode),
      stats: buffData.flatStats
  };

  if (playerState.activeBuffs[buffType]?.code === buffCode) {
      playerState.activeBuffs[buffType] = null;
  } else {
      playerState.activeBuffs[buffType] = buffObject;
  }

  renderAllUI();
}

function handleDamageSimulation() {
  if (playerState.currentHealth <= 0) {
      console.log("Cannot simulate, character has no health.");
      return;
  }
  const simulationResult = simulateCombatTick();
  
  // Update state
  playerState.currentHealth = Math.max(0, playerState.currentHealth - simulationResult.healthLost);

  // Update UI
  renderSimulationLog(simulationResult);
  applyButtonTransform(ui.simulateBtn);
  renderAllUI(); // Re-render all to update bars correctly
}

function handleFullCombatSimulation() {
  if (playerState.currentHealth <= 0) {
      console.log("Cannot simulate, character has no health.");
      return;
  }
  const fullResult = simulateFullCombat();
  
  // Update state
  playerState.currentHealth = fullResult.finalHealth;

  // Update UI
  const summary = `<p><strong>Survived ${fullResult.ticksSurvived} hits, dealing ${fullResult.totalDamageDealt} total damage.</strong></p>`;
  renderSimulationLog(fullResult, summary);
  applyButtonTransform(ui.simulateFullBtn);
  renderAllUI(); // Re-render all to update bars correctly
}

function formatCodeToName(code) {
  if (!code) return '';
  return code
      .replace(/([A-Z])/g, ' $1')
      .replace(/(\d+)/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase());
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

  // Event Listeners
  document.querySelector('.skills-section').addEventListener('click', (event) => {
    const button = event.target.closest('.skill-btn');
    if (button && !button.disabled) {
      applyButtonTransform(button);
      handleSkillButtonClick(button);
    }
  });

  ui.equipmentSlotsContainer.addEventListener('contextmenu', handleUnequipItem);

  ui.levelMinusBtn.addEventListener('click', (event) => {
    applyButtonTransform(event.target);
    handleLevelButtonClick(event);
  });
  ui.levelPlusBtn.addEventListener('click', (event) => {
    applyButtonTransform(event.target);
    handleLevelButtonClick(event);
  });

  ui.resetBtn.addEventListener('click', handleResetGame);
  ui.inventoryGrid.addEventListener('click', handleInventoryItemClick);

  document.querySelectorAll('.character-stats .stat-item').forEach(statItem => {
    statItem.addEventListener('mouseenter', handleStatMouseEnter);
    statItem.addEventListener('mouseleave', handleStatMouseLeave);
  });

  ui.equipItemBtn.addEventListener('click', handleEquipItem);
  ui.buffSelection.addEventListener('click', handleBuffButtonClick);
  ui.simulateBtn.addEventListener('click', handleDamageSimulation);
  ui.simulateFullBtn.addEventListener('click', handleFullCombatSimulation);
  const skillsSection = document.querySelector('.skills-section');
  skillsSection.addEventListener('mouseover', (event) => {
      if (event.target.classList.contains('progress-block')) {
          handleProgressBlockMouseEnter(event);
      }
  });
  skillsSection.addEventListener('mouseout', (event) => {
      if (event.target.classList.contains('progress-block')) {
          handleProgressBlockMouseLeave(event);
      }
  });

  renderAllUI();
}

document.addEventListener('DOMContentLoaded', initialize);