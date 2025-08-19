// --- START OF FILE ui.js ---

// UI: Renders and manages the user interface, updates visual elements, and controls the visual interaction of the simulator.

import { playerState, skillsData, MIN_SKILL_LEVEL, MIN_PLAYER_LEVEL, MAX_PLAYER_LEVEL, SKILL_POINTS_PER_LEVEL } from './state.js';
import { getSkillData, calculateStatDetails, calculateCumulativeSkillCost } from './calculator.js';

export const ui = {};

const TIER_CLASSES = ['tier-gray', 'tier-green', 'tier-blue', 'tier-purple', 'tier-orange'];

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

  if (playerState.loadedFromApi) {
    ui.apiLoadSection.innerHTML = `<h3>Build from <strong>${playerState.loadedFromApi.username}</strong></h3>`;
    ui.apiLoadSection.style.textAlign = 'center';
    
    const avatarImg = document.querySelector('.avatar');
    if (avatarImg && playerState.loadedFromApi.avatarUrl) {
      avatarImg.src = playerState.loadedFromApi.avatarUrl;
    }
  }
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

        // 1. Limpiar siempre el contenido y las clases de tier primero.
        slotElement.innerHTML = ''; 
        slotElement.classList.remove(...TIER_CLASSES);

        if (equippedItem) {
            // 2. Aplicar la clase de tier al slot ANTES de añadir contenido.
            if (equippedItem.tier) {
                slotElement.classList.add(`tier-${equippedItem.tier}`);
            }

            // 3. Crear y añadir la imagen como un nodo hijo, en lugar de usar innerHTML.
            // Esto preserva las clases del slotElement.
            let imgCode = equippedItem.code;
            // Simplificación de la imagen para armaduras
            if (['pants', 'helmet', 'gloves', 'chest', 'boots'].some(type => imgCode.startsWith(type))) {
                imgCode = `${imgCode.match(/^[a-z]+/)[0]}1`;
            }
            
            const img = document.createElement('img');
            img.src = `public/images/items/${imgCode}.png`;
            img.alt = equippedItem.name;
            slotElement.appendChild(img);
            
        } else {
            // 4. Si no hay item, simplemente establece el texto.
            slotElement.textContent = '+';
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
            button.classList.toggle('btn-inactive', !weaponEquipped);

            button.title = weaponEquipped 
                ? (buffData.title || `Buff: ${formatCodeToName(buffCode)}`) 
                : 'You must equip a weapon to use ammo.';
        }
        const buffType = buffData.usage === 'ammo' ? 'ammo' : 'consumable';
        const isActive = playerState.activeBuffs[buffType]?.code === buffCode;
        button.classList.toggle('active-buff', isActive);
    });
}

function renderSimulationSummaries() {
    if (ui.cumulativeDamageDisplay) {
        ui.cumulativeDamageDisplay.textContent = playerState.cumulativeDamage.toFixed(1);
    }
    
    // NOTE: Ensure all these new IDs are cached in the 'ui' object in cacheDOMElements()
    const displays = ui.fullSimDisplays; 

    if (playerState.lastFullSimulationResult) {
        const { damageStats, ticksStats, endReasonStats } = playerState.lastFullSimulationResult;
        
        // Main KPIs
        displays.avgDamageDisplay.textContent = damageStats.mean;
        displays.minDamageDisplay.textContent = damageStats.min;
        displays.maxDamageDisplay.textContent = damageStats.max;

        displays.avgHitsDisplay.textContent = ticksStats.mean.toFixed(1);
        displays.minHitsDisplay.textContent = ticksStats.min;
        displays.maxHitsDisplay.textContent = ticksStats.max;

        // Secondary / Efficiency KPIs
        const avgDph = ticksStats.mean > 0 ? (damageStats.mean / ticksStats.mean).toFixed(1) : '0';
        displays.dphDisplay.textContent = avgDph;
        
        displays.consistencyDisplay.textContent = `±${damageStats.stdDev}`;
        
        // Determine the primary limiting factor
        let primaryFactor = "Health";
        if (endReasonStats.byWeapon > endReasonStats.byHealth) {
            primaryFactor = "Weapon Durability";
        }
        if (endReasonStats.byMaxTicks > 50) { // If over half the runs hit the limit
            primaryFactor = "Simulation Limit";
        }
        displays.endReasonDisplay.textContent = `${primaryFactor} (${Math.max(endReasonStats.byHealth, endReasonStats.byWeapon).toFixed(0)}%)`;

    } else {
        // Reset all displays if no data
        Object.values(displays).forEach(el => {
            if (el) el.textContent = '-';
        });
    }
}

