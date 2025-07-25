// Calculation logic: Provides functions for skill calculations, combat simulations, and stat details.

import { skillsData, playerState, MIN_SKILL_LEVEL, MAX_SKILL_LEVEL } from './state.js';

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
        return { skillValue: 0, equipmentValue: 0, equipmentItems: [], ammoPercent: 0, buffPercent: 0, total: 0 };
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

    switch (skillCode) {
        case 'attack':
            // CAMBIO: Añadido encadenamiento opcional `?.` para manejar weapon=null
            equipmentValue = equippedItems.weapon?.stats?.attack || 0;
            if (equippedItems.weapon) equipmentItems.push(equippedItems.weapon);
            
            // CAMBIO: Añadido encadenamiento opcional `?.` para los buffs
            ammoPercent = activeBuffs.ammo?.stats?.percentAttack || 0;
            buffPercent = activeBuffs.consumable?.stats?.percentAttack || 0;
            total = (skillValue + equipmentValue) * (1 + (ammoPercent / 100) + (buffPercent / 100));
            break;
        case 'precision':
            // CAMBIO: Añadido encadenamiento opcional `?.` para manejar gloves=null
            equipmentValue = equippedItems.gloves?.stats?.precision || 0;
            if (equippedItems.gloves) equipmentItems.push(equippedItems.gloves);
            total = skillValue + equipmentValue;
            break;
        case 'criticalChance':
            // CAMBIO: Añadido encadenamiento opcional `?.` para manejar weapon=null
            equipmentValue = (equippedItems.weapon?.stats?.criticalChance || 0);
            if (equippedItems.weapon) equipmentItems.push(equippedItems.weapon);
            total = skillValue + equipmentValue;
            break;
        case 'criticalDamages':
            // CAMBIO: Añadido encadenamiento opcional `?.` para manejar helmet=null
            equipmentValue = equippedItems.helmet?.stats?.criticalDamages || 0;
            if (equippedItems.helmet) equipmentItems.push(equippedItems.helmet);
            total = skillValue + equipmentValue;
            break;
        case 'armor':
            // CAMBIO: Añadido encadenamiento opcional `?.` para chest y pants
            const chestArmor = equippedItems.chest?.stats?.armor || 0;
            const pantsArmor = equippedItems.pants?.stats?.armor || 0;
            equipmentValue = chestArmor + pantsArmor;
            if (equippedItems.chest) equipmentItems.push(equippedItems.chest);
            if (equippedItems.pants) equipmentItems.push(equippedItems.pants);
            total = skillValue + equipmentValue;
            break;
        case 'dodge':
            // CAMBIO: Añadido encadenamiento opcional `?.` para boots
            equipmentValue = equippedItems.boots?.stats?.dodge || 0;
            if (equippedItems.boots) equipmentItems.push(equippedItems.boots);
            total = skillValue + equipmentValue;
            break;
        case 'lootChance':
            total = skillValue;
            break;
    }
    return {
        skillValue,
        equipmentValue,
        equipmentItems,
        ammoPercent,
        buffPercent,
        total: parseFloat(total.toFixed(1))
    };
}

export function simulateFullCombat() {
    let totalDamageDealt = 0;
    let ticksSurvived = 0;
    let fullLog = [];
    let tempCurrentHealth = playerState.currentHealth;
    const MAX_TICKS = 1000;
    while (tempCurrentHealth > 0 && ticksSurvived < MAX_TICKS) {
        const tickResult = simulateCombatTick();
        tempCurrentHealth -= tickResult.healthLost;
        if (tempCurrentHealth >= 0 || (tempCurrentHealth < 0 && ticksSurvived === 0)) {
            totalDamageDealt += tickResult.finalDamageDealt;
        }
        ticksSurvived++;
        const healthAfterTick = Math.max(0, tempCurrentHealth).toFixed(1);
        fullLog.push(`--- Hit ${ticksSurvived} (Health: ${healthAfterTick}) ---`);
        fullLog.push(...tickResult.log);
    }
    if (ticksSurvived >= MAX_TICKS) {
        fullLog.push("--- SIMULATION STOPPED: Maximum number of hits reached. ---");
    }
    return {
        totalDamageDealt: parseFloat(totalDamageDealt.toFixed(1)),
        ticksSurvived,
        log: fullLog,
        finalHealth: Math.max(0, tempCurrentHealth)
    };
}

