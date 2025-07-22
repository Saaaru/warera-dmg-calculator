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
import { getSkillData } from './calculator.js';
import { 
  ui, 
  cacheDOMElements, 
  renderAllUI, 
  showItemInConfigPanel,
  handleStatMouseEnter,
  handleStatMouseLeave,
  applyButtonTransform
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

/**
* Handles clicks on skill adjustment buttons (+/-).
* @param {HTMLElement} button - The button that was clicked.
*/
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

/**
* Handles clicks on player level adjustment buttons (+/-).
* @param {Event} event - The click event.
*/
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

/**
* Handles clicks on inventory items.
* @param {Event} event - The click event.
*/
function handleInventoryItemClick(event) {
  const itemElement = event.target.closest('.inventory-item');
  if (!itemElement) return;

  const itemCode = itemElement.dataset.code;
  if (!itemCode || !skillsData.skills[itemCode]) {
      console.warn(`Item with code "${itemCode}" not found in skills data.`);
      return;
  }
  
  const itemData = skillsData.skills[itemCode];
  
  playerState.selectedItemForConfig = {
      ...itemData,
      code: itemCode
  };

  showItemInConfigPanel(itemData);
}

/**
* Resets the game state to its initial values.
*/
function handleResetGame() {
  resetPlayerState();
  renderAllUI();
  applyButtonTransform(ui.resetBtn);
}

// --- Main Initialization Function ---
async function initialize() {
const data = await fetchJsonData('public/data/skills.json');
if (!data) {
  console.error("Failed to load skill data. Application cannot start.");
  return;
}
setSkillsData(data);

cacheDOMElements();

playerState.skillPointsAvailable = (playerState.playerLevel * SKILL_POINTS_PER_LEVEL) - playerState.skillPointsSpent;

// --- Register Event Listeners ---

// Skill buttons (event delegation)
document.querySelector('.skills-section').addEventListener('click', (event) => {
  const button = event.target.closest('.skill-btn');
  if (button && !button.disabled) {
    applyButtonTransform(button);
    handleSkillButtonClick(button);
  }
});

// Player level buttons
ui.levelMinusBtn.addEventListener('click', (event) => {
  applyButtonTransform(event.target);
  handleLevelButtonClick(event);
});
ui.levelPlusBtn.addEventListener('click', (event) => {
  applyButtonTransform(event.target);
  handleLevelButtonClick(event);
});

// Reset button
ui.resetBtn.addEventListener('click', handleResetGame);

// Inventory grid (event delegation)
ui.inventoryGrid.addEventListener('click', handleInventoryItemClick);

// Tooltip listeners
document.querySelectorAll('.character-stats .stat-item').forEach(statItem => {
  statItem.addEventListener('mouseenter', handleStatMouseEnter);
  statItem.addEventListener('mouseleave', handleStatMouseLeave);
});

// Inventory item click effect
document.querySelectorAll('.inventory-item').forEach(item => {
  item.addEventListener('click', function() {
    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
      this.style.transform = 'scale(1)';
    }, 150);
  });
});

// Initial UI render
renderAllUI();
}

// Start the application
document.addEventListener('DOMContentLoaded', initialize);