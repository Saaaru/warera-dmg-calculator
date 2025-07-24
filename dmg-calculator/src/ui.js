// UI: Renders and manages the user interface, updates visual elements, and controls the visual interaction of the simulator.

import { playerState, skillsData, MIN_SKILL_LEVEL, MIN_PLAYER_LEVEL, MAX_PLAYER_LEVEL, SKILL_POINTS_PER_LEVEL } from './state.js';
import { getSkillData, calculateStatDetails, calculateCumulativeSkillCost } from './calculator.js';

export const ui = {};

function setButtonEnabled(button, enable) {
    if (!button) return;
    button.disabled = !enable;
    button.classList.toggle('btn-disabled', !enable);
}

export function formatSkillValue(skillCode, value) {
    const percentageSkills = ['precision', 'criticalChance', 'criticalDamages', 'armor', 'dodge', 'lootChance'];
    return percentageSkills.includes(skillCode) ? `${value}%` : value.toString();
}

export function applyButtonTransform(button) {
    if (!button.classList.contains('btn-disabled')) {
        button.style.transform = 'scale(0.9)';
        setTimeout(() => { button.style.transform = 'scale(1)'; }, 100);
    }
}

function formatCodeToName(code) {
    if (!code) return '';
    return code.replace(/([A-Z])/g, ' $1').replace(/(\d+)/g, ' $1').replace(/^./, str => str.toUpperCase());
}

function renderSkill(skillCode) {
  const skillElements = ui.skillSections[skillCode];
  if (!skillElements) return;
  const currentLevel = playerState.skillLevelsAssigned[skillCode];
  const skillInfo = getSkillData(skillCode, currentLevel);
  if (!skillInfo) return;
  skillElements.value.textContent = formatSkillValue(skillCode, skillInfo.value);
  const progressBlocks = skillElements.progressBar.children;
  const progressBarColorClasses = { default: 'active', criticalChance: 'active-red', hunger: 'active-red', armor: 'active-blue', dodge: 'active-blue', health: 'active-green', lootChance: 'active-green' };
  const activeClass = progressBarColorClasses[skillCode] || progressBarColorClasses.default;
  for (let i = 0; i < progressBlocks.length; i++) {
    const shouldBeActive = i < currentLevel;
    progressBlocks[i].classList.remove('active', 'active-red', 'active-blue', 'active-green');
    if (shouldBeActive) progressBlocks[i].classList.add(activeClass);
  }
  setButtonEnabled(skillElements.minusBtn, currentLevel > MIN_SKILL_LEVEL);
  const nextSkillInfo = getSkillData(skillCode, currentLevel + 1);
  const canUpgrade = nextSkillInfo && playerState.skillPointsAvailable >= nextSkillInfo.cost && playerState.playerLevel >= nextSkillInfo.unlockAtLevel;
  setButtonEnabled(skillElements.plusBtn, canUpgrade);
  if (ui.characterStats[skillCode] && skillCode !== 'health' && skillCode !== 'hunger') {
      const { total } = calculateStatDetails(skillCode);
      ui.characterStats[skillCode].textContent = formatSkillValue(skillCode, total);
  }
}

function renderPlayerStatus() {
  const totalPoints = playerState.playerLevel * SKILL_POINTS_PER_LEVEL;
  ui.playerLevelDisplay.textContent = playerState.playerLevel;
  ui.characterLevelBadge.textContent = playerState.playerLevel;
  ui.skillPointsAvailable.textContent = playerState.skillPointsAvailable;
  ui.skillPointsTotal.textContent = totalPoints;
  setButtonEnabled(ui.levelMinusBtn, playerState.playerLevel > MIN_PLAYER_LEVEL);
  setButtonEnabled(ui.levelPlusBtn, playerState.playerLevel < MAX_PLAYER_LEVEL);
}

function renderResourceBars() {
    const maxHealth = getSkillData('health', playerState.skillLevelsAssigned.health)?.value || 50;
    const healthPercentage = (playerState.currentHealth / maxHealth) * 100;
    if (ui.healthBarFill) ui.healthBarFill.style.width = `${Math.max(0, healthPercentage)}%`;
    if (ui.healthBarDisplay) ui.healthBarDisplay.textContent = `${playerState.currentHealth.toFixed(1)} / ${maxHealth}`;
    const maxHunger = getSkillData('hunger', playerState.skillLevelsAssigned.hunger)?.value || 10;
    const hungerPercentage = (playerState.currentHunger / maxHunger) * 100;
    if (ui.hungerBarFill) ui.hungerBarFill.style.width = `${Math.max(0, hungerPercentage)}%`;
    if (ui.hungerBarDisplay) ui.hungerBarDisplay.textContent = `${playerState.currentHunger} / ${maxHunger}`;
}

