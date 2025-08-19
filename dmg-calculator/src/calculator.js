// Calculation logic: Provides functions for skill calculations, combat simulations, and stat details.

import { skillsData, playerState, MIN_SKILL_LEVEL, MAX_SKILL_LEVEL } from './state.js';

// Global random factor for all skills (0.9x - 1.1x)
// This factor is generated once and applied to all skill calculations for consistency
let globalSkillRandomFactor = null;

/**
 * Generates or returns the global random factor for skill calculations.
 * This factor is applied to ALL skills to simulate realistic variance.
 * @returns {number} Random factor between 0.9 and 1.1
 */
function getGlobalSkillRandomFactor() {
    if (globalSkillRandomFactor === null) {
        globalSkillRandomFactor = 0.9 + (Math.random() * 0.2); // 0.9 to 1.1
    }
    return globalSkillRandomFactor;
}

/**
 * Resets the global random factor (useful for new simulations)
 */
export function resetGlobalSkillRandomFactor() {
    globalSkillRandomFactor = null;
}

export function getSkillData(skillCode, level) {
  if (!skillsData || !skillsData.skills || !skillsData.skills[skillCode]) {
    return null;
  }
  const validLevel = Math.max(MIN_SKILL_LEVEL, Math.min(MAX_SKILL_LEVEL, level));
  return skillsData.skills[skillCode][validLevel.toString()];
}

export function calculateCumulativeSkillCost(skillCode, level) {
    if (!skillsData || !skillsData.skills || !skillsData.skills[skillCode] || level <= MIN_SKILL_LEVEL) {
        return 0;
    }
    let totalCost = 0;
    for (let i = 1; i <= level; i++) {
        const levelData = getSkillData(skillCode, i);
        if (levelData && levelData.cost) {
            totalCost += levelData.cost;
        }
    }
    return totalCost;
}

export function calculateStatDetails(skillCode) {
    // Aunque ya no es la causa del error principal, esta guarda es buena práctica.
    if (!skillsData || !skillsData.skills) {
        return { skillValue: 0, equipmentValue: 0, equipmentItems: [], ammoPercent: 0, buffPercent: 0, total: 0, randomFactor: 1 };
    }

    const currentSkillLevel = playerState.skillLevelsAssigned[skillCode];
    const skillBaseInfo = getSkillData(skillCode, currentSkillLevel);
    const skillValue = skillBaseInfo ? skillBaseInfo.value : 0;
    const { equippedItems, activeBuffs } = playerState;
    let equipmentValue = 0;
    let equipmentItems = [];
    let ammoPercent = 0;
    let buffPercent = 0;
    let total = skillValue;
    
    // Apply global random factor to skill value
    const randomFactor = getGlobalSkillRandomFactor();
    const adjustedSkillValue = skillValue * randomFactor;
    total = adjustedSkillValue;

    switch (skillCode) {
        case 'attack':
            // CAMBIO: Añadido encadenamiento opcional `?.` para manejar weapon=null
            equipmentValue = equippedItems.weapon?.stats?.attack || 0;
            if (equippedItems.weapon) equipmentItems.push(equippedItems.weapon);
            
            // CAMBIO: Añadido encadenamiento opcional `?.` para los buffs
            ammoPercent = activeBuffs.ammo?.stats?.percentAttack || 0;
            buffPercent = activeBuffs.consumable?.stats?.percentAttack || 0;
            total = (adjustedSkillValue + equipmentValue) * (1 + (ammoPercent / 100) + (buffPercent / 100));
            break;
        case 'precision':
            // CAMBIO: Añadido encadenamiento opcional `?.` para manejar gloves=null
            equipmentValue = equippedItems.gloves?.stats?.precision || 0;
            if (equippedItems.gloves) equipmentItems.push(equippedItems.gloves);
            total = adjustedSkillValue + equipmentValue;
            break;
        case 'criticalChance':
            // CAMBIO: Añadido encadenamiento opcional `?.` para manejar weapon=null
            equipmentValue = (equippedItems.weapon?.stats?.criticalChance || 0);
            if (equippedItems.weapon) equipmentItems.push(equippedItems.weapon);
            total = adjustedSkillValue + equipmentValue;
            break;
        case 'criticalDamages':
            // CAMBIO: Añadido encadenamiento opcional `?.` para manejar helmet=null
            equipmentValue = equippedItems.helmet?.stats?.criticalDamages || 0;
            if (equippedItems.helmet) equipmentItems.push(equippedItems.helmet);
            total = adjustedSkillValue + equipmentValue;
            break;
        case 'armor':
            // CAMBIO: Añadido encadenamiento opcional `?.` para chest y pants
            const chestArmor = equippedItems.chest?.stats?.armor || 0;
            const pantsArmor = equippedItems.pants?.stats?.armor || 0;
            equipmentValue = chestArmor + pantsArmor;
            if (equippedItems.chest) equipmentItems.push(equippedItems.chest);
            if (equippedItems.pants) equipmentItems.push(equippedItems.pants);
            total = adjustedSkillValue + equipmentValue;
            break;
        case 'dodge':
            // CAMBIO: Añadido encadenamiento opcional `?.` para boots
            equipmentValue = equippedItems.boots?.stats?.dodge || 0;
            if (equippedItems.boots) equipmentItems.push(equippedItems.boots);
            total = adjustedSkillValue + equipmentValue;
            break;
        case 'lootChance':
            total = adjustedSkillValue;
            break;
    }
    return {
        skillValue,
        equipmentValue,
        equipmentItems,
        ammoPercent,
        buffPercent,
        total: parseFloat(total.toFixed(1)),
        randomFactor: parseFloat(randomFactor.toFixed(3))
    };
}

