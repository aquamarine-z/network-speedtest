import { NextRequest, NextResponse } from 'next/server'
import { providerRegistry } from '@/lib/providers'
import { startBackgroundScheduler } from '@/lib/scheduler-daemon'
import {
  getSchedulerConfig,
  updateLastRunTimestamp,
  getLatestMeasurementFromDb,
  saveMeasurementToDb,
  getRecentHistory,
  clearAllHistory,
  getQualityTiers,
} from '@/lib/db'

export async function GET() {
  startBackgroundScheduler()
  const config = await getSchedulerConfig()
  const now = Date.now()

  let latest = await getLatestMeasurementFromDb()

  // 1. 无数据；2. 目标域名变更；3. 定时巡检时刻已到达或超期
  if (!latest || latest.target !== config.targetNode || now >= config.nextRunTimestamp) {
    const result = await providerRegistry.executeMeasurement(config.targetNode, config.pingPackets, {
      activeProvider: config.activeProvider,
      customApiUrl: config.customApiUrl,
      customApiToken: config.customApiToken,
    })
    if (result.probes && result.probes.length > 0) {
      await saveMeasurementToDb(result)
      await updateLastRunTimestamp(result.timestamp)
      latest = result
    }
  }

  const history = await getRecentHistory(100)
  const qualityTiers = await getQualityTiers()
  const updatedConfig = await getSchedulerConfig()

  return NextResponse.json({
    latest,
    target: updatedConfig.targetNode,
    history,
    config: updatedConfig,
    qualityTiers,
  })
}

export async function POST(req: NextRequest) {
  startBackgroundScheduler()
  try {
    const config = await getSchedulerConfig()

    const result = await providerRegistry.executeMeasurement(config.targetNode, config.pingPackets, {
      activeProvider: config.activeProvider,
      customApiUrl: config.customApiUrl,
      customApiToken: config.customApiToken,
    })

    if (result && result.successfulProbes > 0) {
      await saveMeasurementToDb(result)
      await updateLastRunTimestamp(result.timestamp)
    } else {
      console.warn('[API /api/measure POST] 测量返回 0 个探针，不推进调度周期')
    }

    const updatedConfig = await getSchedulerConfig()
    const history = await getRecentHistory(100)
    const qualityTiers = await getQualityTiers()
    const fallbackLatest = (await getLatestMeasurementFromDb()) || result

    return NextResponse.json({
      success: result.successfulProbes > 0,
      latest: result.successfulProbes > 0 ? result : fallbackLatest,
      target: updatedConfig.targetNode,
      history,
      config: updatedConfig,
      qualityTiers,
      error: result.successfulProbes === 0 ? '测速未返回有效探针数据（可能接口超时或频控）' : undefined,
    })
  } catch (error: unknown) {
    console.error('API /api/measure error:', error)
    const message = error instanceof Error ? error.message : '测量执行异常'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE() {
  await clearAllHistory()
  return NextResponse.json({ success: true, message: 'History cleared' })
}
