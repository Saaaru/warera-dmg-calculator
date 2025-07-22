// --- Global State and Data ---
const INITIAL_PLAYER_STATE = {
    playerLevel: 1, // Nivel inicial del jugador
    skillPointsAvailable: 0, // Se calculará al inicio
    skillPointsSpent: 0,
    // Las habilidades asignadas siempre inician en 0 para el reset
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
    if (!skillElements) return; // Salir si el elemento no se encontró (ej. en habilidades que no están en el DOM)
  
    const currentLevel = playerState.assignedSkillLevels[skillCode];
    const skillInfo = getSkillData(skillCode, currentLevel);
    if (!skillInfo) return; // Salir si no hay datos para este nivel de habilidad
  
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
        progressBlocks[i].classList.remove('active', 'active-red', 'active-blue', 'active-green'); // Remover todas las clases activas
      }
    }
  
    // Actualizar botones de habilidad (habilitar/deshabilitar)
    const minusButton = skillElements.minusBtn;
    const plusButton = skillElements.plusBtn;
  
    // Deshabilitar botón de menos si está en el nivel mínimo (0)
    setButtonEnabled(minusButton, currentLevel > MIN_SKILL_LEVEL);
  
    // Comprobar condiciones para el botón de más:
    const nextLevel = currentLevel + 1;
    const nextSkillInfo = getSkillData(skillCode, nextLevel);
    
    const canUpgrade = nextSkillInfo && 
                       playerState.skillPointsAvailable >= nextSkillInfo.cost && 
                       playerState.playerLevel >= nextSkillInfo.unlockAtLevel;
    
    setButtonEnabled(plusButton, canUpgrade);
  
    // Actualizar estadísticas en la tarjeta del personaje para esta habilidad
    if (ui.charStats[skillCode]) {
      ui.charStats[skillCode].textContent = formatSkillValue(skillCode, skillInfo.value);
    }
  }
  
  /**
   * Renderiza el nivel del jugador y los puntos de habilidad.
   */
  function renderPlayerStatus() {
    const totalPoints = playerState.playerLevel * SKILL_POINTS_PER_LEVEL;
    playerState.skillPointsTotal = totalPoints; // Actualizar el objeto de estado
  
    ui.playerLevelDisplay.textContent = playerState.playerLevel;
    ui.charLevelBadge.textContent = playerState.playerLevel;
    ui.skillPointsAvailable.textContent = playerState.skillPointsAvailable;
    ui.skillPointsTotal.textContent = totalPoints;
  
    // Habilitar/deshabilitar botones de nivel del jugador
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
      ui.healthBarDisplay.textContent = `${healthSkillInfo.value}/${healthSkillInfo.value}`; // Asumiendo salud actual = salud máxima
    }
    if (hungerSkillInfo) {
      ui.hungerBarDisplay.textContent = `${hungerSkillInfo.value}/${hungerSkillInfo.value}`; // Asumiendo hambre actual = hambre máxima
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
          const refundedCost = getSkillData(skillCode, currentLevel)?.cost || 0; // Costo del nivel que estamos dejando
          playerState.assignedSkillLevels[skillCode] = currentLevel - 1;
          playerState.skillPointsAvailable += refundedCost; // Devolver los puntos gastados por ese nivel
          playerState.skillPointsSpent -= refundedCost;
      }
    }
    renderAllUI(); // Volver a renderizar toda la UI después del cambio de estado
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
  
      // Si al bajar de nivel, los puntos gastados superan los totales del nuevo nivel,
      // se resetean las habilidades a 0 y se devuelven todos los puntos disponibles.
      if (playerState.skillPointsSpent > newTotalPoints) {
        console.warn("Nivel de jugador disminuido, puntos de habilidad gastados exceden el total nuevo. Reiniciando habilidades.");
        for (const skillCode in playerState.assignedSkillLevels) {
          playerState.assignedSkillLevels[skillCode] = 0;
        }
        playerState.skillPointsSpent = 0;
        playerState.skillPointsAvailable = newTotalPoints;
      }
    }
    renderAllUI(); // Volver a renderizar toda la UI después del cambio de estado
  }
  
  /**
   * Reinicia el estado del juego a sus valores iniciales (nivel de jugador y todas las habilidades a 0).
   */
  function resetGame() {
      // Reestablecer el nivel del jugador y los puntos gastados al estado inicial
      playerState.playerLevel = INITIAL_PLAYER_STATE.playerLevel;
      playerState.skillPointsSpent = INITIAL_PLAYER_STATE.skillPointsSpent; // Esto debería ser 0
  
      // Reiniciar explícitamente el nivel de TODAS las habilidades a 0
      for (const skillCode in playerState.assignedSkillLevels) {
          playerState.assignedSkillLevels[skillCode] = 0;
      }
  
      // Recalcular los puntos disponibles para el nivel inicial y sin puntos gastados
      const initialTotalPoints = playerState.playerLevel * SKILL_POINTS_PER_LEVEL;
      playerState.skillPointsTotal = initialTotalPoints;
      playerState.skillPointsAvailable = initialTotalPoints - playerState.skillPointsSpent; // Esto será `initialTotalPoints`
  
      renderAllUI(); // Renderizar toda la UI para reflejar el estado reiniciado
      applyButtonTransform(ui.resetBtn); // Efecto visual para el botón de reset
  }
  
  
  // --- Función de Inicialización Principal ---
  async function init() {
    skillsData = await fetchJsonData('skills.json');
    if (!skillsData) {
      console.error("No se pudieron cargar los datos de habilidades. La UI no será interactiva.");
      return;
    }
  
    // AHORA es seguro obtener las referencias a los elementos del DOM
    // porque esta función (init) se llama DENTRO de DOMContentLoaded
    // y el script está al final del body.
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
      skillSections: {}, 
      charStats: {
        attack: document.getElementById('char-stat-attack'),
        precision: document.getElementById('char-stat-precision'),
        criticalChance: document.getElementById('char-stat-criticalChance'),
        criticalDamages: document.getElementById('char-stat-criticalDamages'),
        armor: document.getElementById('char-stat-armor'),
        dodge: document.getElementById('char-stat-dodge'),
        lootChance: document.getElementById('char-stat-lootChance'),
        hunger: document.getElementById('char-stat-hunger'),
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
    playerState.skillPointsAvailable = playerState.skillPointsTotal - playerState.skillPointsSpent; // Aquí skillPointsSpent es 0
  
    // --- Agregar TODOS los Event Listeners ---
  
    // Event delegation para los botones de habilidad (lógica principal y efecto de clic)
    document.querySelector('.skills-section').addEventListener('click', function(event) {
      const button = event.target.closest('.skill-btn');
      if (button) {
        applyButtonTransform(button); // Aplicar el efecto visual
        handleSkillButtonClick(button); // Manejar la lógica de la habilidad
      }
    });
  
    // Event Listeners para los botones de nivel del jugador (con efecto de clic)
    ui.levelMinusBtn.addEventListener('click', function(event) {
      applyButtonTransform(event.target); // Aplicar el efecto visual
      handleLevelButtonClick(event); // Manejar la lógica del nivel
    });
    ui.levelPlusBtn.addEventListener('click', function(event) {
      applyButtonTransform(event.target); // Aplicar el efecto visual
      handleLevelButtonClick(event); // Manejar la lógica del nivel
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
  
    // Renderizado inicial de todos los elementos de la UI
    renderAllUI();
  }
  
  // Inicializar cuando el contenido del DOM esté completamente cargado
  document.addEventListener('DOMContentLoaded', init);