export function simulateFullCombatWithFood(foodItem) {
    let totalDamageDealt = 0;
    let ticksSurvived = 0;
    let fullLog = [];
    let tempCurrentHealth = playerState.currentHealth;
    let tempCurrentHunger = playerState.currentHunger;
    const healthPerFood = foodItem.flatStats.healthRegen || 0;
    const maxHealthFromSkills = getSkillData('health', playerState.skillLevelsAssigned.health)?.value || 50;
    const INCOMING_DAMAGE_PER_TICK = 10;
    const MAX_TICKS = 2000;
    fullLog.push(`--- Simulation started with ${foodItem.name} (+${healthPerFood} HP per hunger point) ---`);
    while (ticksSurvived < MAX_TICKS) {
        if (tempCurrentHealth <= INCOMING_DAMAGE_PER_TICK && tempCurrentHunger > 0 && healthPerFood > 0) {
            fullLog.push(`<strong>CRITICAL HEALTH!</strong> HP at ${tempCurrentHealth.toFixed(1)}. Attempting to eat.`);
            while (tempCurrentHunger > 0 && tempCurrentHealth <= INCOMING_DAMAGE_PER_TICK) {
                if (tempCurrentHealth >= maxHealthFromSkills) {
                    fullLog.push(`Stopped eating: health is full or overcharged (${tempCurrentHealth.toFixed(1)} / ${maxHealthFromSkills}).`);
                    break;
                }
                tempCurrentHunger--;
                const healthBeforeHeal = tempCurrentHealth;
                tempCurrentHealth += healthPerFood;
                fullLog.push(`<strong>ATE ${foodItem.name.toUpperCase()}!</strong> Healed for ${healthPerFood}. HP: ${healthBeforeHeal.toFixed(1)} -> ${tempCurrentHealth.toFixed(1)}. Hunger left: ${tempCurrentHunger}.`);
            }
        }
        if (tempCurrentHealth <= 0) {
            fullLog.push(`--- COMBAT ENDED: Player defeated. Not enough health to continue. ---`);
            break;
        }
        const tickResult = simulateCombatTick();
        const healthLostThisTick = tickResult.healthLost;
        tempCurrentHealth -= healthLostThisTick;
        totalDamageDealt += tickResult.finalDamageDealt;
        ticksSurvived++;
        const healthAfterDamage = tempCurrentHealth;
        let logEntry = `--- Hit ${ticksSurvived} | HP left: ${Math.max(0, healthAfterDamage).toFixed(1)} | Hunger: ${tempCurrentHunger} ---`;
        fullLog.push(logEntry);
        fullLog.push(...tickResult.log);
    }
    if (ticksSurvived >= MAX_TICKS) {
        fullLog.push("--- SIMULATION STOPPED: Maximum number of hits reached. ---");
    }
    return {
        totalDamageDealt: parseFloat(totalDamageDealt.toFixed(1)),
        ticksSurvived,
        log: fullLog,
        finalHealth: Math.max(0, tempCurrentHealth),
        finalHunger: tempCurrentHunger 
    };
}

export function simulateCombatTick() {
  const attackStats = calculateStatDetails('attack');
  const precisionStats = calculateStatDetails('precision');
  const critChanceStats = calculateStatDetails('criticalChance');
  const critDamageStats = calculateStatDetails('criticalDamages');
  const armorStats = calculateStatDetails('armor');
  const dodgeStats = calculateStatDetails('dodge');
  let log = [];
  let finalDamageDealt = 0;
  let healthLost = 10;
  const wasDodge = Math.random() * 100 < dodgeStats.total;
  if (wasDodge) {
      healthLost = 0;
      log.push('<strong>DODGE!</strong> No health was lost.');
  } else {
      const damageReduction = healthLost * (armorStats.total / 100);
      healthLost -= damageReduction;
      log.push(`<strong>ARMOR</strong> reduced health loss by ${damageReduction.toFixed(1)}.`);
  }
  let baseDamage = attackStats.total;
  log.push(`Base damage potential is ${baseDamage.toFixed(1)}.`);
  const wasHit = Math.random() * 100 < precisionStats.total;
  if (!wasHit) {
      baseDamage /= 2;
      log.push('<strong>MISS!</strong> Damage was halved.');
  } else {
      log.push('<strong>HIT!</strong> Full damage potential.');
  }
  const wasCritical = Math.random() * 100 < critChanceStats.total;
  if (wasCritical) {
      const critMultiplier = 1 + (critDamageStats.total / 100);
      const criticalDamageBonus = baseDamage * (critDamageStats.total / 100);
      finalDamageDealt = baseDamage * critMultiplier;
      log.push(`<strong>CRITICAL HIT!</strong> Damage multiplied by ${critMultiplier.toFixed(2)} (+${criticalDamageBonus.toFixed(1)}).`);
  } else {
      finalDamageDealt = baseDamage;
      log.push('Normal hit.');
  }
  return {
      finalDamageDealt: parseFloat(finalDamageDealt.toFixed(1)),
      healthLost: parseFloat(healthLost.toFixed(1)),
      log,
      wasCritical,
      wasHit,
      wasDodge,
  };
}