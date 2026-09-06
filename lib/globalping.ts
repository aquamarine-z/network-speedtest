import { CarrierType, MeasurementResult, SingleProbeResult, CarrierSummary } from './types'
import { mapCityToProvince } from './provinces'

// 运营商智能识别
export { identifyCarrier } from './carrier'

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

export function createEmptyMeasurement(target: string): MeasurementResult {
  const timestamp = Date.now()
  const d = new Date(timestamp)
  const formattedTime = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`

  const emptyCarriers: Record<CarrierType, CarrierSummary> = {
    telecom: { carrier: 'telecom', name: '中国电信', probeCount: 0, avgLatency: 0, avgLoss: 0, minLatency: 0, maxLatency: 0 },
    unicom: { carrier: 'unicom', name: '中国联通', probeCount: 0, avgLatency: 0, avgLoss: 0, minLatency: 0, maxLatency: 0 },
    mobile: { carrier: 'mobile', name: '中国移动', probeCount: 0, avgLatency: 0, avgLoss: 0, minLatency: 0, maxLatency: 0 },
    edu: { carrier: 'edu', name: '教育/科技网', probeCount: 0, avgLatency: 0, avgLoss: 0, minLatency: 0, maxLatency: 0 },
    other: { carrier: 'other', name: 'BGP/多线', probeCount: 0, avgLatency: 0, avgLoss: 0, minLatency: 0, maxLatency: 0 },
  }

  return {
    id: `meas-empty-${timestamp}`,
    target,
    timestamp,
    formattedTime,
    overallAvgLatency: 0,
    overallLossRate: 0,
    minLatency: 0,
    maxLatency: 0,
    totalProbes: 0,
    successfulProbes: 0,
    probes: [],
    carriers: emptyCarriers,
  }
}

export function aggregateMeasurement(
  id: string,
  target: string,
  timestamp: number,
  probes: SingleProbeResult[]
): MeasurementResult {
  const validProbes = probes.filter((p) => p.status === 'finished' && p.stats !== null && typeof p.stats.avg === 'number' && p.stats.avg >= 0)
  const total = validProbes.length

  let sumLatency = 0
  let sumLoss = 0
  let minLat = 99999
  let maxLat = 0

  const carrierBuckets: Record<CarrierType, { name: string; latSum: number; lossSum: number; count: number; min: number; max: number }> = {
    telecom: { name: '中国电信', latSum: 0, lossSum: 0, count: 0, min: 9999, max: 0 },
    unicom: { name: '中国联通', latSum: 0, lossSum: 0, count: 0, min: 9999, max: 0 },
    mobile: { name: '中国移动', latSum: 0, lossSum: 0, count: 0, min: 9999, max: 0 },
    edu: { name: '教育/科技网', latSum: 0, lossSum: 0, count: 0, min: 9999, max: 0 },
    other: { name: 'BGP/多线', latSum: 0, lossSum: 0, count: 0, min: 9999, max: 0 },
  }

  for (const p of validProbes) {
    const s = p.stats!
    sumLatency += s.avg
    sumLoss += s.loss
    if (s.min < minLat) minLat = s.min
    if (s.max > maxLat) maxLat = s.max

    const b = carrierBuckets[p.carrier] || carrierBuckets.other
    b.latSum += s.avg
    b.lossSum += s.loss
    b.count += 1
    if (s.min < b.min) b.min = s.min
    if (s.max > b.max) b.max = s.max
  }

  const carriers: Record<CarrierType, CarrierSummary> = {
    telecom: {
      carrier: 'telecom',
      name: carrierBuckets.telecom.name,
      probeCount: carrierBuckets.telecom.count,
      avgLatency: carrierBuckets.telecom.count > 0 ? Math.round((carrierBuckets.telecom.latSum / carrierBuckets.telecom.count) * 10) / 10 : 0,
      avgLoss: carrierBuckets.telecom.count > 0 ? Math.round((carrierBuckets.telecom.lossSum / carrierBuckets.telecom.count) * 10) / 10 : 0,
      minLatency: carrierBuckets.telecom.count > 0 ? carrierBuckets.telecom.min : 0,
      maxLatency: carrierBuckets.telecom.count > 0 ? carrierBuckets.telecom.max : 0,
    },
    unicom: {
      carrier: 'unicom',
      name: carrierBuckets.unicom.name,
      probeCount: carrierBuckets.unicom.count,
      avgLatency: carrierBuckets.unicom.count > 0 ? Math.round((carrierBuckets.unicom.latSum / carrierBuckets.unicom.count) * 10) / 10 : 0,
      avgLoss: carrierBuckets.unicom.count > 0 ? Math.round((carrierBuckets.unicom.lossSum / carrierBuckets.unicom.count) * 10) / 10 : 0,
      minLatency: carrierBuckets.unicom.count > 0 ? carrierBuckets.unicom.min : 0,
      maxLatency: carrierBuckets.unicom.count > 0 ? carrierBuckets.unicom.max : 0,
    },
    mobile: {
      carrier: 'mobile',
      name: carrierBuckets.mobile.name,
      probeCount: carrierBuckets.mobile.count,
      avgLatency: carrierBuckets.mobile.count > 0 ? Math.round((carrierBuckets.mobile.latSum / carrierBuckets.mobile.count) * 10) / 10 : 0,
      avgLoss: carrierBuckets.mobile.count > 0 ? Math.round((carrierBuckets.mobile.lossSum / carrierBuckets.mobile.count) * 10) / 10 : 0,
      minLatency: carrierBuckets.mobile.count > 0 ? carrierBuckets.mobile.min : 0,
      maxLatency: carrierBuckets.mobile.count > 0 ? carrierBuckets.mobile.max : 0,
    },
    edu: {
      carrier: 'edu',
      name: carrierBuckets.edu.name,
      probeCount: carrierBuckets.edu.count,
      avgLatency: carrierBuckets.edu.count > 0 ? Math.round((carrierBuckets.edu.latSum / carrierBuckets.edu.count) * 10) / 10 : 0,
      avgLoss: carrierBuckets.edu.count > 0 ? Math.round((carrierBuckets.edu.lossSum / carrierBuckets.edu.count) * 10) / 10 : 0,
      minLatency: carrierBuckets.edu.count > 0 ? carrierBuckets.edu.min : 0,
      maxLatency: carrierBuckets.edu.count > 0 ? carrierBuckets.edu.max : 0,
    },
    other: {
      carrier: 'other',
      name: carrierBuckets.other.name,
      probeCount: carrierBuckets.other.count,
      avgLatency: carrierBuckets.other.count > 0 ? Math.round((carrierBuckets.other.latSum / carrierBuckets.other.count) * 10) / 10 : 0,
      avgLoss: carrierBuckets.other.count > 0 ? Math.round((carrierBuckets.other.lossSum / carrierBuckets.other.count) * 10) / 10 : 0,
      minLatency: carrierBuckets.other.count > 0 ? carrierBuckets.other.min : 0,
      maxLatency: carrierBuckets.other.count > 0 ? carrierBuckets.other.max : 0,
    },
  }

  const d = new Date(timestamp)
  const formattedTime = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`

  return {
    id,
    target,
    timestamp,
    formattedTime,
    overallAvgLatency: total > 0 ? Math.round((sumLatency / total) * 10) / 10 : 0,
    overallLossRate: total > 0 ? Math.round((sumLoss / total) * 10) / 10 : 0,
    minLatency: minLat === 99999 ? 0 : minLat,
    maxLatency: maxLat,
    totalProbes: probes.length,
    successfulProbes: total,
    probes,
    carriers,
  }
}

import { GlobalpingProvider, buildTargetLocations } from './providers/globalping'
export { buildTargetLocations }

/**
 * 执行真实的 Globalping 探测任务（100% 真实在线探针，绝不生成任何模拟/虚假探针）
 */
export async function runGlobalpingMeasurement(target: string, packets: number = 3): Promise<MeasurementResult> {
  const cleanTarget = target.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const validPackets = Math.min(Math.max(packets, 1), 10)

  try {
    const provider = new GlobalpingProvider()
    const realProbes = await provider.run(cleanTarget, validPackets)

    if (!realProbes || realProbes.length === 0) {
      return createEmptyMeasurement(cleanTarget)
    }

    return aggregateMeasurement(`gp-${Date.now()}`, cleanTarget, Date.now(), realProbes)
  } catch (err) {
    console.error('Failed to run Globalping measurement:', err)
    return createEmptyMeasurement(cleanTarget)
  }
}

