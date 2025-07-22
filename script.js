// --- Global State and Data ---
const INITIAL_PLAYER_STATE = {
  playerLevel: 1, // Nivel inicial del jugador
  skillPointsAvailable: 0, // Se calculará al inicio
  skillPointsSpent: 0,
  assignedSkillLevels: {
    attack: 0,
    precision: 0,
    criticalChance: 0,
    criticalDamages: 0,
    armor: 0,
    dodge: 0,
    health: 0,
    lootChance: 0,
    hunger: 0,
  },
};

let playerState = { ...INITIAL_PLAYER_STATE }; // Usar spread para crear una copia mutable del estado inicial
let skillsData = null; // Para almacenar los datos de skills.json
let ui = {}; // Declarar 'ui' vacío, se llenará en init()

// --- Mock Data para Equipo y Buffs ---
const MOCK_EQUIPMENT = {
  weapon: { attack: 75, name: "Espada Maestra" }, // Ejemplo de arma
  ammo: { percentAttack: 20, name: "Munición Pesada" }, // Ejemplo de munición
  helmet: { criticalDamages: 5, name: "Casco de Acero" },
  chest: { armor: 8, name: "Pechera Reforzada" },
  pants: { armor: 3, name: "Pantalones de Cuero" },
  boots: { dodge: 4, name: "Botas Ligeras" },
  gloves: { precision: 5, name: "Guantes de Tirador" },
};

const MOCK_BUFFS = {
  attack: { percent: 80, name: "Furia del Berserker" }, // Buff de ataque
  // Otros buffs si los hubiera para otras stats
};

// --- Constantes ---
const SKILL_POINTS_PER_LEVEL = 4;
const MAX_PLAYER_LEVEL = 50;
const MIN_PLAYER_LEVEL = 1;
const MAX_SKILL_LEVEL = 10;
const MIN_SKILL_LEVEL = 0;

// --- Funciones de Ayuda ---

/**
 * Carga datos JSON de una ruta dada.
 * @param {string} path - La ruta al archivo JSON.
 * @returns {Promise<object>} - Una promesa que se resuelve con los datos JSON.
 */
async function fetchJsonData(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Error HTTP! estado: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error(`No se pudieron cargar los datos de ${path}:`, error);
    return null;
  }
}

/**
 * Obtiene los datos de una habilidad específica para un nivel dado.
 * @param {string} skillCode - El código único de la habilidad (ej. 'attack').
 * @param {number} level - El nivel de la habilidad (0-10).
 * @returns {object|null} Los datos de la habilidad o null si no se encuentran.
 */
function getSkillData(skillCode, level) {
  if (!skillsData || !skillsData.skills || !skillsData.skills[skillCode]) {
    return null;
  }
  // Asegurarse de que el nivel esté dentro del rango válido
  const validLevel = Math.max(MIN_SKILL_LEVEL, Math.min(MAX_SKILL_LEVEL, level));
  return skillsData.skills[skillCode][validLevel.toString()];
}

/**
 * Formatea un valor de habilidad (ej. añade '%' para porcentajes).
 * @param {string} skillCode - El código de la habilidad.
 * @param {number} value - El valor numérico de la habilidad.
 * @returns {string} El valor formateado como cadena.
 */
function formatSkillValue(skillCode, value) {
  const percentageSkills = ['precision', 'criticalChance', 'criticalDamages', 'armor', 'dodge', 'lootChance'];
  if (percentageSkills.includes(skillCode)) {
    return `${value}%`;
  }
  return value.toString();
}

/**
 * Habilita o deshabilita un botón.
 * @param {HTMLElement} button - El elemento del botón.
 * @param {boolean} enable - True para habilitar, false para deshabilitar.
 */
function setButtonEnabled(button, enable) {
  if (enable) {
    button.classList.remove('btn-disabled');
  } else {
    button.classList.add('btn-disabled');
  }
  button.disabled = !enable; // También establece el atributo disabled para accesibilidad
}

/**
 * Aplica el efecto de transformación temporal al botón.
 * @param {HTMLElement} button - El botón al que aplicar el efecto.
 */
function applyButtonTransform(button) {
    if (!button.classList.contains('btn-disabled')) {
        button.style.transform = 'scale(0.9)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 100);
    }
}

// --- Funciones de Renderizado de UI ---

/**
 * Renderiza el estado de una sola habilidad en la UI.
 * @param {string} skillCode - El código único de la habilidad.
 */