/**
 * Runs a single, self-contained, and lightweight combat simulation.
 * Optimized for speed by not generating logs. Now includes durability tracking.
 * @param {object} initialPlayerState - A snapshot of the player's state before combat.
 * @param {object} foodItem - The food item to be used during simulation.
 * @returns {object} The results of the simulation run.
 */
function runSingleLightweightSimulation(initialPlayerState, foodItem) {
    let totalDamageDealt = 0;
    let ticksSurvived = 0;
    let endReason = 'max_ticks'; // Default reason if the loop hits the limit

    // --- START: Durability & Resource Tracking ---
    let tempCurrentHealth = initialPlayerState.currentHealth;
    let tempCurrentHunger = initialPlayerState.currentHunger;
    let tempDurability = {
        weapon: 100,
        helmet: 100,
        chest: 100,
        pants: 100,
        boots: 100,
        gloves: 100,
    };
    // --- END: Durability & Resource Tracking ---

    const healthPerFood = foodItem.flatStats.healthRegen || 0;
    const maxHealthFromSkills = getSkillData('health', initialPlayerState.skillLevelsAssigned.health)?.value || 50;
    const INCOMING_DAMAGE_PER_TICK = 10;
    const MAX_TICKS = 5000;

    while (ticksSurvived < MAX_TICKS) {
        // Condition 1: Check if weapon is broken BEFORE the next hit
        if (tempDurability.weapon <= 0) {
            endReason = 'weapon_broken';
            break;
        }

        // Heal logic (remains the same)
        if (tempCurrentHealth <= INCOMING_DAMAGE_PER_TICK && tempCurrentHunger > 0 && healthPerFood > 0) {
            while (tempCurrentHunger > 0 && tempCurrentHealth <= INCOMING_DAMAGE_PER_TICK) {
                if (tempCurrentHealth >= maxHealthFromSkills) break;
                tempCurrentHunger--;
                tempCurrentHealth += healthPerFood;
            }
        }
        
        // Condition 2: Check for enough health for the next hit
        if (tempCurrentHealth < INCOMING_DAMAGE_PER_TICK) {
            endReason = 'no_health';
            break;
        }

        const tickResult = simulateCombatTick();
        
        tempCurrentHealth -= tickResult.healthLost;
        totalDamageDealt += tickResult.finalDamageDealt;
        ticksSurvived++;

        // --- START: Durability Consumption Logic ---
        tempDurability.weapon -= 1; // Weapon durability is always consumed.

        if (!tickResult.wasDodge) {
            // If the hit was not dodged, all other equipment also loses durability.
            if (initialPlayerState.equippedItems.helmet) tempDurability.helmet -= 1;
            if (initialPlayerState.equippedItems.chest) tempDurability.chest -= 1;
            if (initialPlayerState.equippedItems.pants) tempDurability.pants -= 1;
            if (initialPlayerState.equippedItems.boots) tempDurability.boots -= 1;
            if (initialPlayerState.equippedItems.gloves) tempDurability.gloves -= 1;
        }
        // --- END: Durability Consumption Logic ---

        // Condition 3: Check if health dropped to zero AFTER the hit
        if (tempCurrentHealth <= 0) {
             endReason = 'no_health';
             break;
        }
    }
    
    return {
        totalDamageDealt,
        ticksSurvived,
        endReason // Return why the simulation stopped
    };
}

/**
 * Calculates basic statistics from an array of numbers.
 * @param {Array} data - Array of numeric values.
 * @returns {object} Object containing mean, min, max, and standard deviation.
 */
function calculateStatistics(data) {
    if (data.length === 0) return { mean: 0, min: 0, max: 0, stdDev: 0 };
    
    const sum = data.reduce((acc, val) => acc + val, 0);
    const mean = sum / data.length;
    const min = Math.min(...data);
    const max = Math.max(...data);
    
    const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    
    return {
        mean: parseFloat(mean.toFixed(1)),
        min: parseFloat(min.toFixed(1)),
        max: parseFloat(max.toFixed(1)),
        stdDev: parseFloat(stdDev.toFixed(1))
    };
}

