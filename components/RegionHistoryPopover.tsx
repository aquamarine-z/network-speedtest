"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { dialog, SurfaceDialogContent } from "@/components/ui/surface"
import { Calendar, MapPin, AlertCircle, Layers } from "lucide-react"
import {
  RegionLatencyChart,
  groupRegionRecordsByRun,
  type ChartTimeRange,
  type GroupedRegionRun,
} from "@/components/RegionLatencyChart"
import { getCarrierTheme } from "@/lib/carrier"
import { ProvinceDailyStat } from "@/lib/types"
import { t } from "@/locales"

interface ProbeLogRecord {
  id: string
  measurement_id?: string
  province: string
  city: string
  carrier: string
  carrier_name: string
  latency_avg: number | null
  latency_min: number | null
  latency_max: number | null
  loss: number
  timestamp: number
  date_day: string
}

function RegionHistoryDialogView({
  province,
  close,
}: {
  province: string
  close: (result?: void) => Promise<void>
}) {
  const [dates, setDates] = React.useState<string[]>([])
  const [activeDate, setActiveDate] = React.useState<string>("")
  const [records, setRecords] = React.useState<ProbeLogRecord[]>([])
  const [dailyStats, setDailyStats] = React.useState<ProvinceDailyStat[]>([])
  const [chartTimeRange, setChartTimeRange] = React.useState<ChartTimeRange>("7d")
  const [loading, setLoading] = React.useState(true)

  // 按单次全国巡检聚合批次
  const groupedRuns = React.useMemo(() => {
    return groupRegionRecordsByRun(records)
  }, [records])

  // 明细列表倒序展示（最新巡检批次居上）
  const listRuns = React.useMemo(() => {
    return [...groupedRuns].reverse()
  }, [groupedRuns])

  // 当进入弹窗时，拉取历史可用日期、当天数据与 30 天日均聚合
  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/history?province=${encodeURIComponent(province)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setDates(data.dates || [])
          setActiveDate(data.selectedDate || "")
          setRecords(data.records || [])
          setDailyStats(data.dailyStats || [])
        }
      })
      .catch((e) => console.error("Failed to load history:", e))
      .finally(() => setLoading(false))
  }, [province])

  // 切换日期
  const handleDateChange = (date: string) => {
    if (date === activeDate) return
    setActiveDate(date)
    setLoading(true)
    fetch(`/api/history?province=${encodeURIComponent(province)}&date=${encodeURIComponent(date)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRecords(data.records || [])
          if (data.dailyStats && data.dailyStats.length > 0) {
            setDailyStats(data.dailyStats)
          }
        }
      })
      .catch((e) => console.error("Failed to load history for date:", e))
      .finally(() => setLoading(false))
  }

  // 计算当日平均延迟与极值区间
  const validRecords = records.filter((r) => r.latency_avg !== null && r.latency_avg > 0)
  const dayAvg =
    validRecords.length > 0
      ? Math.round(
          (validRecords.reduce((acc, r) => acc + (r.latency_avg || 0), 0) / validRecords.length) * 10
        ) / 10
      : 0

  const minLatency = React.useMemo(() => {
    if (validRecords.length === 0) return null
    const val = Math.min(
      ...validRecords.map((r) =>
        r.latency_min !== null && r.latency_min !== undefined && r.latency_min > 0
          ? r.latency_min
          : r.latency_avg || 999
      )
    )
    return val === 999 ? null : Math.round(val * 10) / 10
  }, [validRecords])

  const maxLatency = React.useMemo(() => {
    if (validRecords.length === 0) return null
    const val = Math.max(
      ...validRecords.map((r) =>
        r.latency_max !== null && r.latency_max !== undefined && r.latency_max > 0
          ? r.latency_max
          : r.latency_avg || 0
      )
    )
    return val === 0 ? null : Math.round(val * 10) / 10
  }, [validRecords])

  return (
    <SurfaceDialogContent
      className="w-[calc(100vw-2rem)] sm:w-[780px] h-[86vh] sm:h-[670px] max-w-3xl max-h-[740px] flex flex-col overflow-hidden p-4 sm:p-6"
      closeButtonLabel={t.common.buttons.close}
    >
      <DialogHeader className="border-b border-black/[0.06] pb-3 dark:border-white/[0.08] shrink-0">
        <div className="flex items-center justify-between pr-6 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff]">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 truncate">
                {province} · {t.regionHistory.historyArchive}
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-500 truncate">
                {t.regionHistory.archiveDescription}
              </DialogDescription>
            </div>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-3.5 pt-3 overflow-y-auto overflow-x-hidden pr-1 flex-1 min-h-0">
        {loading ? (
          <div className="space-y-3.5 animate-in fade-in-50 duration-200">
            <div className="space-y-1.5">
              <div className="h-3.5 w-36 rounded bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="h-7 w-24 rounded-xl bg-neutral-200/80 dark:bg-neutral-800/80 animate-pulse shrink-0" />
                <div className="h-7 w-24 rounded-xl bg-neutral-100 dark:bg-neutral-800/40 animate-pulse shrink-0" />
                <div className="h-7 w-24 rounded-xl bg-neutral-100 dark:bg-neutral-800/40 animate-pulse shrink-0" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="h-16 rounded-2xl border border-neutral-200/60 bg-neutral-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/80 animate-pulse" />
              <div className="h-16 rounded-2xl border border-neutral-200/60 bg-neutral-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/80 animate-pulse" />
              <div className="h-16 rounded-2xl border border-neutral-200/60 bg-neutral-50/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/80 animate-pulse" />
            </div>

            <div className="h-44 rounded-2xl border border-neutral-200/70 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50 animate-pulse" />
            <div className="h-40 rounded-2xl border border-neutral-200/70 bg-white dark:border-neutral-800 dark:bg-neutral-900 animate-pulse" />
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-[#0066cc] dark:text-[#2997ff]" />
                  {t.regionHistory.probeDate}:
                </span>
                <span className="text-[11px] text-neutral-400">
                  {t.regionHistory.totalDays.replace("{count}", String(dates.length))}
                </span>
              </div>

              {dates.length === 0 ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 text-center text-xs text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
                  <AlertCircle className="h-4 w-4 text-neutral-400" />
                  {t.regionHistory.noRecords}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {dates.map((d) => (
                    <button
                      key={d}
                      onClick={() => handleDateChange(d)}
                      type="button"
                      className={`rounded-xl px-2.5 py-1 font-mono text-xs transition-all duration-150 whitespace-nowrap ${
                        activeDate === d
                          ? "bg-[#0066cc] text-white shadow-xs dark:bg-[#2997ff] dark:text-black font-semibold"
                          : "border border-black/[0.06] bg-neutral-100/70 text-neutral-700 hover:bg-neutral-200/80 dark:border-white/[0.08] dark:bg-neutral-800/60 dark:text-neutral-300"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeDate && records.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between min-w-0">
                  <span className="text-[10px] sm:text-[11px] text-neutral-400 truncate">{t.regionHistory.dayAvgLatency}</span>
                  <p className="mt-0.5 font-mono text-base sm:text-xl font-bold text-neutral-900 dark:text-neutral-100 truncate">
                    {dayAvg > 0 ? `${dayAvg}` : "-"}
                    <span className="text-[10px] sm:text-xs font-normal text-neutral-400 ml-0.5">ms</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between min-w-0">
                  <span className="text-[10px] sm:text-[11px] text-neutral-400 truncate">{t.regionHistory.inspectionRounds}</span>
                  <p className="mt-0.5 font-mono text-base sm:text-xl font-bold text-[#0066cc] dark:text-[#2997ff] truncate">
                    {groupedRuns.length}
                    <span className="text-[10px] sm:text-xs font-normal text-neutral-400 ml-0.5 whitespace-nowrap">{t.regionHistory.roundsWithNodes.replace("{count}", String(records.length))}</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between min-w-0 overflow-hidden">
                  <span className="text-[10px] sm:text-[11px] text-neutral-400 truncate">{t.regionHistory.extremeRange}</span>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-0.5 sm:gap-1 font-mono text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                    {minLatency !== null && maxLatency !== null ? (
                      <>
                        <span className="truncate">{minLatency}</span>
                        <span className="text-neutral-400 font-normal text-[10px] sm:text-xs">~</span>
                        <span className="truncate">{maxLatency}</span>
                        <span className="text-[10px] sm:text-[11px] font-normal text-neutral-400">ms</span>
                      </>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeDate && (
              <RegionLatencyChart
                records={records}
                dailyStats={dailyStats}
                date={activeDate}
                province={province}
                timeRange={chartTimeRange}
                onTimeRangeChange={setChartTimeRange}
                onSelectDate={handleDateChange}
              />
            )}

            {activeDate && records.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs px-0.5 whitespace-nowrap overflow-hidden">
                  <h4 className="font-semibold text-neutral-800 dark:text-neutral-200 shrink-0">
                    {t.regionHistory.runDetails}
                  </h4>
                  <span className="text-[11px] text-neutral-400 shrink-0 whitespace-nowrap">
                    <span className="hidden sm:inline">
                      {t.regionHistory.summaryFull
                        .replace("{runs}", String(listRuns.length))
                        .replace("{nodes}", String(records.length))} ·{" "}
                    </span>
                    <span>{t.regionHistory.summaryShort.replace("{runs}", String(listRuns.length))}</span>
                  </span>
                </div>

                <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] shadow-xs divide-y divide-black/[0.04] dark:divide-white/[0.05] overflow-hidden">
                  {listRuns.map((run) => {
                    const isSingle = run.probes.length === 1

                    if (isSingle) {
                      const probe = run.probes[0]
                      const theme = getCarrierTheme(probe.carrier || probe.carrier_name)

                      return (
                        <div
                          key={run.key}
                          className="p-2.5 sm:py-2.5 sm:px-3 hover:bg-neutral-50/70 dark:hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                              <span className="font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200 shrink-0">
                                {run.timeStr}
                              </span>
                              <span
                                className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${theme.badgeClass}`}
                              >
                                <span className={`h-1 w-1 rounded-full ${theme.dotClass}`} />
                                {probe.carrier_name}
                              </span>
                              <span className="font-medium text-xs text-neutral-700 dark:text-neutral-300 truncate max-w-[110px] sm:max-w-none">
                                {probe.city}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                              <span className="font-mono font-bold text-xs sm:text-sm text-[#0066cc] dark:text-[#2997ff] text-right">
                                {probe.latency_avg !== null ? `${probe.latency_avg.toFixed(1)} ms` : "-"}
                              </span>
                              <span
                                className={`font-mono text-[10px] sm:text-[11px] text-right ${
                                  probe.loss > 0 ? "text-rose-500 font-semibold" : "text-emerald-500 font-medium"
                                }`}
                              >
                                {probe.loss > 0 ? `${t.regionHistory.packetLoss} ${probe.loss}%` : t.regionHistory.zeroLoss}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={run.key}
                        className="p-2.5 sm:p-3 space-y-2 hover:bg-neutral-50/50 dark:hover:bg-white/[0.01] transition-colors"
                      >
                        <div className="flex items-center justify-between text-xs pb-1.5 border-b border-black/[0.03] dark:border-white/[0.04]">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                              {run.timeStr}
                            </span>
                            <span className="rounded-full bg-[#0066cc]/10 dark:bg-[#2997ff]/15 px-2 py-0.5 text-[10px] font-mono text-[#0066cc] dark:text-[#2997ff] font-medium">
                              {t.regionHistory.provinceAvg} {run.avgLatency}ms
                            </span>
                            <span className="text-[10px] text-neutral-400 hidden sm:inline">
                              ({t.regionHistory.rangeText} {run.minLatency}~{run.maxLatency}ms)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {run.avgLoss > 0 ? (
                              <span className="text-rose-500 font-semibold text-[10px]">
                                {t.regionHistory.packetLoss} {run.avgLoss}%
                              </span>
                            ) : (
                              <span className="text-emerald-500 text-[10px] font-medium">
                                {t.regionHistory.zeroLoss}
                              </span>
                            )}
                            <span className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.2 text-[10px] text-neutral-500">
                              {run.probes.length} {t.regionHistory.nodeUnit}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-1.5 pl-1 sm:pl-2">
                          {run.probes.map((probe) => {
                            const theme = getCarrierTheme(probe.carrier || probe.carrier_name)

                            return (
                              <div key={probe.id} className="text-xs">
                                <div className="flex items-center justify-between gap-2 py-0.5">
                                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                    <span
                                      className={`shrink-0 inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[9px] font-medium ${theme.badgeClass}`}
                                    >
                                      <span className={`h-1 w-1 rounded-full ${theme.dotClass}`} />
                                      {probe.carrier_name}
                                    </span>
                                    <span className="font-medium text-xs text-neutral-600 dark:text-neutral-400 truncate">
                                      {probe.city}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300 text-[11px]">
                                      {probe.latency_avg !== null ? `${probe.latency_avg.toFixed(1)}ms` : "-"}
                                    </span>
                                    {probe.loss > 0 && (
                                      <span className="text-rose-500 font-mono text-[10px]">
                                        ({probe.loss}%)
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex justify-center sm:justify-end pt-3 border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
        <Button
          type="button"
          variant="outline"
          onClick={() => void close()}
          className="rounded-full px-6 h-8 text-xs"
        >
          {t.common.buttons.close}
        </Button>
      </div>
    </SurfaceDialogContent>
  )
}

export async function openRegionHistoryModal(province: string): Promise<void> {
  await dialog.custom<void>((close) => (
    <RegionHistoryDialogView province={province} close={close} />
  ))
}

export function RegionHistoryPopover() {
  return null
}
