"use client"

import * as React from "react"
import { useNetworkStore } from "@/store/useNetworkStore"
import { Timer, RefreshCw, Zap, Radio, Globe, Copy, Check, Clock } from "lucide-react"
import { formatDuration } from "@/lib/utils"
import { matchLatencyTier, matchLossTier, getQualityColorTheme } from "@/lib/quality-tiers"
import { t } from "@/locales"

export function NetworkHeroOverview() {
  const {
    targetNode,
    schedulerConfig,
    isMeasuring,
    runMeasurement,
    fetchLatest,
    latestResult,
    qualityTiers,
    error,
  } = useNetworkStore()

  const [remainingSec, setRemainingSec] = React.useState<number>(0)
  const [progress, setProgress] = React.useState<number>(0)
  const [copied, setCopied] = React.useState(false)
  const isTriggeringRef = React.useRef(false)

  const intervalSeconds = schedulerConfig?.intervalSeconds || 60
  const scheduleMode = schedulerConfig?.scheduleMode || "aligned"
  const pingPackets = schedulerConfig?.pingPackets || 3
  const nextRunTimestamp = schedulerConfig?.nextRunTimestamp || 0
  const lastRunTimestamp = schedulerConfig?.lastRunTimestamp || Date.now()

  React.useEffect(() => {
    let lastSec = -1

    const updateCountdown = () => {
      if (!nextRunTimestamp) return

      const now = Date.now()
      const diffMs = nextRunTimestamp - now
      const secLeft = Math.max(0, Math.ceil(diffMs / 1000))

      if (secLeft !== lastSec) {
        lastSec = secLeft
        setRemainingSec(secLeft)
      }

      const totalSpanMs = Math.max(nextRunTimestamp - lastRunTimestamp, intervalSeconds * 1000)
      const elapsedMs = Math.max(0, now - (nextRunTimestamp - totalSpanMs))
      const pct = Math.min(100, Math.max(0, (elapsedMs / totalSpanMs) * 100))
      setProgress(pct)

      if (secLeft <= 0 && !isMeasuring && !isTriggeringRef.current) {
        isTriggeringRef.current = true
        void runMeasurement().finally(() => {
          setTimeout(() => {
            isTriggeringRef.current = false
          }, 2000)
        })
      }
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 100)
    return () => clearInterval(timer)
  }, [nextRunTimestamp, lastRunTimestamp, intervalSeconds, isMeasuring, runMeasurement])

  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchLatest()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    // 前台定时心跳同步（每 20 秒检查一次后端常驻守护线程产出的新数据）
    const syncTimer = setInterval(() => {
      if (document.visibilityState === "visible" && !isMeasuring) {
        void fetchLatest()
      }
    }, 20000)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearInterval(syncTimer)
    }
  }, [fetchLatest, isMeasuring])

  const handleCopyTarget = () => {
    if (!targetNode) return
    navigator.clipboard.writeText(targetNode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const formatTime = (seconds: number) => {
    if (seconds >= 86400) {
      const d = Math.floor(seconds / 86400)
      const h = Math.floor((seconds % 86400) / 3600)
      return `${d}${t.common.units.days} ${h}${t.common.units.hours}`
    }
    if (seconds >= 3600) {
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      return `${h}${t.common.units.hours} ${m}${t.common.units.minutes}`
    }
    if (seconds >= 60) {
      const m = Math.floor(seconds / 60)
      const s = seconds % 60
      return `${m}${t.common.units.minutes} ${s.toString().padStart(2, "0")}${t.common.units.seconds}`
    }
    return `${seconds} ${t.common.units.seconds}`
  }

  const avg = latestResult?.overallAvgLatency ?? 0
  const loss = latestResult?.overallLossRate ?? 0
  const carriers = latestResult?.carriers

  const latTier = matchLatencyTier(avg, qualityTiers)
  const latTheme = getQualityColorTheme(latTier.color, latTier.customColor)

  const lossTier = matchLossTier(loss, qualityTiers)
  const lossTheme = getQualityColorTheme(lossTier.color, lossTier.customColor)

  return (
    <div className="relative overflow-hidden rounded-3xl border border-black/[0.06] bg-white/80 p-5 sm:p-6 apple-card-shadow backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#1c1c1e]/80 transition-all duration-200 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff] shrink-0">
            <Globe className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 shrink-0">
              {t.hero.monitoringTarget}
            </span>
            <button
              type="button"
              onClick={handleCopyTarget}
              title={t.hero.copyTargetTooltip}
              className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.04] dark:hover:bg-white/[0.08] transition-colors min-w-0"
            >
              <span className="font-mono text-xs sm:text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 truncate">
                {targetNode || t.hero.unconfiguredTarget}
              </span>
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500 shrink-0" />
              ) : (
                <Copy className="h-3 w-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100/90 dark:bg-neutral-800/90 px-3 py-1 text-xs text-neutral-700 dark:text-neutral-200 border border-black/[0.04] dark:border-white/[0.06]">
            {isMeasuring ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0066cc] dark:text-[#2997ff]" />
                <span className="font-medium text-[#0066cc] dark:text-[#2997ff]">{t.hero.measuring}</span>
              </>
            ) : (
              <>
                <Timer className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-neutral-400 dark:text-neutral-500">{t.hero.nextRun}</span>
                <span className="font-mono font-bold text-[#0066cc] dark:text-[#2997ff]">
                  {formatTime(remainingSec)}
                </span>
              </>
            )}
          </div>

          {error && !isMeasuring && (
            <div
              className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 px-2.5 py-1 text-[11px] border border-rose-200 dark:border-rose-900/50 max-w-[240px]"
              title={error}
            >
              <span className="truncate">{error}</span>
            </div>
          )}

          <div className="hidden md:inline-flex items-center gap-1 rounded-full bg-neutral-100/60 dark:bg-neutral-800/50 px-2.5 py-1 text-[11px] text-neutral-500 dark:text-neutral-400 border border-black/[0.03] dark:border-white/[0.04]">
            <Clock className="h-3 w-3 text-neutral-400" />
            <span>{scheduleMode === "aligned" ? t.hero.alignedMode : t.hero.intervalMode}</span>
            <span className="font-mono text-neutral-400">({formatDuration(intervalSeconds)})</span>
          </div>

          <div className="hidden lg:inline-flex items-center gap-1 rounded-full bg-neutral-100/60 dark:bg-neutral-800/50 px-2.5 py-1 text-[11px] text-neutral-500 dark:text-neutral-400 border border-black/[0.03] dark:border-white/[0.04]">
            <Zap className="h-3 w-3 text-amber-500" />
            <span>{pingPackets} {t.hero.pingPackets}</span>
          </div>
        </div>
      </div>

      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800/80">
        <div
          className={`h-full rounded-full ${
            isMeasuring
              ? "w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 animate-pulse"
              : progress < 1
              ? "bg-[#0066cc] dark:bg-[#2997ff] transition-none"
              : "bg-[#0066cc] dark:bg-[#2997ff] transition-[width] duration-100 ease-linear"
          }`}
          style={{ width: isMeasuring ? "100%" : `${progress}%` }}
        />
      </div>

      {!latestResult ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl border border-black/[0.04] bg-neutral-50/50 dark:border-white/[0.05] dark:bg-neutral-900/30 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="relative overflow-hidden rounded-2xl border border-black/[0.04] bg-neutral-50/70 p-4 dark:border-white/[0.05] dark:bg-neutral-900/40 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t.hero.compositeLatency}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  latTheme.isCustom ? "" : latTheme.badgeClass
                }`}
                style={
                  latTheme.isCustom
                    ? { backgroundColor: `${latTheme.hex}1a`, color: latTheme.hex }
                    : undefined
                }
              >
                {latTier.label}
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span
                className="text-3xl sm:text-4xl font-semibold tracking-tight font-mono"
                style={latTheme.isCustom ? { color: latTheme.hex } : undefined}
              >
                <span className={latTheme.isCustom ? "" : latTheme.textClass}>
                  {avg.toFixed(1)}
                </span>
              </span>
              <span className="text-sm font-medium text-neutral-400">{t.common.ms}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500 font-mono">
              {t.hero.extremeRange} {latestResult.minLatency}{t.common.ms} ~ {latestResult.maxLatency}{t.common.ms}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-black/[0.04] bg-neutral-50/70 p-4 dark:border-white/[0.05] dark:bg-neutral-900/40 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t.hero.networkLossRate}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  lossTheme.isCustom ? "" : lossTheme.badgeClass
                }`}
                style={
                  lossTheme.isCustom
                    ? { backgroundColor: `${lossTheme.hex}1a`, color: lossTheme.hex }
                    : undefined
                }
              >
                {lossTier.label}
              </span>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span
                className="text-3xl sm:text-4xl font-semibold tracking-tight font-mono"
                style={lossTheme.isCustom ? { color: lossTheme.hex } : undefined}
              >
                <span className={lossTheme.isCustom ? "" : lossTheme.textClass}>
                  {loss.toFixed(1)}
                </span>
              </span>
              <span className="text-sm font-medium text-neutral-400">{t.common.percent}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500 font-mono">
              {t.hero.responsiveNodes} {latestResult.successfulProbes} / {latestResult.totalProbes}
            </p>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-black/[0.04] bg-neutral-50/70 p-4 dark:border-white/[0.05] dark:bg-neutral-900/40 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t.hero.carrierLatency}
              </span>
              <Zap className="h-3.5 w-3.5 text-[#0066cc] dark:text-[#2997ff]" />
            </div>
            <div className="mt-2.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                  {t.carrier.telecom}
                </span>
                <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100 text-[11px]">
                  {carriers && carriers.telecom?.probeCount > 0 ? `${carriers.telecom.avgLatency}${t.common.ms}` : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                  {t.carrier.unicom}
                </span>
                <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100 text-[11px]">
                  {carriers && carriers.unicom?.probeCount > 0 ? `${carriers.unicom.avgLatency}${t.common.ms}` : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 shrink-0" />
                  {t.carrier.mobile}
                </span>
                <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100 text-[11px]">
                  {carriers && carriers.mobile?.probeCount > 0 ? `${carriers.mobile.avgLatency}${t.common.ms}` : "-"}
                </span>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-black/[0.04] bg-neutral-50/70 p-4 dark:border-white/[0.05] dark:bg-neutral-900/40 transition-all hover:bg-neutral-50 dark:hover:bg-neutral-900/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                {t.hero.activeProbes}
              </span>
              <Radio className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-semibold tracking-tight font-mono text-neutral-900 dark:text-neutral-100">
                {latestResult.successfulProbes}
              </span>
              <span className="text-sm font-medium text-neutral-400">{t.hero.probesOnline}</span>
            </div>
            <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
              {t.hero.coverageSummary}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
