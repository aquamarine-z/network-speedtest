import { SpeedtestProvider, CustomApiProbeInput, CustomApiResponse } from './types'
import { SingleProbeResult, CarrierType } from '@/lib/types'
import { mapCityToProvince, PROVINCE_COORDINATES } from '@/lib/provinces'
import { identifyCarrier } from '@/lib/carrier'

function normalizeCarrier(
  carrierInput?: string,
  carrierName?: string,
  asn?: number,
  network?: string
): { carrier: CarrierType; name: string } {
  if (carrierInput) {
    const c = carrierInput.toLowerCase()
    if (c === 'telecom' || c.includes('电信')) return { carrier: 'telecom', name: carrierName || '中国电信' }
    if (c === 'unicom' || c.includes('联通')) return { carrier: 'unicom', name: carrierName || '中国联通' }
    if (c === 'mobile' || c.includes('移动')) return { carrier: 'mobile', name: carrierName || '中国移动' }
    if (c === 'edu' || c.includes('教育') || c.includes('科技')) return { carrier: 'edu', name: carrierName || '教育/科技网' }
    if (c === 'other' || c.includes('bgp') || c.includes('多线')) return { carrier: 'other', name: carrierName || 'BGP/多线' }
  }

  if (carrierName) {
    if (carrierName.includes('电信')) return { carrier: 'telecom', name: carrierName }
    if (carrierName.includes('联通')) return { carrier: 'unicom', name: carrierName }
    if (carrierName.includes('移动')) return { carrier: 'mobile', name: carrierName }
    if (carrierName.includes('教育') || carrierName.includes('科技')) return { carrier: 'edu', name: carrierName }
  }

  return identifyCarrier(asn || 0, network || carrierName || '')
}

export class CustomHttpProvider implements SpeedtestProvider {
  readonly id = 'custom'
  readonly name = '自定义 / 第三方测速 API'
  readonly description = '向配置的自建探针节点、ITDOG 代理或第三方测速服务发送请求获取实时探针数据。'

  private apiUrl: string
  private apiToken?: string
  private timeoutMs: number

  constructor(apiUrl: string, apiToken?: string, timeoutMs: number = 10000) {
    this.apiUrl = apiUrl.trim()
    this.apiToken = apiToken?.trim()
    this.timeoutMs = timeoutMs
  }

  async run(target: string, packets: number = 3): Promise<SingleProbeResult[]> {
    if (!this.apiUrl) {
      console.warn('[CustomHttpProvider] 未配置有效的 API URL，跳过执行。')
      return []
    }

    const cleanTarget = target.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    const validPackets = Math.min(Math.max(packets, 1), 10)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'China-Network-Speedtest/1.0',
      }
      if (this.apiToken) {
        headers['Authorization'] = `Bearer ${this.apiToken}`
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          target: cleanTarget,
          packets: validPackets,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        console.warn(`[CustomHttpProvider] 请求返回异常状态码: ${res.status} ${res.statusText}`)
        return []
      }

      const rawData = (await res.json()) as CustomApiResponse

      // 兼容 { probes: [...] } 与 直接数组 [...] 两种响应格式
      let probeList: CustomApiProbeInput[] = []
      if (Array.isArray(rawData)) {
        probeList = rawData
      } else if (rawData && Array.isArray(rawData.probes)) {
        probeList = rawData.probes
      } else {
        console.warn('[CustomHttpProvider] 返回数据格式无法识别，预期为探针数组。')
        return []
      }

      const timestamp = Date.now()
      return probeList
        .filter((item) => item && typeof item.avg === 'number' && item.city)
        .map((item, idx) => {
          const rawCity = item.city || item.province || '未知'
          const province = item.province || mapCityToProvince(rawCity)

          // 自动补齐经纬度
          const fallbackCoords = PROVINCE_COORDINATES[province] || [105.0, 35.0]
          const longitude = item.longitude !== undefined && !isNaN(item.longitude) ? item.longitude : fallbackCoords[0]
          const latitude = item.latitude !== undefined && !isNaN(item.latitude) ? item.latitude : fallbackCoords[1]

          // 自动推断运营商
          const carrierInfo = normalizeCarrier(item.carrier, item.carrierName, item.asn, item.network)

          const min = item.min !== undefined ? item.min : item.avg
          const max = item.max !== undefined ? item.max : item.avg
          const loss = item.loss !== undefined ? Math.min(Math.max(item.loss, 0), 100) : 0

          return {
            id: item.id || `custom-${timestamp}-${idx}`,
            probe: {
              city: rawCity,
              region: province,
              country: 'CN',
              asn: item.asn || 0,
              network: item.network || carrierInfo.name,
              latitude,
              longitude,
            },
            carrier: carrierInfo.carrier,
            carrierName: carrierInfo.name,
            status: item.status || 'finished',
            stats: {
              min: Math.round(min * 10) / 10,
              avg: Math.round(item.avg * 10) / 10,
              max: Math.round(max * 10) / 10,
              loss: Math.round(loss * 10) / 10,
              totalPackets: validPackets,
              rcvPackets: Math.round((validPackets * (100 - loss)) / 100),
            },
            rawOutput: item.rawOutput || `PING ${cleanTarget} avg=${item.avg}ms loss=${loss}%`,
          }
        })
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn(`[CustomHttpProvider] 请求超时 (${this.timeoutMs}ms)`)
      } else {
        console.error('[CustomHttpProvider] 请求失败:', err)
      }
      return []
    }
  }
}
