import { playerState, MIN_SKILL_LEVEL, MIN_PLAYER_LEVEL, MAX_PLAYER_LEVEL, SKILL_POINTS_PER_LEVEL } from './state.js';
import { getSkillData, calculateStatDetails } from './calculator.js';

// --- Global UI elements cache ---
export const ui = {};

// --- Helper Functions ---

function setButtonEnabled(button, enable) {
    if (!button) return;
    button.disabled = !enable;
    button.classList.toggle('btn-disabled', !enable);
}

export function formatSkillValue(skillCode, value) {
  const percentageSkills = ['precision', 'criticalChance', 'criticalDamages', 'armor', 'dodge', 'lootChance'];
  if (percentageSkills.includes(skillCode)) {
    return `${value}%`;
  }
  return value.toString();
}

export function applyButtonTransform(button) {
    if (!button.classList.contains('btn-disabled')) {
        button.style.transform = 'scale(0.9)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 100);
    }
}

function formatCodeToName(code) {
    if (!code) return '';
    return code
        .replace(/([A-Z])/g, ' $1')
        .replace(/(\d+)/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase());
}

// --- Render Functions ---

function renderSkill(skillCode) {
  const skillElements = ui.skillSections[skillCode];
  if (!skillElements) return;

  const currentLevel = playerState.assignedSkillLevels[skillCode];
  const skillInfo = getSkillData(skillCode, currentLevel);
  if (!skillInfo) return;

  skillElements.value.textContent = formatSkillValue(skillCode, skillInfo.value);

  const progressBlocks = skillElements.progressBar.children;
  const progressBarColorClasses = {
      default: 'active',
      criticalChance: 'active-red', hunger: 'active-red',
      armor: 'active-blue', dodge: 'active-blue',
      health: 'active-green', lootChance: 'active-green'
  };
  const activeClass = progressBarColorClasses[skillCode] || progressBarColorClasses.default;

  for (let i = 0; i < progressBlocks.length; i++) {
    const shouldBeActive = i < currentLevel;
    progressBlocks[i].classList.remove('active', 'active-red', 'active-blue', 'active-green');
    if (shouldBeActive) {
      progressBlocks[i].classList.add(activeClass);
    }
  }

  setButtonEnabled(skillElements.minusBtn, currentLevel > MIN_SKILL_LEVEL);

  const nextSkillInfo = getSkillData(skillCode, currentLevel + 1);
  const canUpgrade = nextSkillInfo && 
                     playerState.skillPointsAvailable >= nextSkillInfo.cost && 
                     playerState.playerLevel >= nextSkillInfo.unlockAtLevel;
  setButtonEnabled(skillElements.plusBtn, canUpgrade);

  if (ui.charStats[skillCode] && skillCode !== 'health' && skillCode !== 'hunger') {
      const { total } = calculateStatDetails(skillCode);
      ui.charStats[skillCode].textContent = formatSkillValue(skillCode, total);
  }
}

function renderPlayerStatus() {
  const totalPoints = playerState.playerLevel * SKILL_POINTS_PER_LEVEL;
  ui.playerLevelDisplay.textContent = playerState.playerLevel;
  ui.charLevelBadge.textContent = playerState.playerLevel;
  ui.skillPointsAvailable.textContent = playerState.skillPointsAvailable;
  ui.skillPointsTotal.textContent = totalPoints;
  setButtonEnabled(ui.levelMinusBtn, playerState.playerLevel > MIN_PLAYER_LEVEL);
  setButtonEnabled(ui.levelPlusBtn, playerState.playerLevel < MAX_PLAYER_LEVEL);
}

function renderResourceBars() {
  const healthSkillInfo = getSkillData('health', playerState.assignedSkillLevels.health);
  const hungerSkillInfo = getSkillData('hunger', playerState.assignedSkillLevels.hunger);
  if (healthSkillInfo) {
    ui.healthBarDisplay.textContent = `${healthSkillInfo.value}/${healthSkillInfo.value}`;
  }
  if (hungerSkillInfo) {
    ui.hungerBarDisplay.textContent = `${hungerSkillInfo.value}/${hungerSkillInfo.value}`;
    if (ui.charStats.hunger) {
        ui.charStats.hunger.textContent = hungerSkillInfo.value;
    }
  }
}

export function renderAllUI() {
  renderPlayerStatus();
  renderResourceBars();
  for (const skillCode in playerState.assignedSkillLevels) {
    renderSkill(skillCode);
  }
}

// --- Tooltip Logic ---
const SKILL_DESCRIPTIONS = {
    attack: "Base value for <em>Damages</em> calculation.",
    precision: "Chance to hit the target.",
    criticalChance: "Chance of landing a critical hit.",
    criticalDamages: "Increases the damage of critical hits.",
    armor: "Chance of reducing incoming damage.",
    dodge: "Chance to dodge incoming damage.",
    lootChance: "Chance to find extra loot after a battle."
};

