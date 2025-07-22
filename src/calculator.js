import { skillsData, playerState, MIN_SKILL_LEVEL, MAX_SKILL_LEVEL } from './state.js';

/**
 * Gets skill data for a specific level.
 * @param {string} skillCode - The unique skill code.
 * @param {number} level - The skill level.
 * @returns {object|null} The skill data or null.
 */
export function getSkillData(skillCode, level) {
  if (!skillsData || !skillsData.skills || !skillsData.skills[skillCode]) {
    return null;
  }
  const validLevel = Math.max(MIN_SKILL_LEVEL, Math.min(MAX_SKILL_LEVEL, level));
  return skillsData.skills[skillCode][validLevel.toString()];
}

/**
 * Calculates the detailed breakdown of a stat, including base, equipment, and buffs.
 * @param {string} skillCode - The code of the stat to calculate.
 * @returns {object} An object with the breakdown and total.
 */
export function calculateStatDetails(skillCode) {
    const currentSkillLevel = playerState.assignedSkillLevels[skillCode];
    const skillBaseInfo = getSkillData(skillCode, currentSkillLevel);
    const skillValue = skillBaseInfo ? skillBaseInfo.value : 0;

    let equipmentValue = 0;
    let equipmentItems = [];
    let ammoPercent = 0;
    let buffPercent = 0; // Placeholder for future buff system
    let total = skillValue;

    const { equippedItems } = playerState;

    switch (skillCode) {
        case 'attack':
            // REFACTORED: Read from playerState instead of MOCK
            equipmentValue = equippedItems.weapon?.stats?.attack || 0;
            if (equippedItems.weapon) equipmentItems.push(equippedItems.weapon);
            
            ammoPercent = equippedItems.ammo?.stats?.percentAttack || 0;
            // buffPercent will be handled later if a buff system is implemented
            
            total = (skillValue + equipmentValue) * (1 + (ammoPercent / 100) + (buffPercent / 100));
            break;
        case 'precision':
            equipmentValue = equippedItems.gloves?.stats?.precision || 0;
            if (equippedItems.gloves) equipmentItems.push(equippedItems.gloves);
            total = skillValue + equipmentValue;
            break;
        case 'criticalChance':
            // Also check weapon for critical chance
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
            // Assuming no equipment affects loot chance for now
            total = skillValue + equipmentValue;
            break;
    }

    return {
        skillValue,
        equipmentValue,
        equipmentItems, // Pass item info for tooltips
        ammoPercent,
        buffPercent,
        total: parseFloat(total.toFixed(1))
    };
}