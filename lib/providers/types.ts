import { SingleProbeResult } from '@/lib/types'

/**
 * 自定义/第三方 API 接收的单探针简易入参结构
 * 保持极高宽容度：支持中文/英文城市名，经纬度和运营商为可选项
 */
export interface CustomApiProbeInput {
  id?: string
  city: string
  province?: string
  carrier?: 'telecom' | 'unicom' | 'mobile' | 'edu' | 'other' | string
  carrierName?: string
  asn?: number
  network?: string
  latitude?: number
  longitude?: number
  status?: 'finished' | 'failed' | 'in-progress'
  avg: number
  min?: number
  max?: number
  loss?: number
  rawOutput?: string
}

/**
 * 自定义 API 预期的响应格式（支持对象包体或直接数组）
 */
export type CustomApiResponse =
  | {
      probes: CustomApiProbeInput[]
      target?: string
    }
  | CustomApiProbeInput[]

/**
 * 测速服务提供者核心抽象接口
 */
export interface SpeedtestProvider {
  /** 唯一标识符，例如 'globalping' | 'custom' */
  readonly id: string

  /** 人类可读名称 */
  readonly name: string

  /** 提供者功能简述 */
  readonly description: string

  /**
   * 执行一次网络探测，返回该数据源所采集到的所有真实探针明细
   */
  run(target: string, packets: number): Promise<SingleProbeResult[]>
}

/**
 * 数据源运行时配置
 */
export interface ProviderConfig {
  /** 测速模式: 'globalping' (仅官方全球探针) | 'custom' (仅自定义API) | 'all' (双路并发聚合) */
  activeProvider: 'globalping' | 'custom' | 'all'

  /** 自定义 API 地址 */
  customApiUrl?: string

  /** 自定义 API 鉴权密钥 (可选) */
  customApiToken?: string

  /** 请求超时时间 (毫秒，默认 10000) */
  customApiTimeoutMs?: number
}