function renderSkill(skillCode) {
  const skillElements = ui.skillSections[skillCode];
  if (!skillElements) return;

  const currentLevel = playerState.assignedSkillLevels[skillCode];
  const skillInfo = getSkillData(skillCode, currentLevel);
  if (!skillInfo) return;

  // Actualizar valor de la habilidad
  skillElements.value.textContent = formatSkillValue(skillCode, skillInfo.value);

  // Actualizar barra de progreso
  const progressBlocks = skillElements.progressBar.children;
  let progressBarClass = 'active'; // Default
  if (skillCode === 'criticalChance' || skillCode === 'hunger') {
      progressBarClass = 'active-red';
  } else if (skillCode === 'armor' || skillCode === 'dodge') {
      progressBarClass = 'active-blue';
  } else if (skillCode === 'health' || skillCode === 'lootChance') {
      progressBarClass = 'active-green';
  }
  
  for (let i = 0; i < progressBlocks.length; i++) {
    if (i < currentLevel + 1) { 
      progressBlocks[i].classList.add(progressBarClass);
    } else {
      progressBlocks[i].classList.remove('active', 'active-red', 'active-blue', 'active-green'); 
    }
  }

  // Actualizar botones de habilidad (habilitar/deshabilitar)
  const minusButton = skillElements.minusBtn;
  const plusButton = skillElements.plusBtn;

  setButtonEnabled(minusButton, currentLevel > MIN_SKILL_LEVEL);

  const nextLevel = currentLevel + 1;
  const nextSkillInfo = getSkillData(skillCode, nextLevel);
  
  const canUpgrade = nextSkillInfo && 
                     playerState.skillPointsAvailable >= nextSkillInfo.cost && 
                     playerState.playerLevel >= nextSkillInfo.unlockAtLevel;
  
  setButtonEnabled(plusButton, canUpgrade);

  // Actualizar estadísticas en la tarjeta del personaje para esta habilidad
  if (ui.charStats[skillCode]) {
    // Para Attack, Precision, Crit Chance, Crit Damages, Armor, Dodge, Loot Chance
    // el valor mostrado en la tarjeta del personaje es el TOTAL (Skill + Equipo + Buffs)
    if (skillCode !== 'health' && skillCode !== 'hunger') {
        const { total } = calculateStatDetails(skillCode);
        ui.charStats[skillCode].textContent = formatSkillValue(skillCode, total);
    }
  }
}

/**
 * Renderiza el nivel del jugador y los puntos de habilidad.
 */
function renderPlayerStatus() {
  const totalPoints = playerState.playerLevel * SKILL_POINTS_PER_LEVEL;
  playerState.skillPointsTotal = totalPoints;

  ui.playerLevelDisplay.textContent = playerState.playerLevel;
  ui.charLevelBadge.textContent = playerState.playerLevel;
  ui.skillPointsAvailable.textContent = playerState.skillPointsAvailable;
  ui.skillPointsTotal.textContent = totalPoints;

  setButtonEnabled(ui.levelMinusBtn, playerState.playerLevel > MIN_PLAYER_LEVEL);
  setButtonEnabled(ui.levelPlusBtn, playerState.playerLevel < MAX_PLAYER_LEVEL);
}

/**
 * Renderiza las barras de recursos de Salud y Hambre.
 */
function renderResourceBars() {
  const healthSkillInfo = getSkillData('health', playerState.assignedSkillLevels.health);
  const hungerSkillInfo = getSkillData('hunger', playerState.assignedSkillLevels.hunger);

  if (healthSkillInfo) {
    ui.healthBarDisplay.textContent = `${healthSkillInfo.value}/${healthSkillInfo.value}`;
  }
  if (hungerSkillInfo) {
    ui.hungerBarDisplay.textContent = `${hungerSkillInfo.value}/${hungerSkillInfo.value}`;
    if (ui.charStats.hunger) { // También actualiza el hunger del botón de acción
        ui.charStats.hunger.textContent = hungerSkillInfo.value;
    }
  }
}

/**
 * Renderiza todos los elementos dinámicos de la UI basados en el playerState actual.
 */
function renderAllUI() {
  renderPlayerStatus();
  renderResourceBars();
  for (const skillCode in playerState.assignedSkillLevels) {
    renderSkill(skillCode);
  }
}

// --- Manejadores de Eventos ---

/**
 * Maneja los clics en los botones de ajuste de nivel de habilidad (+/-).
 * @param {HTMLElement} button - El botón que fue clickeado.
 */
