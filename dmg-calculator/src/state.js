// --- START OF FILE src/state.js (CORRECTED) ---

export const SKILL_POINTS_PER_LEVEL = 4;
export const MAX_PLAYER_LEVEL = 50;
export const MIN_PLAYER_LEVEL = 1;
export const MAX_SKILL_LEVEL = 10;
export const MIN_SKILL_LEVEL = 0;

const INITIAL_PLAYER_STATE = {
  playerLevel: 1,
  skillPointsAvailable: 0,
  skillPointsSpent: 0,
  currentHealth: 50,
  currentHunger: 10,
  assignedSkillLevels: {
    attack: 0, precision: 0, criticalChance: 0, criticalDamages: 0, armor: 0,
    dodge: 0, health: 0, lootChance: 0, hunger: 0,
  },
  equippedItems: {
    weapon: null, ammo: null, helmet: null, chest: null,
    pants: null, boots: null, gloves: null,
  },
  activeBuffs: {
    ammo: null, consumable: null
  },
  selectedItemForConfig: null,
  lastSimulationSummary: 'No simulation has been run yet.',
};

export let playerState = JSON.parse(JSON.stringify(INITIAL_PLAYER_STATE));
export let skillsData = null;

export function setSkillsData(data) {
  skillsData = data;
}

/**
 * Resets the player state by merging the initial state without breaking references.
 */
export function resetPlayerState() {
  const initialCopy = JSON.parse(JSON.stringify(INITIAL_PLAYER_STATE));
  for (const key in playerState) {
    if (initialCopy.hasOwnProperty(key)) {
      playerState[key] = initialCopy[key];
    } else {
      delete playerState[key];
    }
  }
}