function renderEquippedItems() {
    if (!ui.equipmentSlots) return;
    for (const slot in ui.equipmentSlots) {
        const slotElement = ui.equipmentSlots[slot];
        const equippedItem = playerState.equippedItems[slot];
        if (equippedItem) {
            let imgCode = equippedItem.code;
            if (imgCode.startsWith('pants')) imgCode = 'pants1';
            else if (imgCode.startsWith('helmet')) imgCode = 'helmet1';
            else if (imgCode.startsWith('gloves')) imgCode = 'gloves1';
            else if (imgCode.startsWith('chest')) imgCode = 'chest1';
            else if (imgCode.startsWith('boots')) imgCode = 'boots1';
            const imgSrc = `public/images/items/${imgCode}.png`;
            slotElement.innerHTML = `<img src="${imgSrc}" alt="${equippedItem.name}">`;
        } else {
            slotElement.innerHTML = '+';
        }
    }
}

function renderActiveBuffs() {
    const weaponEquipped = !!playerState.equippedItems.weapon;
    ui.buffButtons.forEach(button => {
        const buffCode = button.dataset.buffCode;
        const buffData = skillsData.skills[buffCode];
        if (!buffData) return;
        if (buffData.usage === 'ammo') {
            setButtonEnabled(button, weaponEquipped);
            if (!weaponEquipped) {
                button.title = 'You must equip a weapon to use ammo.';
            } else {
                button.title = buffData.title || `Buff: ${formatCodeToName(buffCode)}`;
            }
        }
        const buffType = buffData.usage === 'ammo' ? 'ammo' : 'consumable';
        const isActive = playerState.activeBuffs[buffType]?.code === buffCode;
        button.classList.toggle('active-buff', isActive);
    });
}

export function renderAllUI() {
    renderPlayerStatus();
    renderResourceBars();
    renderActiveBuffs();
    renderEquippedItems();
    for (const skillCode in playerState.skillLevelsAssigned) {
      renderSkill(skillCode);
    }
}

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
    const description = SKILL_DESCRIPTIONS[skillCode] || '';
    const stats = calculateStatDetails(skillCode);
    let tooltipContent = `<h4>${skillName}</h4><p class="description">${description}</p>`;
    tooltipContent += `<div class="detail-line"><span>Skill Upgrade:</span><span>${formatSkillValue(skillCode, stats.skillValue)}</span></div>`;
    if (stats.equipmentItems.length > 0) {
        const itemNames = stats.equipmentItems.map(item => item.name).join(', ');
        tooltipContent += `<div class="detail-line"><span>Equipment:</span><span>+${formatSkillValue(skillCode, stats.equipmentValue)} (${itemNames})</span></div>`;
    }
    if (skillCode === 'attack') {
        if (stats.ammoPercent > 0) {
            const ammoName = playerState.activeBuffs.ammo?.name || 'Ammo';
            tooltipContent += `<div class="detail-line"><span>Ammo:</span><span>+${stats.ammoPercent}% (${ammoName})</span></div>`;
        }
        if (stats.buffPercent > 0) {
            const buffName = playerState.activeBuffs.consumable?.name || 'Buff';
            tooltipContent += `<div class="detail-line"><span>Buff:</span><span>+${stats.buffPercent}% (${buffName})</span></div>`;
        }
    }
    tooltipContent += `<div class="total-line"><span>Total:</span><span>${formatSkillValue(skillCode, stats.total)}</span></div>`;
    ui.statTooltip.innerHTML = tooltipContent;
    ui.statTooltip.style.opacity = 1;
    const rect = statItem.getBoundingClientRect();
    ui.statTooltip.style.left = `${rect.left + window.scrollX + rect.width + 10}px`;
    ui.statTooltip.style.top = `${rect.top + window.scrollY}px`;
}

export function handleStatMouseLeave() { ui.statTooltip.style.opacity = 0; }

