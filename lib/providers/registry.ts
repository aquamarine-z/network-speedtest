import { SpeedtestProvider, ProviderConfig } from './types'
import { GlobalpingProvider } from './globalping'
import { CustomHttpProvider } from './custom-http'
import { SingleProbeResult, MeasurementResult } from '@/lib/types'
import { aggregateMeasurement, createEmptyMeasurement } from '@/lib/globalping'

export class ProviderRegistry {
  private globalpingProvider = new GlobalpingProvider()

  /**
   * 根据当前系统配置，执行全网测速并聚合最终结果
   */
  async executeMeasurement(
    target: string,
    packets: number = 3,
    config: ProviderConfig
  ): Promise<MeasurementResult> {
    const cleanTarget = target.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    const activeMode = config.activeProvider || 'globalping'
    const timestamp = Date.now()

    const providersToRun: SpeedtestProvider[] = []

    if (activeMode === 'globalping' || activeMode === 'all') {
      providersToRun.push(this.globalpingProvider)
    }

    if (activeMode === 'custom' || activeMode === 'all') {
      if (config.customApiUrl) {
        providersToRun.push(
          new CustomHttpProvider(
            config.customApiUrl,
            config.customApiToken,
            config.customApiTimeoutMs || 10000
          )
        )
      } else if (activeMode === 'custom') {
        console.warn('[ProviderRegistry] 当前设定为仅自定义 API，但未提供 customApiUrl')
      }
    }

    // 并行触发所有启用的数据源
    const results = await Promise.allSettled(
      providersToRun.map((p) => p.run(cleanTarget, packets))
    )

    const allProbes: SingleProbeResult[] = []
    results.forEach((res, idx) => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        allProbes.push(...res.value)
      } else if (res.status === 'rejected') {
        console.error(`[ProviderRegistry] 数据源 ${providersToRun[idx].name} 运行异常:`, res.reason)
      }
    })

    if (allProbes.length === 0) {
      return createEmptyMeasurement(cleanTarget)
    }

    const measurementId = `meas-${timestamp}-${Math.random().toString(36).substring(2, 7)}`
    return aggregateMeasurement(measurementId, cleanTarget, timestamp, allProbes)
  }

  /**
   * 测试自定义 API 连通性并返回探针列表或错误信息
   */
  async testCustomApi(
    url: string,
    token?: string,
    target: string = '1.1.1.1'
  ): Promise<{ success: boolean; probesCount: number; probes: SingleProbeResult[]; error?: string }> {
    try {
      const provider = new CustomHttpProvider(url, token, 8000)
      const probes = await provider.run(target, 2)
      return {
        success: probes.length > 0,
        probesCount: probes.length,
        probes,
        error: probes.length === 0 ? '接口未返回有效探针数据或响应为空' : undefined,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '连接请求异常'
      return {
        success: false,
        probesCount: 0,
        probes: [],
        error: message,
      }
    }
  }
}

export const providerRegistry = new ProviderRegistry()
