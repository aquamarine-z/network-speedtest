export type PresetQualityColor = 'emerald' | 'blue' | 'amber' | 'orange' | 'rose' | 'purple' | 'gray'
export type QualityColor = PresetQualityColor | 'custom'

export interface NetworkQualityTier {
  id: string
  label: string            // 档位名称，如 "极速"、"良好"、"拥塞 / 丢包"
  color: QualityColor      // 预设语义色彩或 'custom'
  customColor?: string     // 十六进制自定义色值，如 "#8b5cf6"
  minLatency?: number      // 延时下限 (ms)，默认为 0
  maxLatency: number | null // 延时上限 (ms)，null 表示无上限
  minLoss?: number         // 丢包下限 (%)，默认为 0
  maxLoss: number | null   // 丢包上限 (%)，null 表示无上限
  description?: string     // 档位描述说明
}

export interface QualityColorTheme {
  key: QualityColor
  label: string
  hex: string
  isCustom?: boolean
  dotClass: string
  badgeClass: string
  fillClass: string
  hoverFillClass: string
  strokeClass: string
  textClass: string
  borderClass: string
}

export const QUALITY_COLOR_THEMES: Record<PresetQualityColor, QualityColorTheme> = {
  emerald: {
    key: 'emerald',
    label: '翠绿 (极速)',
    hex: '#10b981',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    fillClass: 'fill-emerald-500/20 dark:fill-emerald-500/25',
    hoverFillClass: 'fill-emerald-500/35 dark:fill-emerald-500/40',
    strokeClass: 'stroke-emerald-400/90 dark:stroke-emerald-500/90',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-500/40',
  },
  blue: {
    key: 'blue',
    label: '深蓝 (优良)',
    hex: '#0066cc',
    dotClass: 'bg-[#0066cc] dark:bg-[#2997ff]',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    fillClass: 'fill-blue-500/20 dark:fill-blue-500/25',
    hoverFillClass: 'fill-blue-500/35 dark:fill-blue-500/40',
    strokeClass: 'stroke-blue-400/90 dark:stroke-blue-500/90',
    textClass: 'text-blue-600 dark:text-blue-400',
    borderClass: 'border-blue-500/40',
  },
  amber: {
    key: 'amber',
    label: '琥珀黄 (良好)',
    hex: '#f59e0b',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    fillClass: 'fill-amber-500/20 dark:fill-amber-500/25',
    hoverFillClass: 'fill-amber-500/35 dark:fill-amber-500/40',
    strokeClass: 'stroke-amber-400/90 dark:stroke-amber-500/90',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500/40',
  },
  orange: {
    key: 'orange',
    label: '暖橙 (轻微延迟)',
    hex: '#f97316',
    dotClass: 'bg-orange-500',
    badgeClass: 'bg-orange-500/10 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
    fillClass: 'fill-orange-500/20 dark:fill-orange-500/25',
    hoverFillClass: 'fill-orange-500/35 dark:fill-orange-500/40',
    strokeClass: 'stroke-orange-400/90 dark:stroke-orange-500/90',
    textClass: 'text-orange-600 dark:text-orange-400',
    borderClass: 'border-orange-500/40',
  },
  rose: {
    key: 'rose',
    label: '玫瑰红 (拥塞/高丢包)',
    hex: '#f43f5e',
    dotClass: 'bg-rose-500',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
    fillClass: 'fill-rose-500/20 dark:fill-rose-500/25',
    hoverFillClass: 'fill-rose-500/35 dark:fill-rose-500/40',
    strokeClass: 'stroke-rose-400/90 dark:stroke-rose-500/90',
    textClass: 'text-rose-600 dark:text-rose-400',
    borderClass: 'border-rose-500/40',
  },
  purple: {
    key: 'purple',
    label: '典雅紫 (专线/告警)',
    hex: '#a855f7',
    dotClass: 'bg-purple-500',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
    fillClass: 'fill-purple-500/20 dark:fill-purple-500/25',
    hoverFillClass: 'fill-purple-500/35 dark:fill-purple-500/40',
    strokeClass: 'stroke-purple-400/90 dark:stroke-purple-500/90',
    textClass: 'text-purple-600 dark:text-purple-400',
    borderClass: 'border-purple-500/40',
  },
  gray: {
    key: 'gray',
    label: '中性灰 (未覆盖/异常)',
    hex: '#9ca3af',
    dotClass: 'bg-neutral-400',
    badgeClass: 'bg-neutral-200/60 text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-400',
    fillClass: 'fill-neutral-200/40 dark:fill-[#1b1b1e]/85',
    hoverFillClass: 'fill-neutral-300/60 dark:fill-[#26262a]',
    strokeClass: 'stroke-neutral-300/60 dark:stroke-neutral-800/80',
    textClass: 'text-neutral-500 dark:text-neutral-400',
    borderClass: 'border-neutral-300',
  },
}