export function handleStatMouseEnter(event) {
    const statItem = event.currentTarget;
    const skillCode = statItem.dataset.statCode;
    const skillName = formatCodeToName(skillCode);
    const description = SKILL_DESCRIPTIONS[skillCode];

    if (!skillCode || !description) return;
    
    const stats = calculateStatDetails(skillCode);
    let tooltipContent = `<h4>${skillName}</h4>`;
    tooltipContent += `<p class="description">${description}</p>`;
    tooltipContent += `<div class="detail-line"><span class="detail-label">Skill Upgrade:</span> <span class="detail-value">${formatSkillValue(skillCode, stats.skillValue)}</span></div>`;
    if (stats.equipmentItems.length > 0) {
        const itemNames = stats.equipmentItems.map(item => item.name).join(', ');
        tooltipContent += `<div class="detail-line"><span class="detail-label">Equipment:</span> <span class="detail-value">+${formatSkillValue(skillCode, stats.equipmentValue)} (${itemNames})</span></div>`;
    }
    if (skillCode === 'attack' && stats.ammoPercent > 0) {
        const ammoName = playerState.equippedItems.ammo?.name || 'Ammo';
        tooltipContent += `<div class="detail-line"><span class="detail-label">Ammo:</span> <span class="detail-value">+${stats.ammoPercent}% (${ammoName})</span></div>`;
    }
    tooltipContent += `<div class="total-line"><span class="detail-label">Total:</span> <span class="detail-value">${formatSkillValue(skillCode, stats.total)}</span></div>`;
    
    ui.statTooltip.innerHTML = tooltipContent;
    ui.statTooltip.style.opacity = 1;
    const rect = statItem.getBoundingClientRect();
    ui.statTooltip.style.left = `${rect.left + window.scrollX + rect.width + 10}px`;
    ui.statTooltip.style.top = `${rect.top + window.scrollY}px`;
}

export function handleStatMouseLeave() {
    ui.statTooltip.style.opacity = 0;
}

// --- Item Configuration Panel Logic ---
export function showItemInConfigPanel(itemData) {
    if (!ui.itemConfigPanel || !itemData) return;

    ui.configItemName.textContent = formatCodeToName(itemData.code);
    
    const itemElementInGrid = document.querySelector(`.inventory-item[data-code="${itemData.code}"]`);
    if (itemElementInGrid) {
        const originalImg = itemElementInGrid.querySelector('img');
        if (originalImg) {
            ui.configItemIcon.src = originalImg.src;
            ui.configItemIcon.alt = originalImg.alt;
        }

        ui.configItemIconContainer.className = 'inventory-item';
        const tierClasses = ['tier-gray', 'tier-green', 'tier-blue', 'tier-purple', 'tier-orange'];
        for (const tierClass of tierClasses) {
            if (itemElementInGrid.classList.contains(tierClass)) {
                ui.configItemIconContainer.classList.add(tierClass);
                break;
            }
        }
    }

    ui.itemStatsConfig.innerHTML = '';
    if (!itemData.dynamicStats || Object.keys(itemData.dynamicStats).length === 0) {
        ui.itemStatsConfig.textContent = 'This item has no configurable stats.';
        setButtonEnabled(ui.equipItemBtn, true);
    } else {
        for (const [statCode, range] of Object.entries(itemData.dynamicStats)) {
            const [min, max] = range;
            const statName = formatCodeToName(statCode);
            const valueDisplayId = `config-value-${statCode}`;
            const formattedValue = formatSkillValue(statCode, min);
            const controlRow = document.createElement('div');
            controlRow.className = 'stat-config-row';
            controlRow.innerHTML = `
                <label for="config-slider-${statCode}">${statName}</label>
                <input type="range" id="config-slider-${statCode}" data-stat="${statCode}" min="${min}" max="${max}" value="${min}" step="1">
                <span class="stat-value" id="${valueDisplayId}">${formattedValue}</span>
            `;
            ui.itemStatsConfig.appendChild(controlRow);
            const slider = controlRow.querySelector('input[type="range"]');
            slider.addEventListener('input', (event) => {
                document.getElementById(valueDisplayId).textContent = formatSkillValue(statCode, event.target.value);
            });
        }
        setButtonEnabled(ui.equipItemBtn, true);
    }
    ui.itemConfigPanel.classList.remove('hidden');
}

// --- DOM Element Caching ---
export function cacheDOMElements() {
    ui.playerLevelDisplay = document.getElementById('player-level-display');
    ui.charLevelBadge = document.getElementById('char-level-badge');
    ui.levelMinusBtn = document.getElementById('level-minus-btn');
    ui.levelPlusBtn = document.getElementById('level-plus-btn');
    ui.skillPointsAvailable = document.getElementById('skill-points-available');
    ui.skillPointsTotal = document.getElementById('skill-points-total');
    ui.healthBarDisplay = document.getElementById('health-bar-display');
    ui.hungerBarDisplay = document.getElementById('hunger-bar-display');
    ui.resetBtn = document.getElementById('reset-btn');
    ui.statTooltip = document.getElementById('stat-tooltip');
    
    ui.skillSections = {};
    document.querySelectorAll('.skill').forEach(skillDiv => {
        const skillCode = skillDiv.dataset.skill;
        if (skillCode) {
            ui.skillSections[skillCode] = {
                value: skillDiv.querySelector(`#value-${skillCode}`),
                progressBar: skillDiv.querySelector(`#progress-${skillCode}`),
                minusBtn: skillDiv.querySelector(`[data-skill="${skillCode}"][data-action="minus"]`),
                plusBtn: skillDiv.querySelector(`[data-skill="${skillCode}"][data-action="plus"]`),
            };
        }
    });

    ui.charStats = {};
    document.querySelectorAll('.character-stats .stat-item[data-stat-code]').forEach(statEl => {
        ui.charStats[statEl.dataset.statCode] = statEl.querySelector('span');
    });
    ui.charStats.hunger = document.getElementById('char-stat-hunger');

    ui.itemConfigPanel = document.getElementById('item-config-panel');
    ui.configItemName = document.getElementById('config-item-name');
    ui.configItemIcon = document.getElementById('config-item-icon');
    ui.configItemIconContainer = document.getElementById('config-item-icon-container');
    ui.itemStatsConfig = document.getElementById('item-stats-config');
    ui.equipItemBtn = document.getElementById('equip-item-btn');
    ui.inventoryGrid = document.querySelector('.inventory-grid');
}