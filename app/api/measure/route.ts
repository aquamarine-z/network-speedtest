import { NextRequest, NextResponse } from 'next/server'
import { providerRegistry } from '@/lib/providers'
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
  const config = await getSchedulerConfig()

  let latest = await getLatestMeasurementFromDb()
  if (!latest || latest.target !== config.targetNode) {
    latest = await providerRegistry.executeMeasurement(config.targetNode, config.pingPackets, {
      activeProvider: config.activeProvider,
      customApiUrl: config.customApiUrl,
      customApiToken: config.customApiToken,
    })
    if (latest.probes && latest.probes.length > 0) {
      await saveMeasurementToDb(latest)
      await updateLastRunTimestamp(latest.timestamp)
    }
  }

  const history = await getRecentHistory(100)
  const qualityTiers = await getQualityTiers()

  return NextResponse.json({
    latest,
    target: config.targetNode,
    history,
    config,
    qualityTiers,
  })
}

export async function POST(req: NextRequest) {
  try {
    const config = await getSchedulerConfig()

    const result = await providerRegistry.executeMeasurement(config.targetNode, config.pingPackets, {
      activeProvider: config.activeProvider,
      customApiUrl: config.customApiUrl,
      customApiToken: config.customApiToken,
    })
    await saveMeasurementToDb(result)
    await updateLastRunTimestamp(result.timestamp)

    const updatedConfig = await getSchedulerConfig()
    const history = await getRecentHistory(100)
    const qualityTiers = await getQualityTiers()

    return NextResponse.json({
      success: true,
      latest: result,
      target: updatedConfig.targetNode,
      history,
      config: updatedConfig,
      qualityTiers,
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