export const DEFAULT_QUALITY_TIERS: NetworkQualityTier[] = [
  {
    id: 'tier-1',
    label: '极速',
    color: 'emerald',
    minLatency: 0,
    maxLatency: 60,
    minLoss: 0,
    maxLoss: 0,
    description: '骨干直连，0% 丢包且时延 ≤ 60ms',
  },
  {
    id: 'tier-2',
    label: '良好',
    color: 'amber',
    minLatency: 0,
    maxLatency: 120,
    minLoss: 0,
    maxLoss: 5,
    description: '网络通畅，丢包 ≤ 5% 且时延 ≤ 120ms',
  },
  {
    id: 'tier-3',
    label: '拥塞 / 丢包',
    color: 'rose',
    minLatency: 0,
    maxLatency: null,
    minLoss: 0,
    maxLoss: null,
    description: '时延超过 120ms 或丢包率超过 5%（底线兜底档）',
  },
]

export function getQualityColorTheme(color?: QualityColor, customColor?: string): QualityColorTheme {
  if (color === 'custom' || (!color && customColor)) {
    const validHex = customColor && /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(customColor)
      ? customColor
      : '#6366f1'
    return {
      key: 'custom',
      label: `自定义 (${validHex})`,
      hex: validHex,
      isCustom: true,
      dotClass: '',
      badgeClass: 'border border-black/[0.08] dark:border-white/[0.1] shadow-2xs',
      fillClass: '',
      hoverFillClass: '',
      strokeClass: '',
      textClass: '',
      borderClass: '',
    }
  }

  if (color && QUALITY_COLOR_THEMES[color]) {
    return QUALITY_COLOR_THEMES[color]
  }
  return QUALITY_COLOR_THEMES.emerald
}

/**
 * 格式化时延判定区间
 */
export function formatLatencyRange(tier: NetworkQualityTier): string {
  const min = typeof tier.minLatency === 'number' ? tier.minLatency : 0
  const max = tier.maxLatency
  if (max === null) {
    return min > 0 ? `> ${min} ms (无上限)` : '无限制'
  }
  if (min === 0) {
    return `≤ ${max} ms`
  }
  return `${min} ~ ${max} ms`
}

/**
 * 格式化丢包率判定区间
 */
export function formatLossRange(tier: NetworkQualityTier): string {
  const min = typeof tier.minLoss === 'number' ? tier.minLoss : 0
  const max = tier.maxLoss
  if (max === null) {
    return min > 0 ? `> ${min}% (无上限)` : '无限制'
  }
  if (min === 0 && max === 0) {
    return '0% (零丢包)'
  }
  if (min === 0) {
    return `≤ ${max}%`
  }
  return `${min}% ~ ${max}%`
}

/**
 * 从上往下严格级联匹配，返回首个两项条件同时达标的档位
 */
export function matchNetworkQuality(
  latency: number,
  loss: number,
  tiers: NetworkQualityTier[] = DEFAULT_QUALITY_TIERS
): NetworkQualityTier {
  if (!tiers || tiers.length === 0) {
    return DEFAULT_QUALITY_TIERS[DEFAULT_QUALITY_TIERS.length - 1]
  }

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]
    const minLat = typeof tier.minLatency === 'number' ? tier.minLatency : 0
    const maxLat = typeof tier.maxLatency === 'number' ? tier.maxLatency : Infinity
    const minLs = typeof tier.minLoss === 'number' ? tier.minLoss : 0
    const maxLs = typeof tier.maxLoss === 'number' ? tier.maxLoss : Infinity

    const isLastFallback = i === tiers.length - 1 && tier.maxLatency === null && tier.maxLoss === null

    if (isLastFallback) {
      return tier
    }

    const latOk = latency >= minLat && latency <= maxLat
    const lossOk = loss >= minLs && loss <= maxLs

    if (latOk && lossOk) {
      return tier
    }
  }

  // 兜底返回最后一个规则
  return tiers[tiers.length - 1]
}

/**
 * 依据时延指标匹配预设网络质量档位
 */