function handleSkillButtonClick(button) {
  if (button.classList.contains('btn-disabled')) return;

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
 * Maneja los clics en los botones de ajuste de nivel de jugador (+/-).
 * @param {Event} event - El evento de click.
 */
function handleLevelButtonClick(event) {
  const button = event.target;
  if (button.classList.contains('btn-disabled')) return;

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
      console.warn("Nivel de jugador disminuido, puntos de habilidad gastados exceden el total nuevo. Reiniciando habilidades.");
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
 * Reinicia el estado del juego a sus valores iniciales (nivel de jugador y todas las habilidades a 0).
 */
function resetGame() {
    playerState.playerLevel = INITIAL_PLAYER_STATE.playerLevel;
    playerState.skillPointsSpent = INITIAL_PLAYER_STATE.skillPointsSpent;

    for (const skillCode in playerState.assignedSkillLevels) {
        playerState.assignedSkillLevels[skillCode] = 0;
    }

    const initialTotalPoints = playerState.playerLevel * SKILL_POINTS_PER_LEVEL;
    playerState.skillPointsTotal = initialTotalPoints;
    playerState.skillPointsAvailable = initialTotalPoints - playerState.skillPointsSpent;

    renderAllUI();
    applyButtonTransform(ui.resetBtn);
}


// --- Lógica del Tooltip ---

const SKILL_DESCRIPTIONS = {
    attack: "It is the base value for <em>Damages</em> calculation.",
    precision: "Chance to hit the target.",
    criticalChance: "Chance of landing a critical hit.",
    criticalDamages: "Increases the damage of critical hits.",
    armor: "Chance of reducing incoming damage.",
    dodge: "Dodging incoming damages. Prevents equipment durability from being consumed.",
    lootChance: "Chance to loot weapon or equipment after a battle."
    // Health and Hunger don't have tooltips for the character stats for now
};

/**
 * Calcula el desglose de una estadística, incluyendo Skill, Equipo y Buffs.
 * @param {string} skillCode - El código de la habilidad.
 * @returns {object} Un objeto con el desglose de valores y el total.
 */
function calculateStatDetails(skillCode) {
    const currentSkillLevel = playerState.assignedSkillLevels[skillCode];
    const skillBaseInfo = getSkillData(skillCode, currentSkillLevel);
    
    const skillUpgradeValue = skillBaseInfo ? skillBaseInfo.value : 0;
    let equipmentValue = 0;
    let ammoPercent = 0;
    let buffPercent = 0;
    let total = skillUpgradeValue;

    switch (skillCode) {
        case 'attack':
            if (MOCK_EQUIPMENT.weapon) {
                equipmentValue = MOCK_EQUIPMENT.weapon.attack;
            }
            if (MOCK_EQUIPMENT.ammo) {
                ammoPercent = MOCK_EQUIPMENT.ammo.percentAttack;
            }
            if (MOCK_BUFFS.attack) {
                buffPercent = MOCK_BUFFS.attack.percent;
            }
            // Cálculo de Attack: (Base Skill + Weapon) * (1 + %Ammo/100 + %Buff/100)
            total = (skillUpgradeValue + equipmentValue) * (1 + (ammoPercent / 100) + (buffPercent / 100));
            break;
        case 'precision':
            if (MOCK_EQUIPMENT.gloves) {
                equipmentValue = MOCK_EQUIPMENT.gloves.precision;
            }
            total = skillUpgradeValue + equipmentValue;
            break;
        case 'criticalChance':
            // No hay equipo directo en tu mock para Crit Chance, pero podría haberlo
            // Por ahora, asumimos que no hay equipo que lo modifique si no está en mockEquipment
            // o lo mapeamos a otro slot si es necesario. Por ejemplo, algunos juegos asocian
            // crit chance a un item secundario o gema. Aquí lo dejaremos sin equipo para este mock.
            // Si el JSON de equipo tuviera 'criticalChance', lo tomaríamos.
            // Por ahora, no hay item en MOCK_EQUIPMENT que modifique criticalChance directamente.
            total = skillUpgradeValue + equipmentValue;
            break;
        case 'criticalDamages':
            if (MOCK_EQUIPMENT.helmet) {
                equipmentValue = MOCK_EQUIPMENT.helmet.criticalDamages;
            }
            total = skillUpgradeValue + equipmentValue;
            break;
        case 'armor':
            if (MOCK_EQUIPMENT.chest) {
                equipmentValue += MOCK_EQUIPMENT.chest.armor;
            }
            if (MOCK_EQUIPMENT.pants) {
                equipmentValue += MOCK_EQUIPMENT.pants.armor;
            }
            total = skillUpgradeValue + equipmentValue;
            break;
        case 'dodge':
            if (MOCK_EQUIPMENT.boots) {
                equipmentValue = MOCK_EQUIPMENT.boots.dodge;
            }
            total = skillUpgradeValue + equipmentValue;
            break;
        case 'lootChance':
            // No hay equipo directo en tu mock para Loot Chance
            total = skillUpgradeValue + equipmentValue;
            break;
    }

    return {
        skillUpgradeValue: skillUpgradeValue,
        equipmentValue: equipmentValue,
        ammoPercent: ammoPercent,
        buffPercent: buffPercent,
        total: parseFloat(total.toFixed(1)) // Redondear a un decimal
    };
}


/**
 * Muestra el tooltip de la estadística al pasar el ratón por encima.
 * @param {Event} event - El evento mouseenter.
 */
function handleStatMouseEnter(event) {
    const statItem = event.currentTarget;
    const skillCode = statItem.dataset.statCode;
    const skillNameElement = document.querySelector(`.skill[data-skill="${skillCode}"] .skill-name`);
    const skillName = skillNameElement ? skillNameElement.textContent : skillCode; // Obtener nombre legible
    const description = SKILL_DESCRIPTIONS[skillCode];

    if (!skillCode || !description) {
        ui.statTooltip.style.opacity = 0;
        return;
    }

    const stats = calculateStatDetails(skillCode);
    let tooltipContent = `<h4>${skillName}</h4>`;
    tooltipContent += `<p class="description">${description}</p>`;
    
    // Skill Upgrade
    tooltipContent += `<div class="detail-line"><span class="detail-label">Skill upgrade:</span> <span class="detail-value">${formatSkillValue(skillCode, stats.skillUpgradeValue)}</span></div>`;
    
    // Modificadores específicos de Attack
    if (skillCode === 'attack') {
        if (MOCK_EQUIPMENT.weapon) {
            tooltipContent += `<div class="detail-line"><span class="detail-label">Weapon:</span> <span class="detail-value">+${MOCK_EQUIPMENT.weapon.attack} (${MOCK_EQUIPMENT.weapon.name})</span></div>`;
        }
        if (MOCK_EQUIPMENT.ammo && stats.ammoPercent > 0) {
            tooltipContent += `<div class="detail-line"><span class="detail-label">Ammo:</span> <span class="detail-value">+${stats.ammoPercent}% (${MOCK_EQUIPMENT.ammo.name})</span></div>`;
        }
        if (MOCK_BUFFS.attack && stats.buffPercent > 0) {
            tooltipContent += `<div class="detail-line"><span class="detail-label">Buff:</span> <span class="detail-value">+${stats.buffPercent}% (${MOCK_BUFFS.attack.name})</span></div>`;
        }
    } else { // Otros skills con modificadores de equipo
        let equipmentApplied = false;
        // Mapeo inverso de habilidades a slots de equipo para mostrar el nombre del item
        const equipmentMap = {
            precision: MOCK_EQUIPMENT.gloves,
            criticalDamages: MOCK_EQUIPMENT.helmet,
            armor: (MOCK_EQUIPMENT.chest || MOCK_EQUIPMENT.pants), // Considera ambos si están equipados
            dodge: MOCK_EQUIPMENT.boots,
            // lootChance no tiene equipo en mock
            // criticalChance no tiene equipo en mock
        };

        const equipmentForSkill = equipmentMap[skillCode];
        if (equipmentForSkill && stats.equipmentValue > 0) {
            let itemNames = [];
            if (skillCode === 'armor') { // Special handling for armor from multiple pieces
                if (MOCK_EQUIPMENT.chest && MOCK_EQUIPMENT.chest.armor > 0) itemNames.push(MOCK_EQUIPMENT.chest.name);
                if (MOCK_EQUIPMENT.pants && MOCK_EQUIPMENT.pants.armor > 0) itemNames.push(MOCK_EQUIPMENT.pants.name);
            } else {
                itemNames.push(equipmentForSkill.name);
            }
            tooltipContent += `<div class="detail-line"><span class="detail-label">Equipment:</span> <span class="detail-value">+${stats.equipmentValue}${percentageSkills.includes(skillCode) ? '%' : ''} (${itemNames.join(', ')})</span></div>`;
            equipmentApplied = true;
        }
        if (!equipmentApplied && stats.equipmentValue === 0) { // Mostrar "N/A" si no hay equipo o no aplica
            // Opcional: mostrar líneas de equipo si no hay valor para indicar que no hay modificador
            // Por ahora, solo si equipmentValue es 0 y no hay equipo aplicado, no mostramos la línea.
        }
    }

    // Total
    tooltipContent += `<div class="total-line"><span class="detail-label">Total:</span> <span class="detail-value">${formatSkillValue(skillCode, stats.total)}</span></div>`;

    ui.statTooltip.innerHTML = tooltipContent;
    ui.statTooltip.style.opacity = 1;

    // Posicionar el tooltip
    const rect = statItem.getBoundingClientRect();
    ui.statTooltip.style.left = `${rect.left + window.scrollX + rect.width + 10}px`; // 10px a la derecha del elemento
    ui.statTooltip.style.top = `${rect.top + window.scrollY}px`;
}

/**
 * Oculta el tooltip al salir el ratón.
 */
function handleStatMouseLeave() {
    ui.statTooltip.style.opacity = 0;
    // Opcional: limpiar el contenido después de la transición para rendimiento
    setTimeout(() => { ui.statTooltip.innerHTML = ''; }, 200); 
}


// --- Función de Inicialización Principal ---
async function init() {
  skillsData = await fetchJsonData('skills.json');
  if (!skillsData) {
    console.error("No se pudieron cargar los datos de habilidades. La UI no será interactiva.");
    return;
  }

  // AHORA es seguro obtener las referencias a los elementos del DOM
  ui = {
    playerLevelDisplay: document.getElementById('player-level-display'),
    charLevelBadge: document.getElementById('char-level-badge'),
    levelMinusBtn: document.getElementById('level-minus-btn'),
    levelPlusBtn: document.getElementById('level-plus-btn'),
    skillPointsAvailable: document.getElementById('skill-points-available'),
    skillPointsTotal: document.getElementById('skill-points-total'),
    healthBarDisplay: document.getElementById('health-bar-display'),
    hungerBarDisplay: document.getElementById('hunger-bar-display'),
    resetBtn: document.getElementById('reset-btn'), 
    statTooltip: document.getElementById('stat-tooltip'), // Referencia al tooltip
    skillSections: {}, 
    charStats: { // Estos son los elementos en la tarjeta del personaje
      attack: document.getElementById('char-stat-attack'),
      precision: document.getElementById('char-stat-precision'),
      criticalChance: document.getElementById('char-stat-criticalChance'),
      criticalDamages: document.getElementById('char-stat-criticalDamages'),
      armor: document.getElementById('char-stat-armor'),
      dodge: document.getElementById('char-stat-dodge'),
      lootChance: document.getElementById('char-stat-lootChance'),
      hunger: document.getElementById('char-stat-hunger'), // Aunque hunger no tiene tooltip de desglose, se actualiza aquí
    }
  };

  // Rellenar el mapa de elementos UI para un acceso más fácil
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

  // Calcular puntos iniciales basados en el nivel del jugador y habilidades asignadas (que son 0 por defecto)
  playerState.skillPointsTotal = playerState.playerLevel * SKILL_POINTS_PER_LEVEL;
  playerState.skillPointsAvailable = playerState.skillPointsTotal - playerState.skillPointsSpent;

  // --- Agregar TODOS los Event Listeners ---

  // Event delegation para los botones de habilidad (lógica principal y efecto de clic)
  document.querySelector('.skills-section').addEventListener('click', function(event) {
    const button = event.target.closest('.skill-btn');
    if (button) {
      applyButtonTransform(button);
      handleSkillButtonClick(button);
    }
  });

  // Event Listeners para los botones de nivel del jugador (con efecto de clic)
  ui.levelMinusBtn.addEventListener('click', function(event) {
    applyButtonTransform(event.target);
    handleLevelButtonClick(event);
  });
  ui.levelPlusBtn.addEventListener('click', function(event) {
    applyButtonTransform(event.target);
    handleLevelButtonClick(event);
  });

  // Event Listener para el nuevo botón de Reset
  ui.resetBtn.addEventListener('click', resetGame);

  // Manejadores de clic para los ítems del inventario (funcionalidad original)
  document.querySelectorAll('.inventory-item').forEach(item => {
    item.addEventListener('click', function() {
      this.style.transform = 'scale(0.95)';
      setTimeout(() => {
        this.style.transform = 'scale(1)';
      }, 150);
    });
  });

  // --- Event Listeners para los Tooltips de Estadísticas ---
  document.querySelectorAll('.character-stats .stat-item').forEach(statItem => {
    statItem.addEventListener('mouseenter', handleStatMouseEnter);
    statItem.addEventListener('mouseleave', handleStatMouseLeave);
  });

  // Renderizado inicial de todos los elementos de la UI
  renderAllUI();
}

// Inicializar cuando el contenido del DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', init);