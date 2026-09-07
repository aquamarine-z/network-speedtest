import { getSchedulerConfig, updateLastRunTimestamp, saveMeasurementToDb } from './db'
import { providerRegistry } from './providers'

const globalDaemon = globalThis as unknown as {
  __speedtest_daemon_started?: boolean
  __speedtest_is_measuring?: boolean
}

/**
 * 启动服务端后台常驻自动巡检调度器
 * 确保即使没有浏览器标签页处于打开状态，服务端也能准时自动执行巡检
 */
export function startBackgroundScheduler(): void {
  if (globalDaemon.__speedtest_daemon_started || typeof window !== 'undefined') {
    return
  }
  globalDaemon.__speedtest_daemon_started = true

  console.log('[Scheduler Daemon] 服务端常驻自动巡检任务已启动')

  // 每 3 秒扫描一次是否满足触发时间
  setInterval(async () => {
    if (globalDaemon.__speedtest_is_measuring) {
      return
    }

    try {
      const config = await getSchedulerConfig()
      const now = Date.now()

      // 判断是否已到达或超出预定巡检时刻
      if (now >= config.nextRunTimestamp) {
        globalDaemon.__speedtest_is_measuring = true
        console.log(`[Scheduler Daemon] 触发定时巡检 (${new Date().toLocaleTimeString()}): 目标 ${config.targetNode}`)

        const result = await providerRegistry.executeMeasurement(config.targetNode, config.pingPackets, {
          activeProvider: config.activeProvider,
          customApiUrl: config.customApiUrl,
          customApiToken: config.customApiToken,
        })

        if (result && result.successfulProbes > 0) {
          await saveMeasurementToDb(result)
          await updateLastRunTimestamp(result.timestamp)
          console.log(`[Scheduler Daemon] 定时巡检成功: 捕获 ${result.successfulProbes} 个有效节点，综合延时 ${result.overallAvgLatency}ms`)
        } else {
          console.warn('[Scheduler Daemon] 定时巡检未返回有效探针数据，暂不推进周期，15 秒后重试')
          // 将 lastRunTimestamp 设为距离现在 15 秒后到期，以便快速重试，避免跳过 30 分钟大周期
          await updateLastRunTimestamp(now - config.intervalSeconds * 1000 + 15 * 1000)
        }
      }
    } catch (err) {
      console.error('[Scheduler Daemon] 后台巡检任务执行异常:', err)
    } finally {
      globalDaemon.__speedtest_is_measuring = false
    }
  }, 3000)
}
