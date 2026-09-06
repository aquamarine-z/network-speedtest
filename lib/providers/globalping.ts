import { SpeedtestProvider } from './types'
import { SingleProbeResult } from '@/lib/types'
import { identifyCarrier } from '@/lib/carrier'
import { getNextRotatingCities } from '@/lib/rotation'

const GLOBALPING_API = 'https://api.globalping.io/v1'

interface GlobalpingCreateResponse {
  id: string
}

interface GlobalpingProbeRaw {
  city?: string
  country?: string
  region?: string
  asn?: number
  network?: string
  latitude?: number
  longitude?: number
}

interface GlobalpingResultItemRaw {
  probe: GlobalpingProbeRaw
  result: {
    status: 'finished' | 'failed' | 'in-progress'
    rawOutput?: string
    stats?: {
      min?: number
      avg?: number
      max?: number
      loss?: number
      rcv?: number
      total?: number
    }
  }
}

interface GlobalpingMeasurementRaw {
  id: string
  type: string
  status: 'in-progress' | 'finished'
  target: string
  results: GlobalpingResultItemRaw[]
}

async function getAvailableProbeLimit(): Promise<number> {
  // 匿名单次调用上限设定为 45（官方匿名单次最大 50，设定 45 留出安全裕度）
  // 若配置了 API Key，则支持高达 80 个节点
  const MAX_TARGET_LIMIT = process.env.GLOBALPING_API_KEY ? 80 : 45

  try {
    const res = await fetch(`${GLOBALPING_API}/limits`, {
      headers: { 'User-Agent': 'China-Network-Speedtest/1.0' },
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      const remaining = data?.rateLimit?.measurements?.create?.remaining
      if (typeof remaining === 'number') {
        if (remaining <= 0) return 0
        return Math.min(MAX_TARGET_LIMIT, remaining)
      }
    }
  } catch {}
  return 42
}

import { getCityDispatchConfig } from '@/lib/db'

/**
 * 智能构建覆盖全国各省会与核心大区中心的探测位置列表：
 * 1. 核心大区中心 100% 保底覆盖（从管理员配置读取，默认 12 城市）
 * 2. 剩余城市非抢占式公平轮询（从管理员配置读取轮换候选池与单次抽取数量）
 * 3. 剩余配额分配至全国通用池，最大化有效节点捕获
 */
export async function buildTargetLocations(probeLimit: number): Promise<Array<{ city?: string; country?: string; limit: number }>> {
  const { guaranteedHubs, rotatingCandidates, rotationBatchSize, enableGeneralPool } = await getCityDispatchConfig()

  const locations: Array<{ city?: string; country?: string; limit: number }> = []

  // 1. 核心大区中心 100% 保底覆盖
  const hubAllocations = guaranteedHubs.slice(0, Math.min(guaranteedHubs.length, probeLimit))
  for (const city of hubAllocations) {
    locations.push({ city, limit: 1 })
  }

  let remainingQuota = Math.max(probeLimit - locations.length, 0)

  // 2. 剩余城市采用非抢占式公平轮询
  const desiredRotationCount = Math.min(rotationBatchSize, remainingQuota)
  if (desiredRotationCount > 0 && rotatingCandidates.length > 0) {
    const rotatingCities = await getNextRotatingCities(desiredRotationCount, rotatingCandidates)
    for (const city of rotatingCities) {
      locations.push({ city, limit: 1 })
    }
    remainingQuota = Math.max(probeLimit - locations.length, 0)
  }

  // 3. 仅当管理员开启「全国通用池」时，才将剩余配额分配给全国随机探针 (country: 'CN')
  // 默认关闭以节省额度，单次请求严格限定为 (保底 + 轮换) 节点数
  if (enableGeneralPool && remainingQuota > 0) {
    locations.push({
      country: 'CN',
      limit: remainingQuota,
    })
  }

  return locations
}

export class GlobalpingProvider implements SpeedtestProvider {
  readonly id = 'globalping'
  readonly name = 'Globalping 全球探针网络'
  readonly description = '基于全球开源社区探针网络，采集中国大陆真实在线机房与民用节点。'

  async run(target: string, packets: number = 3): Promise<SingleProbeResult[]> {
    const cleanTarget = target.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    const validPackets = Math.min(Math.max(packets, 1), 10)

    try {
      const probeLimit = await getAvailableProbeLimit()
      if (probeLimit <= 0) {
        console.warn('[GlobalpingProvider] 每小时免费配额耗尽，跳过该数据源。')
        return []
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'China-Network-Speedtest/1.0',
      }
      if (process.env.GLOBALPING_API_KEY) {
        headers['Authorization'] = `Bearer ${process.env.GLOBALPING_API_KEY}`
      }

      // 构建包含各核心大区中心的探测位置列表
      const locations = await buildTargetLocations(probeLimit)

      const postRes = await fetch(`${GLOBALPING_API}/measurements`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          target: cleanTarget,
          type: 'ping',
          locations,
          measurementOptions: {
            packets: validPackets,
          },
        }),
      })

      if (!postRes.ok) {
        console.warn(`[GlobalpingProvider] API returned status ${postRes.status}`)
        return []
      }

      const { id } = (await postRes.json()) as GlobalpingCreateResponse
      const startTime = Date.now()

      // 轮询等待完成（最多等待 12 秒）
      let measurementData: GlobalpingMeasurementRaw | null = null
      while (Date.now() - startTime < 12000) {
        await new Promise((resolve) => setTimeout(resolve, 800))
        const getRes = await fetch(`${GLOBALPING_API}/measurements/${id}`, {
          headers: {
            'User-Agent': 'China-Network-Speedtest/1.0',
          },
        })

        if (getRes.ok) {
          const data = (await getRes.json()) as GlobalpingMeasurementRaw
          measurementData = data
          if (data.status === 'finished') {
            break
          }
          if (data.results && data.results.length > 0 && data.results.every((r) => r.result.status !== 'in-progress')) {
            break
          }
        }
      }

      if (!measurementData || !measurementData.results || measurementData.results.length === 0) {
        return []
      }

      return measurementData.results.map((item, idx) => {
        const probe = item.probe
        const carrierInfo = identifyCarrier(probe.asn || 0, probe.network || '')
        const res = item.result
        const stats = res.stats

        return {
          id: `gp-${id}-${idx}`,
          probe: {
            city: probe.city || '未知城市',
            region: probe.region || '中国',
            country: 'CN',
            asn: probe.asn || 0,
            network: probe.network || 'Unknown',
            latitude: probe.latitude || 35.0,
            longitude: probe.longitude || 105.0,
          },
          carrier: carrierInfo.carrier,
          carrierName: carrierInfo.name,
          status: res.status,
          stats: stats
            ? {
                min: stats.min ?? 0,
                avg: stats.avg ?? 0,
                max: stats.max ?? 0,
                loss: stats.loss ?? 0,
                totalPackets: stats.total ?? validPackets,
                rcvPackets: stats.rcv ?? validPackets,
              }
            : null,
          rawOutput: res.rawOutput,
        }
      })
    } catch (err) {
      console.error('[GlobalpingProvider] 探测执行失败:', err)
      return []
    }
  }
}