export function matchLatencyTier(
  latency: number,
  tiers: NetworkQualityTier[] = DEFAULT_QUALITY_TIERS
): NetworkQualityTier {
  if (!tiers || tiers.length === 0) {
    return DEFAULT_QUALITY_TIERS[DEFAULT_QUALITY_TIERS.length - 1]
  }

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]
    const minLat = typeof tier.minLatency === 'number' ? tier.minLatency : 0
    const maxLat = typeof tier.maxLatency === 'number' ? tier.maxLatency : Infinity

    const isLastFallback = i === tiers.length - 1 && tier.maxLatency === null
    if (isLastFallback) {
      return tier
    }

    if (latency >= minLat && latency <= maxLat) {
      return tier
    }
  }

  return tiers[tiers.length - 1]
}

/**
 * 依据丢包率指标匹配预设网络质量档位
 */
export function matchLossTier(
  loss: number,
  tiers: NetworkQualityTier[] = DEFAULT_QUALITY_TIERS
): NetworkQualityTier {
  if (!tiers || tiers.length === 0) {
    return DEFAULT_QUALITY_TIERS[DEFAULT_QUALITY_TIERS.length - 1]
  }

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]
    const minLs = typeof tier.minLoss === 'number' ? tier.minLoss : 0
    const maxLs = typeof tier.maxLoss === 'number' ? tier.maxLoss : Infinity

    const isLastFallback = i === tiers.length - 1 && tier.maxLoss === null
    if (isLastFallback) {
      return tier
    }

    if (loss >= minLs && loss <= maxLs) {
      return tier
    }
  }

  return tiers[tiers.length - 1]
}

export interface MatchStepTrace {
  tierIndex: number
  tier: NetworkQualityTier
  latOk: boolean
  lossOk: boolean
  matched: boolean
  reason: string
}

/**
 * 实时沙盘模拟器辅助函数：模拟从上至下逐条判定的完整链路与原因说明
 */
export function simulateTierMatching(
  latency: number,
  loss: number,
  tiers: NetworkQualityTier[] = DEFAULT_QUALITY_TIERS
): { matchedTier: NetworkQualityTier; trace: MatchStepTrace[] } {
  const trace: MatchStepTrace[] = []

  if (!tiers || tiers.length === 0) {
    const fallback = DEFAULT_QUALITY_TIERS[DEFAULT_QUALITY_TIERS.length - 1]
    return { matchedTier: fallback, trace }
  }

  let finalMatched: NetworkQualityTier = tiers[tiers.length - 1]

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]
    const minLat = typeof tier.minLatency === 'number' ? tier.minLatency : 0
    const maxLat = typeof tier.maxLatency === 'number' ? tier.maxLatency : Infinity
    const minLs = typeof tier.minLoss === 'number' ? tier.minLoss : 0
    const maxLs = typeof tier.maxLoss === 'number' ? tier.maxLoss : Infinity

    const isLastFallback = i === tiers.length - 1 && tier.maxLatency === null && tier.maxLoss === null

    if (isLastFallback) {
      trace.push({
        tierIndex: i + 1,
        tier,
        latOk: true,
        lossOk: true,
        matched: true,
        reason: '作为最终底线规则，自动兜底承接所有未匹配流量',
      })
      finalMatched = tier
      break
    }

    const latOk = latency >= minLat && latency <= maxLat
    const lossOk = loss >= minLs && loss <= maxLs

    if (latOk && lossOk) {
      trace.push({
        tierIndex: i + 1,
        tier,
        latOk: true,
        lossOk: true,
        matched: true,
        reason: `时延 ${latency}ms 满足 [${minLat}~${maxLat === Infinity ? '∞' : maxLat}ms]，且丢包 ${loss}% 满足 [${minLs}~${maxLs === Infinity ? '∞' : maxLs}%]`,
      })
      finalMatched = tier
      break
    } else {
      const reasons: string[] = []
      if (!latOk) {
        reasons.push(`时延 ${latency}ms 不在 [${minLat}~${maxLat === Infinity ? '∞' : maxLat}ms] 范围内`)
      }
      if (!lossOk) {
        reasons.push(`丢包率 ${loss}% 不在 [${minLs}~${maxLs === Infinity ? '∞' : maxLs}%] 范围内`)
      }
      trace.push({
        tierIndex: i + 1,
        tier,
        latOk,
        lossOk,
        matched: false,
        reason: `${reasons.join('，')} ➔ 规则未命中，级联向下检测`,
      })
    }
  }

  return { matchedTier: finalMatched, trace }
}