export function showItemConfigPanel(itemData) {
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
        tierClasses.forEach(tc => { if (itemElementInGrid.classList.contains(tc)) ui.configItemIconContainer.classList.add(tc); });
    }
    ui.itemStatsConfig.innerHTML = '';
    if (!itemData.dynamicStats || Object.keys(itemData.dynamicStats).length === 0) {
        ui.itemStatsConfig.textContent = 'This item has no configurable stats.';
        setButtonEnabled(ui.equipItemButton, true);
    } else {
        for (const [statCode, range] of Object.entries(itemData.dynamicStats)) {
            const [min, max] = range;
            const valueDisplayId = `config-value-${statCode}`;
            const controlRow = document.createElement('div');
            controlRow.className = 'stat-config-row';
            controlRow.innerHTML = `<label>${formatCodeToName(statCode)}</label><input type="range" data-stat="${statCode}" min="${min}" max="${max}" value="${min}" step="1"><span class="stat-value" id="${valueDisplayId}">${formatSkillValue(statCode, min)}</span>`;
            ui.itemStatsConfig.appendChild(controlRow);
            controlRow.querySelector('input').addEventListener('input', e => { document.getElementById(valueDisplayId).textContent = formatSkillValue(statCode, e.target.value); });
        }
        setButtonEnabled(ui.equipItemButton, true);
    }
    ui.itemConfigPanel.classList.remove('hidden');
}

export function hideItemConfigPanel() {
    if (!ui.itemConfigPanel) return;
    ui.itemConfigPanel.classList.add('hidden');
    ui.itemStatsConfig.innerHTML = '<p>Select an item from the inventory to configure it.</p>';
    playerState.selectedConfigItem = null;
}

export function renderSimulationLog(result, summaryOverride = null) {
    if (!ui.simulationLog) return;
    while (ui.simulationLog.children.length > 50) {
        ui.simulationLog.lastChild.remove();
    }
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    const summary = document.createElement('div');
    summary.className = 'log-summary';
    if (summaryOverride) {
        summary.innerHTML = summaryOverride;
    } else {
        const damageClass = result.wasCritical ? 'log-critical' : 'log-normal';
        summary.innerHTML = `
          <p><strong>Damage Dealt:</strong> <span class="${damageClass}">${result.finalDamageDealt}</span></p>
          <p><strong>Health Lost:</strong> <span class="log-health-lost">${result.healthLost}</span></p>
        `;
    }
    const details = document.createElement('ul');
    details.className = 'log-details';
    result.log.forEach(entry => {
        const li = document.createElement('li');
        li.innerHTML = entry;
        details.appendChild(li);
    });
    logEntry.appendChild(summary);
    logEntry.appendChild(details);
    ui.simulationLog.prepend(logEntry);
}

export function showFoodSelectionModal() {
    if (!skillsData || !ui.modal.overlay) return;
    const foodContainer = ui.modal.foodOptions;
    foodContainer.innerHTML = '';
    let hasFood = false;
    Object.entries(skillsData.skills).forEach(([code, itemData]) => {
        if (itemData.isConsumable && itemData.flatStats.healthRegen) {
            hasFood = true;
            const itemElement = document.createElement('div');
            itemElement.className = 'modal-food-item';
            itemElement.dataset.code = code;
            const img = document.querySelector(`.inventory-item[data-code="${code}"] img`);
            const imgSrc = img ? img.src : '';
            itemElement.innerHTML = `
                <img src="${imgSrc}" alt="${itemData.name}">
                <span>${formatCodeToName(code)}</span>
            `;
            foodContainer.appendChild(itemElement);
        }
    });
    if (!hasFood) {
      foodContainer.innerHTML = '<p>No consumable food items available.</p>';
    }
    ui.modal.overlay.classList.remove('hidden');
    ui.modal.startBtn.disabled = true;
}

export function hideFoodSelectionModal() {
    if (ui.modal.overlay) {
        ui.modal.overlay.classList.add('hidden');
        const selected = ui.modal.foodOptions.querySelector('.selected');
        if (selected) {
            selected.classList.remove('selected');
        }
    }
}

