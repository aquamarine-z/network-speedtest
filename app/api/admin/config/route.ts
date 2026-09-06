import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth, verifyAdminPassword } from '@/lib/auth'
import {
  getSchedulerConfig,
  setSchedulerConfig,
  getDbStats,
  pruneExpiredData,
  clearAllHistory,
  deleteDataBefore,
  vacuumDatabase,
  formatBytes,
  getCityDispatchConfig,
  setCityDispatchConfig,
  resetRotationCycle,
  resetCityDispatchToDefaults,
  getQualityTiers,
  setQualityTiers,
  resetQualityTiersToDefault,
  setAdminPassword,
  getAutoMergePolicy,
  setAutoMergePolicy,
  mergeHistoryData,
  executeAutoMergePolicy,
} from '@/lib/db'
import { providerRegistry } from '@/lib/providers'
import { CITY_METADATA_MAP } from '@/lib/city-metadata'

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ success: false, error: '未授权：请先登录管理员账号' }, { status: 401 })
  }

  const config = await getSchedulerConfig()
  const stats = await getDbStats()
  const cityDispatch = await getCityDispatchConfig()
  const qualityTiers = await getQualityTiers()
  const autoMergePolicy = await getAutoMergePolicy()

  return NextResponse.json({
    success: true,
    target: config.targetNode,
    config,
    stats,
    qualityTiers,
    autoMergePolicy,
    cityDispatch: {
      ...cityDispatch,
      knownMetadata: CITY_METADATA_MAP,
    },
  })
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ success: false, error: '未授权：请先登录管理员账号' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      target,
      intervalSeconds,
      scheduleMode,
      pingPackets,
      activeProvider,
      customApiUrl,
      customApiToken,
      action,
      guaranteedHubs,
      rotatingCandidates,
      rotationBatchSize,
      enableGeneralPool,
      qualityTiers,
      autoMergePolicy,
    } = body

    if (action === 'test_custom_api') {
      const urlToTest = typeof customApiUrl === 'string' ? customApiUrl : ''
      const tokenToTest = typeof customApiToken === 'string' ? customApiToken : undefined
      const targetToTest = typeof target === 'string' && target.trim() ? target.trim() : '1.1.1.1'

      const testRes = await providerRegistry.testCustomApi(urlToTest, tokenToTest, targetToTest)
      return NextResponse.json({
        success: testRes.success,
        probesCount: testRes.probesCount,
        probes: testRes.probes,
        error: testRes.error,
      })
    }

    if (action === 'reset_rotation_cycle') {
      await resetRotationCycle()
      const cityDispatch = await getCityDispatchConfig()
      return NextResponse.json({
        success: true,
        message: '已成功重置当前城市轮换周期状态',
        cityDispatch: {
          ...cityDispatch,
          knownMetadata: CITY_METADATA_MAP,
        },
      })
    }

    if (action === 'reset_city_defaults') {
      await resetCityDispatchToDefaults()
      const cityDispatch = await getCityDispatchConfig()
      return NextResponse.json({
        success: true,
        message: '已恢复城市调度策略为官方推荐默认配置（12 保底 + 34 轮换）',
        cityDispatch: {
          ...cityDispatch,
          knownMetadata: CITY_METADATA_MAP,
        },
      })
    }

    if (action === 'reset_quality_tiers') {
      await resetQualityTiersToDefault()
      const updatedTiers = await getQualityTiers()
      return NextResponse.json({
        success: true,
        message: '已恢复网络质量档位为官方推荐默认标准',
        qualityTiers: updatedTiers,
      })
    }

    if (action === 'delete_before') {
      const { cutoffTimestamp, days, date } = body
      let targetCutoff = 0

      if (typeof cutoffTimestamp === 'number' && cutoffTimestamp > 0) {
        targetCutoff = cutoffTimestamp
      } else if (typeof days === 'number' && days > 0) {
        targetCutoff = Date.now() - days * 24 * 60 * 60 * 1000
      } else if (typeof date === 'string' && date.trim()) {
        const parsed = new Date(date.trim()).getTime()
        if (!isNaN(parsed)) {
          targetCutoff = parsed
        }
      }

      if (targetCutoff <= 0) {
        return NextResponse.json({ success: false, error: '请提供有效的清理截止时间戳、天数或日期' }, { status: 400 })
      }

      const res = await deleteDataBefore(targetCutoff)
      const freedStr = res.freedBytes > 0 ? `，释放约 ${formatBytes(res.freedBytes)} 物理空间` : ''
      const cutoffDateStr = new Date(targetCutoff).toLocaleDateString('zh-CN')

      return NextResponse.json({
        success: true,
        message: `成功清理 ${cutoffDateStr} 以前的 ${res.deletedMeasurements} 轮巡检及 ${res.deletedProbes} 条探针记录${freedStr}`,
        stats: res.newStats,
      })
    }

    if (action === 'vacuum') {
      const res = await vacuumDatabase()
      const freedStr = res.freedBytes > 0 ? `释放约 ${formatBytes(res.freedBytes)} 物理空间` : '数据库已处于最佳紧凑状态'
      return NextResponse.json({
        success: true,
        message: `数据库碎片整理完成！${freedStr}`,
        stats: res.newStats,
      })
    }

    if (action === 'prune') {
      const removed = await pruneExpiredData()
      const stats = await getDbStats()
      return NextResponse.json({ success: true, message: `成功清理 ${removed} 条过期数据`, stats })
    }

    if (action === 'clear_all') {
      await clearAllHistory()
      const stats = await getDbStats()
      return NextResponse.json({ success: true, message: '已成功清空所有历史检测与探针记录并释放磁盘空间', stats })
    }

    if (action === 'save_auto_merge_policy') {
      const { policy } = body
      if (!policy || typeof policy !== 'object') {
        return NextResponse.json({ success: false, error: '无效的自动合并策略配置' }, { status: 400 })
      }
      const updatedPolicy = await setAutoMergePolicy(policy)
      return NextResponse.json({
        success: true,
        message: '每日历史数据自动合并策略已成功保存',
        autoMergePolicy: updatedPolicy,
      })
    }

    if (action === 'run_auto_merge') {
      const { policy } = body
      if (policy && typeof policy === 'object') {
        await setAutoMergePolicy(policy)
      }
      const result = await executeAutoMergePolicy()
      const updatedPolicy = await getAutoMergePolicy()
      return NextResponse.json({
        success: true,
        message: result.message,
        result,
        stats: result.newStats,
        autoMergePolicy: updatedPolicy,
      })
    }

    if (action === 'manual_merge') {
      const { dateDay, startDate, endDate, pointsPerDay } = body
      const parsedPoints = typeof pointsPerDay === 'number' ? pointsPerDay : parseInt(String(pointsPerDay || '24'), 10)
      if (isNaN(parsedPoints) || parsedPoints < 1 || parsedPoints > 144) {
        return NextResponse.json({ success: false, error: '每天等分时间点数必须为 1 ~ 144 之间的整数' }, { status: 400 })
      }

      const result = await mergeHistoryData({
        dateDay: typeof dateDay === 'string' && dateDay.trim() ? dateDay.trim() : undefined,
        startDate: typeof startDate === 'string' && startDate.trim() ? startDate.trim() : undefined,
        endDate: typeof endDate === 'string' && endDate.trim() ? endDate.trim() : undefined,
        pointsPerDay: parsedPoints,
      })

      return NextResponse.json({
        success: true,
        message: result.message,
        result,
        stats: result.newStats,
      })
    }

    if (action === 'change_password') {
      const { oldPassword, newPassword } = body
      if (!oldPassword || !newPassword) {
        return NextResponse.json({ success: false, error: '请提供当前原密码与设定新密码' }, { status: 400 })
      }
      const isValid = await verifyAdminPassword(oldPassword)
      if (!isValid) {
        return NextResponse.json({ success: false, error: '原管理密码输入错误，无法完成修改' }, { status: 400 })
      }
      if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
        return NextResponse.json({ success: false, error: '新管理密码长度不能少于 6 位字符' }, { status: 400 })
      }
      await setAdminPassword(newPassword.trim())
      return NextResponse.json({
        success: true,
        message: '管理员后台密码已成功修改！后续登录请使用新密码。',
      })
    }

    // 更新常规调度与数据源配置
    const updatedConfig = await setSchedulerConfig({
      targetNode: typeof target === 'string' && target.trim() !== '' ? target.trim() : undefined,
      intervalSeconds: typeof intervalSeconds === 'number' ? intervalSeconds : undefined,
      scheduleMode: scheduleMode === 'interval' || scheduleMode === 'aligned' ? scheduleMode : undefined,
      pingPackets: typeof pingPackets === 'number' ? pingPackets : undefined,
      activeProvider: activeProvider === 'globalping' || activeProvider === 'custom' || activeProvider === 'all' ? activeProvider : undefined,
      customApiUrl: typeof customApiUrl === 'string' ? customApiUrl : undefined,
      customApiToken: typeof customApiToken === 'string' ? customApiToken : undefined,
    })

    // 更新城市保底与轮换调度配置（若请求中有提供）
    if (guaranteedHubs !== undefined || rotatingCandidates !== undefined || rotationBatchSize !== undefined || enableGeneralPool !== undefined) {
      await setCityDispatchConfig({
        guaranteedHubs: Array.isArray(guaranteedHubs) ? guaranteedHubs.map(String) : undefined,
        rotatingCandidates: Array.isArray(rotatingCandidates) ? rotatingCandidates.map(String) : undefined,
        rotationBatchSize: typeof rotationBatchSize === 'number' ? rotationBatchSize : undefined,
        enableGeneralPool: typeof enableGeneralPool === 'boolean' ? enableGeneralPool : undefined,
      })
    }

    // 更新网络质量档位规则（若请求中有提供）
    if (qualityTiers !== undefined && Array.isArray(qualityTiers)) {
      await setQualityTiers(qualityTiers)
    }

    // 更新历史数据每日自动合并策略（若请求中有提供）
    if (autoMergePolicy !== undefined && typeof autoMergePolicy === 'object') {
      await setAutoMergePolicy(autoMergePolicy)
    }

    const stats = await getDbStats()
    const cityDispatch = await getCityDispatchConfig()
    const updatedQualityTiers = await getQualityTiers()
    const updatedAutoMergePolicy = await getAutoMergePolicy()

    return NextResponse.json({
      success: true,
      message: '系统调度、城市配额、网络质量档位与自动合并策略配置已成功更新',
      target: updatedConfig.targetNode,
      config: updatedConfig,
      stats,
      qualityTiers: updatedQualityTiers,
      autoMergePolicy: updatedAutoMergePolicy,
      cityDispatch: {
        ...cityDispatch,
        knownMetadata: CITY_METADATA_MAP,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '更新配置失败'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
