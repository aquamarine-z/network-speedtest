import { MeasurementResult, HistoryRecord } from './types'

// 内存历史存储（在 Serverless 实例生命周期内保留，支持外部 DB 替换）
let inMemoryHistory: HistoryRecord[] = []
let latestMeasurement: MeasurementResult | null = null

export const storage = {
  saveMeasurement(result: MeasurementResult): void {
    latestMeasurement = result

    const historyEntry: HistoryRecord = {
      id: result.id,
      target: result.target,
      timestamp: result.timestamp,
      overallAvgLatency: result.overallAvgLatency,
      overallLossRate: result.overallLossRate,
      telecomAvg: result.carriers.telecom.avgLatency,
      unicomAvg: result.carriers.unicom.avgLatency,
      mobileAvg: result.carriers.mobile.avgLatency,
      probesCount: result.successfulProbes,
    }

    inMemoryHistory.unshift(historyEntry)
    // 最多保留 100 条历史
    if (inMemoryHistory.length > 100) {
      inMemoryHistory = inMemoryHistory.slice(0, 100)
    }
  },

  getLatest(): MeasurementResult | null {
    return latestMeasurement
  },

  getHistory(): HistoryRecord[] {
    return inMemoryHistory
  },

  clear(): void {
    inMemoryHistory = []
    latestMeasurement = null
  },
}