export function renderAllUI() {
    renderPlayerStatus();
    renderResourceBars();
    renderActiveBuffs();
    renderEquippedItems();
    renderSimulationSummaries();
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
        TIER_CLASSES.forEach(tc => { if (itemElementInGrid.classList.contains(tc)) ui.configItemIconContainer.classList.add(tc); });
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

// Removed renderSimulationLog function - no longer needed

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
            itemElement.innerHTML = `<img src="${imgSrc}" alt="${itemData.name}"><span>${formatCodeToName(code)}</span>`;
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

// Añadimos una variable a nivel de módulo para el temporizador
let feedbackTimeoutId = null;

/**
 * Muestra un tooltip de feedback sobre un elemento específico.
 * @param {HTMLElement} targetElement - El elemento sobre el cual se mostrará el tooltip.
 * @param {string} message - El mensaje a mostrar.
 */
export function showActionFeedbackTooltip(targetElement, message) {
  if (!ui.actionFeedbackTooltip) return;

  const tooltip = ui.actionFeedbackTooltip;
  tooltip.textContent = message;

  // Limpiar cualquier timeout anterior para resetear la animación si se hace click rápido
  clearTimeout(feedbackTimeoutId);
  tooltip.classList.remove('visible');

  // Calcular la posición
  const targetRect = targetElement.getBoundingClientRect();
  tooltip.style.left = `${targetRect.left + targetRect.width / 2 - tooltip.offsetWidth / 2}px`;
  tooltip.style.top = `${targetRect.top - tooltip.offsetHeight - 10}px`; // 10px de espacio

  // Forzar un reflow para que la animación se reinicie
  void tooltip.offsetWidth; 

  // Mostrar el tooltip
  tooltip.classList.add('visible');

  // Ocultarlo después de 2.5 segundos
  feedbackTimeoutId = setTimeout(() => {
    tooltip.classList.remove('visible');
  }, 2500);
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
    // Removed simulationLog reference - no longer needed
    ui.cumulativeDamageDisplay = document.getElementById('cumulative-damage-display');
    // New Monte Carlo simulation display elements
    ui.fullSimDisplays = {
        avgDamageDisplay: document.getElementById('full-sim-avg-damage-display'),
        minDamageDisplay: document.getElementById('full-sim-min-damage-display'),
        maxDamageDisplay: document.getElementById('full-sim-max-damage-display'),
        avgHitsDisplay: document.getElementById('full-sim-avg-hits-display'),
        minHitsDisplay: document.getElementById('full-sim-min-hits-display'),
        maxHitsDisplay: document.getElementById('full-sim-max-hits-display'),
        dphDisplay: document.getElementById('full-sim-dph-display'),
        consistencyDisplay: document.getElementById('full-sim-consistency-display'),
        endReasonDisplay: document.getElementById('full-sim-end-reason-display')
    };
    
    // Legacy elements (for backward compatibility)
    ui.fullSimDamageDisplay = document.getElementById('full-sim-damage-display');
    ui.fullSimTicksDisplay = document.getElementById('full-sim-ticks-display');
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
    ui.playerNameApiInput = document.getElementById('player-name-api-input');
    ui.loadFromApiBtn = document.getElementById('load-from-api-btn');
    ui.apiLoadSection = document.getElementById('api-load-section');
    ui.genericModal = {
        overlay: document.getElementById('generic-modal'),
        title: document.getElementById('generic-modal-title'),
        text: document.getElementById('generic-modal-text'),
        confirmBtn: document.getElementById('generic-modal-confirm-btn'),
        cancelBtn: document.getElementById('generic-modal-cancel-btn'),
        actions: document.getElementById('generic-modal-actions'),
    };
    ui.actionFeedbackTooltip = document.getElementById('action-feedback-tooltip');
    
    // === ADVANCED SIMULATION SECTION ===
    ui.advancedSimulationSection = document.getElementById('advanced-simulation-section');
    ui.simulationRunsSelect = document.getElementById('simulation-runs');
    ui.foodSelectionAdvanced = document.getElementById('food-selection-advanced');
    
    // Build comparison elements
    ui.buildAInfo = document.getElementById('build-a-info');
    ui.buildBInfo = document.getElementById('build-b-info');
    ui.loadBuildABtn = document.getElementById('load-build-a-btn');
    ui.loadBuildBBtn = document.getElementById('load-build-b-btn');
    ui.compareBuildsBtn = document.getElementById('compare-builds-btn');
    
    // Comparison results elements
    ui.comparisonResults = document.getElementById('comparison-results');
    ui.buildAAvgDamage = document.getElementById('build-a-avg-damage');
    ui.buildAAvgHits = document.getElementById('build-a-avg-hits');
    ui.buildADph = document.getElementById('build-a-dph');
    ui.buildAConsistency = document.getElementById('build-a-consistency');
    ui.buildBAvgDamage = document.getElementById('build-b-avg-damage');
    ui.buildBAvgHits = document.getElementById('build-b-avg-hits');
    ui.buildBDph = document.getElementById('build-b-dph');
    ui.buildBConsistency = document.getElementById('build-b-consistency');
    ui.comparisonChart = document.getElementById('comparison-chart');
    
    // Single build analysis elements
    ui.analyzeCurrentBuildBtn = document.getElementById('analyze-current-build-btn');
    ui.singleAnalysisResults = document.getElementById('single-analysis-results');
    ui.singleAvgDamage = document.getElementById('single-avg-damage');
    ui.singleAvgHits = document.getElementById('single-avg-hits');
    ui.singleDph = document.getElementById('single-dph');
    ui.singleConsistency = document.getElementById('single-consistency');
    ui.singlePrimaryFactor = document.getElementById('single-primary-factor');
    ui.singleHealthLoss = document.getElementById('single-health-loss');
    ui.singleWeaponBreak = document.getElementById('single-weapon-break');
    ui.distributionChart = document.getElementById('distribution-chart');
}

export function renderApiLoader() {
    if (!ui.apiLoadSection) return;
    
    ui.apiLoadSection.style.textAlign = 'left';
    ui.apiLoadSection.innerHTML = `
        <h4>Load from Game</h4>
        <div class="api-load-form">
            <input type="text" id="player-name-api-input" placeholder="Enter Player ID, URL, or Name">
            <button id="load-from-api-btn" class="action-btn">🔗 Fetch Data</button>
        </div>
    `;

    ui.playerNameApiInput = document.getElementById('player-name-api-input');
    ui.loadFromApiBtn = document.getElementById('load-from-api-btn');
}

export function showConfirmationModal({ title, text, confirmText = 'Confirm', showCancel = true }) {
  return new Promise((resolve, reject) => {
    ui.genericModal.title.textContent = title;
    ui.genericModal.text.innerHTML = text;
    ui.genericModal.confirmBtn.textContent = confirmText;

    ui.genericModal.cancelBtn.style.display = showCancel ? 'inline-block' : 'none';
    ui.genericModal.actions.style.justifyContent = showCancel ? 'flex-end' : 'center';
    
    ui.genericModal.overlay.classList.remove('hidden');

    const handleConfirm = () => { cleanup(); resolve(); };
    const handleCancel = () => { cleanup(); reject(new Error('User cancelled action')); };
    
    const cleanup = () => {
      ui.genericModal.overlay.classList.add('hidden');
      ui.genericModal.confirmBtn.removeEventListener('click', handleConfirm);
      ui.genericModal.cancelBtn.removeEventListener('click', handleCancel);
      ui.genericModal.overlay.removeEventListener('click', overlayClickHandler);
    };

    const overlayClickHandler = (event) => { if (event.target === ui.genericModal.overlay) handleCancel(); };

    ui.genericModal.confirmBtn.addEventListener('click', handleConfirm);
    ui.genericModal.cancelBtn.addEventListener('click', handleCancel);
    ui.genericModal.overlay.addEventListener('click', overlayClickHandler);
  });
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
        <div class="detail-line"><span class="detail-label">Base Value:</span><span class="detail-value">${formatSkillValue(skillCode, skillDataForLevel.value)}</span></div>
        <div class="detail-line"><span class="detail-label">Cost for this level:</span><span class="detail-value">${skillDataForLevel.cost} SP</span></div>
        <div class="detail-line"><span class="detail-label">Total cost to reach:</span><span class="detail-value">${totalCost} SP</span></div>
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

// === ADVANCED SIMULATION FUNCTIONS ===

/**
 * Updates the build info display for comparison slots
 */
export function updateBuildInfo(buildSlot, buildData, isCurrentBuild = false) {
    const buildInfo = buildSlot === 'A' ? ui.buildAInfo : ui.buildBInfo;
    const buildName = buildInfo.querySelector('.build-name');
    const buildLevel = buildInfo.querySelector('.build-level');
    
    if (isCurrentBuild) {
        buildName.textContent = 'Current Build';
        buildLevel.textContent = `Level ${playerState.playerLevel}`;
    } else if (buildData) {
        buildName.textContent = buildData.name || 'Loaded Build';
        buildLevel.textContent = `Level ${buildData.stateSnapshot?.playerLevel || '?'}`;
    } else {
        buildName.textContent = 'No build loaded';
        buildLevel.textContent = '-';
    }
}

/**
 * Shows comparison results with charts
 */
export function showComparisonResults(buildAResults, buildBResults) {
    // Update Build A results
    ui.buildAAvgDamage.textContent = buildAResults.damageStats.mean.toFixed(1);
    ui.buildAAvgHits.textContent = buildAResults.ticksStats.mean.toFixed(1);
    ui.buildADph.textContent = (buildAResults.damageStats.mean / buildAResults.ticksStats.mean).toFixed(1);
    ui.buildAConsistency.textContent = `${((1 - buildAResults.damageStats.stdDev / buildAResults.damageStats.mean) * 100).toFixed(1)}%`;
    
    // Update Build B results
    ui.buildBAvgDamage.textContent = buildBResults.damageStats.mean.toFixed(1);
    ui.buildBAvgHits.textContent = buildBResults.ticksStats.mean.toFixed(1);
    ui.buildBDph.textContent = (buildBResults.damageStats.mean / buildBResults.ticksStats.mean).toFixed(1);
    ui.buildBConsistency.textContent = `${((1 - buildBResults.damageStats.stdDev / buildBResults.damageStats.mean) * 100).toFixed(1)}%`;
    
    // Show results section
    ui.comparisonResults.classList.remove('hidden');
    
    // Create comparison chart
    createComparisonChart(buildAResults, buildBResults);
}

/**
 * Shows single build analysis results
 */
export function showSingleAnalysisResults(results) {
    // Update metrics
    ui.singleAvgDamage.textContent = results.damageStats.mean.toFixed(1);
    ui.singleAvgHits.textContent = results.ticksStats.mean.toFixed(1);
    ui.singleDph.textContent = (results.damageStats.mean / results.ticksStats.mean).toFixed(1);
    ui.singleConsistency.textContent = `${((1 - results.damageStats.stdDev / results.damageStats.mean) * 100).toFixed(1)}%`;
    
    // Update limiting factors
    const primaryFactor = Object.entries(results.endReasonStats).reduce((a, b) => a[1] > b[1] ? a : b);
    ui.singlePrimaryFactor.textContent = primaryFactor[0].replace('by', '').replace(/([A-Z])/g, ' $1').trim();
    ui.singleHealthLoss.textContent = `${results.endReasonStats.byHealth.toFixed(1)}%`;
    ui.singleWeaponBreak.textContent = `${results.endReasonStats.byWeapon.toFixed(1)}%`;
    
    // Show results section
    ui.singleAnalysisResults.classList.remove('hidden');
    
    // Create distribution chart
    createDistributionChart(results);
}

/**
 * Creates a comparison chart between two builds
 */
function createComparisonChart(buildAResults, buildBResults) {
    const ctx = ui.comparisonChart.getContext('2d');
    
    // Clear previous chart
    if (window.comparisonChart) {
        window.comparisonChart.destroy();
    }
    
    // Calculate values for each metric
    const buildADamage = buildAResults.damageStats.mean;
    const buildBDamage = buildBResults.damageStats.mean;
    const buildAHits = buildAResults.ticksStats.mean;
    const buildBHits = buildBResults.ticksStats.mean;
    const buildADamagePerHit = buildAResults.damageStats.mean / buildAResults.ticksStats.mean;
    const buildBDamagePerHit = buildBResults.damageStats.mean / buildBResults.ticksStats.mean;
    const buildAConsistency = (1 - buildAResults.damageStats.stdDev / buildAResults.damageStats.mean) * 100;
    const buildBConsistency = (1 - buildBResults.damageStats.stdDev / buildBResults.damageStats.mean) * 100;
    
    // Create separate datasets for each metric to use different Y axes
    const data = {
        labels: ['Average Damage', 'Average Hits', 'Damage per Hit', 'Consistency'],
        datasets: [
            // Damage dataset (uses y axis)
            {
                label: 'Build A - Damage',
                data: [buildADamage, null, null, null],
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                yAxisID: 'y',
                order: 1
            },
            {
                label: 'Build B - Damage',
                data: [buildBDamage, null, null, null],
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                yAxisID: 'y',
                order: 1
            },
            // Hits dataset (uses y1 axis)
            {
                label: 'Build A - Hits',
                data: [null, buildAHits, null, null],
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                yAxisID: 'y1',
                order: 2
            },
            {
                label: 'Build B - Hits',
                data: [null, buildBHits, null, null],
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                yAxisID: 'y1',
                order: 2
            },
            // Damage per Hit dataset (uses y2 axis)
            {
                label: 'Build A - Dmg/Hit',
                data: [null, null, buildADamagePerHit, null],
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                yAxisID: 'y2',
                order: 3
            },
            {
                label: 'Build B - Dmg/Hit',
                data: [null, null, buildBDamagePerHit, null],
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                yAxisID: 'y2',
                order: 3
            },
            // Consistency dataset (uses y3 axis)
            {
                label: 'Build A - Consistency',
                data: [null, null, null, buildAConsistency],
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                yAxisID: 'y3',
                order: 4
            },
            {
                label: 'Build B - Consistency',
                data: [null, null, null, buildBConsistency],
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
                yAxisID: 'y3',
                order: 4
            }
        ]
    };

    // Chart configuration with multiple Y axes
    const config = {
        type: 'bar',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#ffffff',
                        font: {
                            size: 12,
                            weight: 'bold'
                        },
                        usePointStyle: true,
                        pointStyle: 'circle',
                        filter: function(legendItem, data) {
                            // Only show one legend item per metric type
                            const label = legendItem.text;
                            if (label.includes('Build A')) {
                                return !data.datasets.some(ds => 
                                    ds.label.includes('Build B') && 
                                    ds.label.includes(label.split(' - ')[1])
                                );
                            }
                            return false;
                        },
                        generateLabels: function(chart) {
                            const labels = [];
                            const metrics = ['Damage', 'Hits', 'Dmg/Hit', 'Consistency'];
                            const colors = ['rgba(59, 130, 246, 1)', 'rgba(239, 68, 68, 1)'];
                            
                            metrics.forEach((metric, index) => {
                                labels.push({
                                    text: `Build A - ${metric}`,
                                    fillStyle: colors[0],
                                    strokeStyle: colors[0],
                                    lineWidth: 0,
                                    pointStyle: 'circle',
                                    hidden: false,
                                    index: index * 2
                                });
                                labels.push({
                                    text: `Build B - ${metric}`,
                                    fillStyle: colors[1],
                                    strokeStyle: colors[1],
                                    lineWidth: 0,
                                    pointStyle: 'circle',
                                    hidden: false,
                                    index: index * 2 + 1
                                });
                            });
                            return labels;
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            const metric = context.label;
                            
                            if (metric === 'Consistency') {
                                return `${label}: ${value.toFixed(1)}%`;
                            } else if (metric === 'Damage per Hit') {
                                return `${label}: ${value.toFixed(1)} dmg/hit`;
                            } else if (metric === 'Average Hits') {
                                return `${label}: ${value.toFixed(1)} hits`;
                            } else {
                                return `${label}: ${value.toFixed(1)} damage`;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Damage',
                        color: '#ffffff',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 10
                        },
                        callback: function(value) {
                            return value.toFixed(0) + ' dmg';
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Hits',
                        color: '#ffffff',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 10
                        },
                        callback: function(value) {
                            return value.toFixed(1) + ' hits';
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                y2: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Dmg/Hit',
                        color: '#ffffff',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 10
                        },
                        callback: function(value) {
                            return value.toFixed(1) + ' dmg/hit';
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                y3: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Consistency %',
                        color: '#ffffff',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 10
                        },
                        callback: function(value) {
                            return value.toFixed(0) + '%';
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    };

    // Create the chart
    window.comparisonChart = new Chart(ctx, config);
}

/**
 * Creates a distribution chart for single build analysis
 */
function createDistributionChart(results) {
    const ctx = ui.distributionChart.getContext('2d');
    
    // Clear previous chart
    if (window.distributionChart) {
        window.distributionChart.destroy();
    }
    
    // Generate distribution data points
    const min = results.damageStats.min;
    const max = results.damageStats.max;
    const mean = results.damageStats.mean;
    const stdDev = results.damageStats.stdDev;
    
    // Create data points for the bell curve
    const dataPoints = [];
    const step = (max - min) / 50;
    
    for (let i = 0; i <= 50; i++) {
        const x = min + i * step;
        const y = Math.exp(-Math.pow((x - mean) / stdDev, 2) / 2) / (stdDev * Math.sqrt(2 * Math.PI));
        dataPoints.push({ x: x, y: y });
    }
    
    // Normalize y values for better visualization
    const maxY = Math.max(...dataPoints.map(p => p.y));
    const normalizedData = dataPoints.map(p => ({ x: p.x, y: (p.y / maxY) * 100 }));
    
    const data = {
        datasets: [{
            label: 'Damage Distribution',
            data: normalizedData,
            borderColor: 'rgba(59, 130, 246, 1)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: 'rgba(59, 130, 246, 1)',
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 2
        }]
    };

    const config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    cornerRadius: 8,
                    callbacks: {
                        title: function(context) {
                            return `Damage: ${context[0].parsed.x.toFixed(1)}`;
                        },
                        label: function(context) {
                            return `Frequency: ${context.parsed.y.toFixed(1)}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Damage',
                        color: '#ffffff',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Frequency (%)',
                        color: '#ffffff',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        color: '#ffffff',
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    };

    // Create the chart
    window.distributionChart = new Chart(ctx, config);
    
    // Add mean line annotation
    const meanLine = {
        type: 'line',
        mode: 'vertical',
        scaleID: 'x',
        value: mean,
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 2,
        borderDash: [5, 5],
        label: {
            content: `Mean: ${mean.toFixed(1)}`,
            enabled: true,
            position: 'top',
            color: '#ffffff',
            font: {
                size: 12,
                weight: 'bold'
            }
        }
    };
    
    window.distributionChart.options.plugins.annotation = {
        annotations: {
            meanLine: meanLine
        }
    };
    
    window.distributionChart.update();
}