export function cacheDOMElements() {
    ui.healthBarFill = document.getElementById('health-bar-fill');
    ui.healthBarDisplay = document.getElementById('health-bar-display');
    ui.hungerBarFill = document.getElementById('hunger-bar-fill');
    ui.hungerBarDisplay = document.getElementById('hunger-bar-display');
    ui.simulateFullBtn = document.getElementById('simulate-full-btn');
    ui.playerLevelDisplay = document.getElementById('player-level-display');
    ui.characterLevelBadge = document.getElementById('char-level-badge');
    ui.levelMinusBtn = document.getElementById('level-minus-btn');
    ui.levelPlusBtn = document.getElementById('level-plus-btn');
    ui.skillPointsAvailable = document.getElementById('skill-points-available');
    ui.skillPointsTotal = document.getElementById('skill-points-total');
    ui.resetBtn = document.getElementById('reset-btn');
    ui.statTooltip = document.getElementById('stat-tooltip');
    ui.skillSections = {};
    document.querySelectorAll('.skill').forEach(el => { ui.skillSections[el.dataset.skill] = { value: el.querySelector('.skill-value'), progressBar: el.querySelector('.progress-bar'), minusBtn: el.querySelector('.btn-minus'), plusBtn: el.querySelector('.btn-plus') }; });
    ui.characterStats = {};
    document.querySelectorAll('.character-stats .stat-item[data-stat-code]').forEach(el => { ui.characterStats[el.dataset.statCode] = el.querySelector('span'); });
    ui.characterStats.hunger = document.getElementById('char-stat-hunger');
    ui.equipmentSlots = {};
    document.querySelectorAll('.equipment-slot[data-slot]').forEach(el => { ui.equipmentSlots[el.dataset.slot] = el; });
    ui.equipmentSlotsContainer = document.querySelector('.equipment-slots');
    ui.buffSelection = document.querySelector('.buff-selection');
    ui.buffButtons = document.querySelectorAll('.buff-btn');
    ui.itemConfigPanel = document.getElementById('item-config-panel');
    ui.configItemName = document.getElementById('config-item-name');
    ui.configItemIcon = document.getElementById('config-item-icon');
    ui.configItemIconContainer = document.getElementById('config-item-icon-container');
    ui.itemStatsConfig = document.getElementById('item-stats-config');
    ui.equipItemButton = document.getElementById('equip-item-btn');
    ui.inventoryGrid = document.querySelector('.inventory-grid');
    ui.simulateBtn = document.getElementById('simulate-btn');
    ui.exportBtn = document.getElementById('export-btn');
    ui.fullRestoreBtn = document.getElementById('full-restore-btn');
    ui.simulationLog = document.getElementById('simulation-log');
    ui.modal = {
        overlay: document.getElementById('food-selection-modal'),
        foodOptions: document.getElementById('modal-food-options'),
        startBtn: document.getElementById('start-simulation-with-food-btn'),
        cancelBtn: document.getElementById('cancel-simulation-btn')
      };
    ui.modal = {
        overlay: document.getElementById('food-selection-modal'),
        foodOptions: document.getElementById('modal-food-options'),
        startBtn: document.getElementById('start-simulation-with-food-btn'),
        cancelBtn: document.getElementById('cancel-simulation-btn')
      };
    ui.presetsSection = document.getElementById('presets-section');
    ui.presetNameInput = document.getElementById('preset-name-input');
    ui.savePresetBtn = document.getElementById('save-preset-btn');
    ui.presetsListContainer = document.getElementById('presets-list-container');
}

function getProgressBlockInfo(target) {
    const block = target.closest('.progress-block');
    if (!block) return null;
    const skillContainer = target.closest('.skill');
    const skillCode = skillContainer?.dataset.skill;
    if (!skillCode) return null;
    const blocks = Array.from(block.parentNode.children);
    const index = blocks.indexOf(block);
    const level = index + 1;
    return { block, skillCode, level };
}

export function handleProgressBlockMouseEnter(event) {
    const info = getProgressBlockInfo(event.target);
    if (!info) return;
    const { block, skillCode, level } = info;
    const skillDataForLevel = getSkillData(skillCode, level);
    if (!skillDataForLevel) return;
    const totalCost = calculateCumulativeSkillCost(skillCode, level);
    const skillName = formatCodeToName(skillCode);
    const tooltipContent = `
        <h4>Level ${level} - ${skillName}</h4>
        <div class="detail-line">
            <span class="detail-label">Base Value:</span>
            <span class="detail-value">${formatSkillValue(skillCode, skillDataForLevel.value)}</span>
        </div>
        <div class="detail-line">
            <span class="detail-label">Cost for this level:</span>
            <span class="detail-value">${skillDataForLevel.cost} SP</span>
        </div>
        <div class="detail-line">
            <span class="detail-label">Total cost to reach:</span>
            <span class="detail-value">${totalCost} SP</span>
        </div>
    `;
    ui.statTooltip.innerHTML = tooltipContent;
    ui.statTooltip.style.opacity = 1;
    const rect = block.getBoundingClientRect();
    ui.statTooltip.style.left = `${rect.left + window.scrollX + rect.width / 2 - ui.statTooltip.offsetWidth / 2}px`;
    ui.statTooltip.style.top = `${rect.top + window.scrollY - ui.statTooltip.offsetHeight - 10}px`;
}

export function handleProgressBlockMouseLeave() {
    ui.statTooltip.style.opacity = 0;
}