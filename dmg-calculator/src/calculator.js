// --- START OF FILE src/calculator.js (CORRECTED) ---

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
    const currentSkillLevel = playerState.assignedSkillLevels[skillCode];
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
            equipmentValue = equippedItems.weapon?.stats?.attack || 0;
            if (equippedItems.weapon) equipmentItems.push(equippedItems.weapon);
            ammoPercent = activeBuffs.ammo?.stats?.percentAttack || 0;
            buffPercent = activeBuffs.consumable?.stats?.percentAttack || 0;
            total = (skillValue + equipmentValue) * (1 + (ammoPercent / 100) + (buffPercent / 100));
            break;
        case 'precision':
            equipmentValue = equippedItems.gloves?.stats?.precision || 0;
            if (equippedItems.gloves) equipmentItems.push(equippedItems.gloves);
            total = skillValue + equipmentValue;
            break;
        case 'criticalChance':
            equipmentValue = (equippedItems.weapon?.stats?.criticalChance || 0);
            if (equippedItems.weapon) equipmentItems.push(equippedItems.weapon);
            total = skillValue + equipmentValue;
            break;
        case 'criticalDamages':
            equipmentValue = equippedItems.helmet?.stats?.criticalDamages || 0;
            if (equippedItems.helmet) equipmentItems.push(equippedItems.helmet);
            total = skillValue + equipmentValue;
            break;
        case 'armor':
            const chestArmor = equippedItems.chest?.stats?.armor || 0;
            const pantsArmor = equippedItems.pants?.stats?.armor || 0;
            equipmentValue = chestArmor + pantsArmor;
            if (equippedItems.chest) equipmentItems.push(equippedItems.chest);
            if (equippedItems.pants) equipmentItems.push(equippedItems.pants);
            total = skillValue + equipmentValue;
            break;
        case 'dodge':
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
    // Esta función ahora es un wrapper simple sin comida.
    // La nueva lógica estará en simulateFullCombatWithFood
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


// NUEVA FUNCIÓN PARA LA SIMULACIÓN CON COMIDA
export function simulateFullCombatWithFood(foodItem) {
    let totalDamageDealt = 0;
    let ticksSurvived = 0;
    let fullLog = [];
    
    let tempCurrentHealth = playerState.currentHealth;
    let tempCurrentHunger = playerState.currentHunger;

    const healthPerFood = foodItem.flatStats.healthRegen || 0;
    const maxHealthFromSkills = getSkillData('health', playerState.assignedSkillLevels.health)?.value || 50;
    const INCOMING_DAMAGE_PER_TICK = 10; // Daño base que se recibe por golpe

    const MAX_TICKS = 2000;

    fullLog.push(`--- Simulation started with ${foodItem.name} (+${healthPerFood} HP per hunger point) ---`);

    while (ticksSurvived < MAX_TICKS) {
        // --- COMIENZO DEL NUEVO FLUJO LÓGICO ---

        // 1. VERIFICACIÓN DE PÁNICO Y CONSUMO DE COMIDA (ANTES DE RECIBIR EL GOLPE)
        // Si la vida es críticamente baja Y el personaje puede comer, entra en un bucle de consumo.
        if (tempCurrentHealth <= INCOMING_DAMAGE_PER_TICK && tempCurrentHunger > 0 && healthPerFood > 0) {
            fullLog.push(`<strong>CRITICAL HEALTH!</strong> HP at ${tempCurrentHealth.toFixed(1)}. Attempting to eat.`);
            
            // Bucle de consumo: comer hasta estar seguro o no poder más.
            while (tempCurrentHunger > 0 && tempCurrentHealth <= INCOMING_DAMAGE_PER_TICK) {
                // Guarda de seguridad para la regla de sobrecuración: no comer si la vida ya es >= maxHealth
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
        
        // 2. VERIFICACIÓN DE FIN DE COMBATE
        // Si después de intentar comer, la vida sigue siendo insuficiente para sobrevivir el próximo golpe, el combate termina.
        if (tempCurrentHealth <= 0) {
            fullLog.push(`--- COMBAT ENDED: Player defeated. Not enough health to continue. ---`);
            break;
        }

        // 3. EJECUCIÓN DEL TICK DE COMBATE (Hacer y recibir daño)
        const tickResult = simulateCombatTick(); // Esta función ya calcula el daño recibido y hecho.
        
        // Aplicar el daño recibido en este tick
        const healthLostThisTick = tickResult.healthLost;
        tempCurrentHealth -= healthLostThisTick;
        
        // Sumar el daño infligido en este tick
        totalDamageDealt += tickResult.finalDamageDealt;
        ticksSurvived++;

        // 4. REGISTRO DEL LOG
        const healthAfterDamage = tempCurrentHealth;
        let logEntry = `--- Hit ${ticksSurvived} | HP left: ${Math.max(0, healthAfterDamage).toFixed(1)} | Hunger: ${tempCurrentHunger} ---`;
        fullLog.push(logEntry);
        fullLog.push(...tickResult.log); // Añadir los detalles del golpe (miss, critical, etc.)

        // Si la vida llega a 0 después de este golpe, el siguiente bucle lo detectará y terminará el combate.
    }

    if (ticksSurvived >= MAX_TICKS) {
        fullLog.push("--- SIMULATION STOPPED: Maximum number of hits reached. ---");
    }

    return {
        totalDamageDealt: parseFloat(totalDamageDealt.toFixed(1)),
        ticksSurvived,
        log: fullLog,
        finalHealth: Math.max(0, tempCurrentHealth),
        // CORRECCIÓN: Añadir el hambre restante al objeto de retorno.
        finalHunger: tempCurrentHunger 
    };
}

// FIX: Removed duplicate. This is the single, correct definition.
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