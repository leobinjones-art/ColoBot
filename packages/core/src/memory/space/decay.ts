/**
 * 语义空间记忆 - 间隔重复 + 艾宾浩斯衰减
 *
 * 记忆强度 = importance × (1 + log(1 + accessCount)) × e^(-decay × daysSinceLastAccess)
 *
 * 高频访问的记忆衰减慢 (间隔重复效应)
 * 低频访问的记忆逐渐淡出 (但不会删除，只是排序靠后)
 */

// ── 衰减计算 ──────────────────────────────────────────────

/**
 * 计算记忆当前强度
 */
export function memoryStrength(
  importance: number,
  accessCount: number,
  lastAccessed: number,
  decayRate: number = 0.01
): number {
  const daysSinceLastAccess = (Date.now() - lastAccessed) / (24 * 60 * 60 * 1000)
  const repetitionBonus = 1 + Math.log(1 + accessCount)
  const timeDecay = Math.exp(-decayRate * daysSinceLastAccess)
  return importance * repetitionBonus * timeDecay
}

/**
 * 批量计算记忆强度并排序
 */
export function rankByStrength<T extends { importance: number; accessCount: number; lastAccessed: number }>(
  items: T[],
  decayRate: number = 0.01
): Array<T & { strength: number }> {
  return items
    .map(item => ({
      ...item,
      strength: memoryStrength(item.importance, item.accessCount, item.lastAccessed, decayRate),
    }))
    .sort((a, b) => b.strength - a.strength)
}

/**
 * 判断记忆是否应该归档 (强度低于阈值)
 */
export function shouldArchive(
  importance: number,
  accessCount: number,
  lastAccessed: number,
  threshold: number = 0.05,
  decayRate: number = 0.01
): boolean {
  return memoryStrength(importance, accessCount, lastAccessed, decayRate) < threshold
}

/**
 * 计算下次复习时间 (间隔重复)
 *
 * 间隔 = baseInterval × (1 + accessCount)^growthFactor
 * 第1次: 1天, 第2次: 2.8天, 第3次: 5.2天, 第4次: 8天...
 */
export function nextReviewTime(
  accessCount: number,
  baseIntervalDays: number = 1,
  growthFactor: number = 1.5
): number {
  const intervalDays = baseIntervalDays * Math.pow(1 + accessCount, growthFactor)
  return Date.now() + intervalDays * 24 * 60 * 60 * 1000
}