/**
 * Performs a Monte Carlo simulation focusing on multiple KPIs.
 * @param {number} iterations - The number of simulations to run.
 * @param {object} initialPlayerState - A snapshot of the player's state.
 * @param {object} foodItem - The food item to use.
 * @returns {object} An object containing the statistical analysis of all KPIs.
 */
export function runMonteCarloSimulation(iterations, initialPlayerState, foodItem) {
    // Reset the global random factor for this simulation
    resetGlobalSkillRandomFactor();
    
    const damageResults = [];
    const ticksResults = [];
    const endReasonCounts = { no_health: 0, weapon_broken: 0, max_ticks: 0 };
    
    for (let i = 0; i < iterations; i++) {
        const result = runSingleLightweightSimulation(initialPlayerState, foodItem);
        damageResults.push(result.totalDamageDealt);
        ticksResults.push(result.ticksSurvived);
        if (endReasonCounts[result.endReason] !== undefined) {
            endReasonCounts[result.endReason]++;
        }
    }

    return {
        damageStats: calculateStatistics(damageResults),
        ticksStats: calculateStatistics(ticksResults),
        endReasonStats: {
            byHealth: (endReasonCounts.no_health / iterations) * 100,
            byWeapon: (endReasonCounts.weapon_broken / iterations) * 100,
            byMaxTicks: (endReasonCounts.max_ticks / iterations) * 100,
        },
        randomFactor: getGlobalSkillRandomFactor()
    };
}

// Removed simulateFullCombat function - no longer needed

export function simulateFullCombatWithFood(foodItem) {
    // Reset the global random factor for this simulation
    resetGlobalSkillRandomFactor();
    
    let totalDamageDealt = 0;
    let ticksSurvived = 0;
    let tempCurrentHealth = playerState.currentHealth;
    let tempCurrentHunger = playerState.currentHunger;
    const healthPerFood = foodItem.flatStats.healthRegen || 0;
    const maxHealthFromSkills = getSkillData('health', playerState.skillLevelsAssigned.health)?.value || 50;
    const INCOMING_DAMAGE_PER_TICK = 10;
    const MAX_TICKS = 2000;
    
    while (ticksSurvived < MAX_TICKS) {
        // Healing logic
        if (tempCurrentHealth <= INCOMING_DAMAGE_PER_TICK && tempCurrentHunger > 0 && healthPerFood > 0) {
            while (tempCurrentHunger > 0 && tempCurrentHealth <= INCOMING_DAMAGE_PER_TICK) {
                if (tempCurrentHealth >= maxHealthFromSkills) {
                    break;
                }
                tempCurrentHunger--;
                tempCurrentHealth += healthPerFood;
            }
        }
        
        // Check if player can attack
        if (tempCurrentHealth < INCOMING_DAMAGE_PER_TICK) {
            break;
        }

        const tickResult = simulateCombatTick();
        tempCurrentHealth -= tickResult.healthLost;
        totalDamageDealt += tickResult.finalDamageDealt;
        ticksSurvived++;
        
        // If health drops to zero or below, combat ends immediately
        if (tempCurrentHealth <= 0) {
             break;
        }
    }
    
    return {
        totalDamageDealt: parseFloat(totalDamageDealt.toFixed(1)),
        ticksSurvived,
        finalHealth: Math.max(0, tempCurrentHealth),
        finalHunger: tempCurrentHunger,
        randomFactor: getGlobalSkillRandomFactor()
    };
}

export function simulateCombatTick() {
  const attackStats = calculateStatDetails('attack');
  const precisionStats = calculateStatDetails('precision');
  const critChanceStats = calculateStatDetails('criticalChance');
  const critDamageStats = calculateStatDetails('criticalDamages');
  const armorStats = calculateStatDetails('armor');
  const dodgeStats = calculateStatDetails('dodge');
  
  let finalDamageDealt = 0;
  let healthLost = 10;
  
  // Dodge check
  const wasDodge = Math.random() * 100 < dodgeStats.total;
  if (wasDodge) {
      healthLost = 0;
  } else {
      const damageReduction = healthLost * (armorStats.total / 100);
      healthLost -= damageReduction;
  }
  
  // Base damage calculation
  let baseDamage = attackStats.total;
  
  // Hit/Miss check
  const wasHit = Math.random() * 100 < precisionStats.total;
  if (!wasHit) {
      baseDamage /= 2;
  }
  
  // Critical hit check
  const wasCritical = Math.random() * 100 < critChanceStats.total;
  if (wasCritical) {
      const critMultiplier = 1 + (critDamageStats.total / 100);
      finalDamageDealt = baseDamage * critMultiplier;
  } else {
      finalDamageDealt = baseDamage;
  }
  
  return {
      finalDamageDealt: parseFloat(finalDamageDealt.toFixed(1)),
      healthLost: parseFloat(healthLost.toFixed(1)),
      wasCritical,
      wasHit,
      wasDodge,
  };
}