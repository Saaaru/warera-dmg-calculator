// --- Global Constants ---
export const SKILL_POINTS_PER_LEVEL = 4;
export const MAX_PLAYER_LEVEL = 50;
export const MIN_PLAYER_LEVEL = 1;
export const MAX_SKILL_LEVEL = 10;
export const MIN_SKILL_LEVEL = 0;

// --- Initial and Global State ---
const INITIAL_PLAYER_STATE = {
  playerLevel: 1,
  skillPointsAvailable: 0,
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
  // ADDED: The single source of truth for equipped items
  equippedItems: {
    weapon: null,       // Example: { code: 'gun', name: 'Gun', stats: { attack: 55, criticalChance: 5 } }
    ammo: null,         // Example: { code: 'ammo', name: 'Ammo', stats: { percentAttack: 20 } }
    helmet: null,
    chest: null,
    pants: null,
    boots: null,
    gloves: null,
    selectedItemForConfig: null,
  },
};

// The mutable state object used throughout the application
export let playerState = JSON.parse(JSON.stringify(INITIAL_PLAYER_STATE)); // Deep copy

// --- Data holder for skills.json ---
export let skillsData = null;

/**
 * Updates the skillsData object.
 * @param {object} data The fetched data from skills.json
 */
export function setSkillsData(data) {
  skillsData = data;
}

/**
 * Resets the player state to its initial configuration.
 */
export function resetPlayerState() {
    const level = INITIAL_PLAYER_STATE.playerLevel;
    playerState.playerLevel = level;
    playerState.skillPointsSpent = 0;
    playerState.selectedItemForConfig = null;
    
    // Reset assigned skills
    for (const skillCode in playerState.assignedSkillLevels) {
        playerState.assignedSkillLevels[skillCode] = 0;
      
    }
    
    const initialTotalPoints = level * SKILL_POINTS_PER_LEVEL;
    playerState.skillPointsAvailable = initialTotalPoints - playerState.skillPointsSpent;
    playerState.equippedItems = JSON.parse(JSON.stringify(INITIAL_PLAYER_STATE.equippedItems));
    
    
  
}