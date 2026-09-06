import { getRotationUsedCities, saveRotationUsedCities } from './db'
import {
  DEFAULT_GUARANTEED_HUB_CITIES,
  DEFAULT_ROTATION_CANDIDATES,
  CITY_METADATA_MAP,
  getCityMeta,
  CityMeta,
} from './city-metadata'

export {
  DEFAULT_GUARANTEED_HUB_CITIES,
  DEFAULT_ROTATION_CANDIDATES,
  CITY_METADATA_MAP,
  getCityMeta,
}
export type { CityMeta }

// 保持向下兼容
export const GUARANTEED_HUB_CITIES = DEFAULT_GUARANTEED_HUB_CITIES
export const ROTATION_CANDIDATE_CITIES = DEFAULT_ROTATION_CANDIDATES

/**
 * 纯函数：随机洗牌算法 (Fisher-Yates)
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * 非抢占式公平抽样算法（无放回轮换）：
 * 每次抽样从当前周期未使用的城市中随机选取。
 * 保证本周期内被选中的城市在所有其他城市被选取完毕前不会重复被选（非抢占式）。
 */
export function selectRotatingCitiesCore(
  count: number,
  currentUsed: string[],
  allCandidates: readonly string[] = DEFAULT_ROTATION_CANDIDATES
): { selected: string[]; newUsed: string[] } {
  if (count <= 0) {
    return { selected: [], newUsed: currentUsed }
  }

  const pool = [...allCandidates]
  const available = pool.filter((c) => !currentUsed.includes(c))

  if (available.length >= count) {
    // 剩余未选城市充足，从 available 中洗牌挑选 count 个
    const shuffledAvailable = shuffleArray(available)
    const selected = shuffledAvailable.slice(0, count)
    const newUsed = [...currentUsed, ...selected]
    return { selected, newUsed }
  }

  // 剩余未选城市不足 count 个：
  // 1. 优先全部取完剩余未选城市（保证绝对非抢占，未抽过的优先抽完）
  const firstBatch = shuffleArray(available)
  const needed = Math.min(count - firstBatch.length, pool.length - firstBatch.length)

  // 2. 周期自然耗尽重置，从候选池中排除刚刚第一批的城市，开启新周期
  const newCyclePool = pool.filter((c) => !firstBatch.includes(c))
  const shuffledNewPool = shuffleArray(newCyclePool)
  const secondBatch = shuffledNewPool.slice(0, needed)

  const selected = [...firstBatch, ...secondBatch]
  const newUsed = secondBatch // 新周期中已抽取的城市

  return { selected, newUsed }
}

/**
 * 有状态包装：读取数据库轮询记录，计算本次抽取的城市并回写数据库
 */
export async function getNextRotatingCities(
  count: number,
  candidatePool: readonly string[] = DEFAULT_ROTATION_CANDIDATES
): Promise<string[]> {
  try {
    const usedCities = await getRotationUsedCities()
    const pool = candidatePool && candidatePool.length > 0 ? candidatePool : DEFAULT_ROTATION_CANDIDATES
    const { selected, newUsed } = selectRotatingCitiesCore(count, usedCities, pool)
    await saveRotationUsedCities(newUsed)
    return selected
  } catch (err) {
    console.error('[Rotation] 轮询状态读写异常，降级为无状态随机抽样:', err)
    const pool = candidatePool && candidatePool.length > 0 ? candidatePool : DEFAULT_ROTATION_CANDIDATES
    return shuffleArray([...pool]).slice(0, count)
  }
}
