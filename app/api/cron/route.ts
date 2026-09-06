import { NextRequest, NextResponse } from 'next/server'
import { runGlobalpingMeasurement } from '@/lib/globalping'
import { getTargetNode, saveMeasurementToDb, getAutoMergePolicy, executeAutoMergePolicy } from '@/lib/db'

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}

async function handleCron(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const querySecret = searchParams.get('secret')
  const authHeader = req.headers.get('authorization')
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

  const envSecret = process.env.CRON_SECRET

  if (envSecret && querySecret !== envSecret && bearerSecret !== envSecret) {
    return NextResponse.json({ error: 'Unauthorized: Invalid CRON_SECRET' }, { status: 401 })
  }

  try {
    const target = await getTargetNode()
    console.log(`[CRON] 定时巡检执行，目标: ${target}`)

    const result = await runGlobalpingMeasurement(target)
    await saveMeasurementToDb(result)

    // 检查并异步执行每日历史数据合并降采样策略（每日触发一次）
    try {
      const autoPolicy = await getAutoMergePolicy()
      if (autoPolicy.enabled) {
        const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000
        const lastRun = autoPolicy.lastRunTimestamp || 0
        if (Date.now() - lastRun > TWENTY_HOURS_MS) {
          console.log('[CRON] 触发历史数据智能合并降采样策略...')
          executeAutoMergePolicy().catch((err) => console.error('[CRON] 自动合并失败:', err))
        }
      }
    } catch (e) {
      console.error('[CRON] 自动合并检查异常:', e)
    }

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      target,
      probesCount: result.successfulProbes,
      avgLatency: result.overallAvgLatency,
      lossRate: result.overallLossRate,
    })
  } catch (error: unknown) {
    console.error('[CRON] 定时任务执行失败:', error)
    const msg = error instanceof Error ? error.message : 'Cron test execution failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
