"use client"

import * as React from "react"
import type * as echartsType from "echarts"
import { useLocale } from "@/components/Providers"
import { getCarrierTheme } from "@/lib/carrier"
import { ProvinceDailyStat } from "@/lib/types"
import { t } from "@/locales"

export interface LatencyRecordItem {
  id: string
  measurement_id?: string
  timestamp: number
  city: string
  carrier?: string
  carrier_name: string
  latency_avg: number | null
  latency_min: number | null
  latency_max: number | null
  loss: number
}

export interface GroupedRegionRun {
  key: string
  timestamp: number
  timeStr: string
  fullTimeStr: string
  avgLatency: number
  avgLoss: number
  minLatency: number
  maxLatency: number
  probes: LatencyRecordItem[]
}

export type ChartTimeRange = "7d" | "30d" | "today"

/**
 * 将同一次全网巡检批次中的多个探针节点聚合为单次测速统计点
 */
export function groupRegionRecordsByRun(records: LatencyRecordItem[]): GroupedRegionRun[] {
  const map = new Map<string, LatencyRecordItem[]>()

  for (const r of records) {
    if (r.latency_avg === null || r.latency_avg <= 0) continue
    const key =
      r.measurement_id && r.measurement_id.trim() !== ""
        ? r.measurement_id
        : `ts-${Math.floor(r.timestamp / 5000) * 5000}`

    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key)!.push(r)
  }

  const runs: GroupedRegionRun[] = []
  for (const [key, probeList] of map.entries()) {
    const sorted = [...probeList].sort((a, b) => (a.carrier || "").localeCompare(b.carrier || ""))
    const validProbes = sorted.filter((p) => p.latency_avg !== null && p.latency_avg > 0)
    if (validProbes.length === 0) continue

    const baseTs = sorted[0].timestamp
    const avgLatency = Number(
      (validProbes.reduce((acc, p) => acc + (p.latency_avg || 0), 0) / validProbes.length).toFixed(1)
    )
    const avgLoss = Number(
      (validProbes.reduce((acc, p) => acc + (p.loss || 0), 0) / validProbes.length).toFixed(1)
    )
    const minLatency = Math.min(...validProbes.map((p) => p.latency_min ?? p.latency_avg ?? avgLatency))
    const maxLatency = Math.max(...validProbes.map((p) => p.latency_max ?? p.latency_avg ?? avgLatency))

    const date = new Date(baseTs)
    const timeStr = date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    })
    const fullTimeStr = date.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })

    runs.push({
      key,
      timestamp: baseTs,
      timeStr,
      fullTimeStr,
      avgLatency,
      avgLoss,
      minLatency,
      maxLatency,
      probes: sorted,
    })
  }

  return runs.sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * 抽样函数：当巡检批次较多时，均匀抽取关键点以保持折线可读性
 */
function downsampleRuns(runs: GroupedRegionRun[], maxPoints: number = 12): GroupedRegionRun[] {
  if (runs.length <= maxPoints) return runs
  const result: GroupedRegionRun[] = []
  const step = (runs.length - 1) / (maxPoints - 1)
  const pickedIndices = new Set<number>()

  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(runs.length - 1, Math.round(i * step))
    if (!pickedIndices.has(idx)) {
      pickedIndices.add(idx)
      result.push(runs[idx])
    }
  }

  // 确保第一项和最后一项严格存在
  if (result.length > 0 && result[0] !== runs[0]) {
    result[0] = runs[0]
  }
  if (result.length > 1 && result[result.length - 1] !== runs[runs.length - 1]) {
    result[result.length - 1] = runs[runs.length - 1]
  }

  return result
}

export interface RegionLatencyChartProps {
  records: LatencyRecordItem[]
  dailyStats?: ProvinceDailyStat[]
  date?: string
  province?: string
  isYesterday?: boolean
  timeWindowLabel?: string
  timeRange?: ChartTimeRange
  onTimeRangeChange?: (range: ChartTimeRange) => void
}

export function RegionLatencyChart({
  records,
  dailyStats = [],
  date,
  isYesterday,
  timeWindowLabel,
  timeRange: controlledTimeRange,
  onTimeRangeChange,
}: RegionLatencyChartProps) {
  const { locale } = useLocale()
  const chartRef = React.useRef<HTMLDivElement>(null)
  const chartInstanceRef = React.useRef<echartsType.ECharts | null>(null)
  const [isDarkMode, setIsDarkMode] = React.useState(false)
  const [internalTimeRange, setInternalTimeRange] = React.useState<ChartTimeRange>("today")
  const timeRange = controlledTimeRange ?? internalTimeRange

  const handleRangeChange = (r: ChartTimeRange) => {
    if (onTimeRangeChange) {
      onTimeRangeChange(r)
    } else {
      setInternalTimeRange(r)
    }
  }

  // 监听深色模式变化
  React.useEffect(() => {
    const checkDark = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"))
    }
    checkDark()

    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  // 聚合单次巡检批次
  const groupedRuns = React.useMemo(() => {
    return groupRegionRecordsByRun(records)
  }, [records])

  // 今日稀疏采样点（上限 12 点）
  const sparseTodayRuns = React.useMemo(() => {
    return downsampleRuns(groupedRuns, 12)
  }, [groupedRuns])

  // 7日数据切片（刚好 7 个点）
  const last7Daily = React.useMemo(() => {
    if (dailyStats.length >= 7) {
      return dailyStats.slice(-7)
    }
    return dailyStats
  }, [dailyStats])

  // 30日数据切片
  const last30Daily = React.useMemo(() => {
    if (dailyStats.length >= 30) {
      return dailyStats.slice(-30)
    }
    return dailyStats
  }, [dailyStats])

  // 计算当前模式的活跃数据集
  const currentDataConfig = React.useMemo(() => {
    if (timeRange === "7d") {
      const items = last7Daily
      const xData = items.map((d) => d.displayDate)
      const yData = items.map((d) => d.avgLatency)
      const yLossData = items.map((d) => d.avgLoss)
      return {
        mode: "7d" as const,
        items,
        xData,
        yData,
        yLossData,
        pointCount: items.length,
        symbolSize: 7,
      }
    }

    if (timeRange === "30d") {
      const items = last30Daily
      const xData = items.map((d) => d.displayDate)
      const yData = items.map((d) => d.avgLatency)
      const yLossData = items.map((d) => d.avgLoss)
      return {
        mode: "30d" as const,
        items,
        xData,
        yData,
        yLossData,
        pointCount: items.length,
        symbolSize: 4.5,
      }
    }

    // 今日 / 24小时模式 (稀疏采样后)
    const items = sparseTodayRuns
    const xData = items.map((r) => r.timeStr)
    const yData = items.map((r) => r.avgLatency)
    const yLossData = items.map((r) => r.avgLoss)
    return {
      mode: "today" as const,
      items,
      xData,
      yData,
      yLossData,
      pointCount: items.length,
      symbolSize: items.length <= 1 ? 8 : 6,
    }
  }, [timeRange, last7Daily, last30Daily, sparseTodayRuns])

  // 初始化与渲染 ECharts
  React.useEffect(() => {
    let echartsModule: typeof echartsType | null = null
    let isDisposed = false

    const renderChart = async () => {
      if (!chartRef.current) return

      try {
        echartsModule = await import("echarts")
        if (isDisposed || !chartRef.current) return

        if (!chartInstanceRef.current) {
          chartInstanceRef.current = echartsModule.init(chartRef.current)
        }

        const chart = chartInstanceRef.current

        if (currentDataConfig.yData.length === 0) {
          chart.clear()
          return
        }

        const primaryColor = isDarkMode ? "#2997ff" : "#0066cc"
        const lossColor = "#f43f5e"
        const textColor = isDarkMode ? "#a1a1aa" : "#71717a"
        const splitLineColor = isDarkMode ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)"
        const tooltipBg = isDarkMode ? "rgba(28, 28, 30, 0.94)" : "rgba(255, 255, 255, 0.96)"
        const tooltipBorder = isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"
        const tooltipTextColor = isDarkMode ? "#f4f4f5" : "#18181b"

        const clientWidth = chartRef.current?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 500)
        const isMobileView = clientWidth < 520

        const option: echartsType.EChartsOption = {
          animationDuration: 300,
          grid: {
            top: 24,
            right: isMobileView ? 36 : 42,
            bottom: 24,
            left: isMobileView ? 38 : 42,
            containLabel: false,
          },
          tooltip: {
            trigger: "axis",
            backgroundColor: tooltipBg,
            borderColor: tooltipBorder,
            borderWidth: 1,
            borderRadius: isMobileView ? 12 : 14,
            padding: isMobileView ? [6, 10] : [8, 12],
            textStyle: {
              color: tooltipTextColor,
              fontSize: isMobileView ? 11 : 12,
              fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
            },
            extraCssText: isMobileView
              ? "box-shadow: 0 8px 24px -4px rgba(0,0,0,0.22); backdrop-filter: blur(16px); z-index: 60; min-width: 140px; max-width: 240px; pointer-events: none;"
              : "box-shadow: 0 16px 36px -8px rgba(0,0,0,0.22); backdrop-filter: blur(16px); z-index: 60; min-width: 190px; pointer-events: none;",
            axisPointer: {
              type: "line",
              lineStyle: {
                color: primaryColor,
                width: 1.5,
                type: "dashed",
              },
            },
            position: (
              point: number[],
              _params: unknown,
              _dom: unknown,
              _rect: unknown,
              size: { contentSize: [number, number]; viewSize: [number, number] }
            ) => {
              if (!size || !size.contentSize || !size.viewSize) {
                return [Math.max(8, point[0] + 12), 10]
              }
              const [boxWidth, boxHeight] = size.contentSize
              const [viewWidth, viewHeight] = size.viewSize
              const [px, py] = point

              if (isMobileView) {
                // 移动端防遮挡定位：吸附在顶部，不覆盖折线与触碰点
                const minX = 8
                const maxX = Math.max(minX, viewWidth - boxWidth - 8)
                const posX = Math.max(minX, Math.min(px - boxWidth / 2, maxX))
                const posY = 2
                return [posX, posY]
              }

              // 电脑端防溢出定位
              let posX = px < viewWidth / 2 ? px + 16 : px - boxWidth - 16
              const minX = 10
              const maxX = Math.max(minX, viewWidth - boxWidth - 10)
              posX = Math.max(minX, Math.min(posX, maxX))

              let posY = py - boxHeight / 2
              const minY = 5
              const maxY = Math.max(minY, viewHeight - boxHeight - 5)
              posY = Math.max(minY, Math.min(posY, maxY))
              return [posX, posY]
            },
            formatter: (params: unknown) => {
              const pArray = params as Array<{ dataIndex: number }>
              if (!pArray || pArray.length === 0) return ""
              const idx = pArray[0].dataIndex

              // 7日 / 30日 模式浮动卡片
              if (timeRange === "7d" || timeRange === "30d") {
                const list = timeRange === "7d" ? last7Daily : last30Daily
                const item = list[idx]
                if (!item) return ""
                const lossBadge =
                  item.avgLoss > 0
                    ? `<span style="color: #f43f5e; font-weight: 600; font-size: ${isMobileView ? "10px" : "11px"};">${t.regionHistory.packetLoss} ${item.avgLoss}%</span>`
                    : `<span style="color: #10b981; font-weight: 500; font-size: ${isMobileView ? "10px" : "11px"};">${t.regionHistory.noPacketLoss}</span>`

                return `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid ${splitLineColor};">
                      <span style="font-size: 11px; font-weight: 600; font-family: monospace; opacity: 0.85;">${item.date}</span>
                      <span style="font-size: 10px; padding: 1px 6px; border-radius: 9999px; background: ${primaryColor}15; color: ${primaryColor}; font-weight: 500;">
                        ${item.count} ${t.regionHistory.samplesUnit}
                      </span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 10px;">
                      <div>
                        <div style="font-size: 10px; opacity: 0.6;">${t.regionHistory.dailyAvgLatency}</div>
                        <div style="font-size: 16px; font-weight: 700; font-family: monospace; color: ${primaryColor}; line-height: 1.1;">
                          ${item.avgLatency.toFixed(1)} <span style="font-size: 10px; font-weight: 400;">ms</span>
                        </div>
                      </div>
                      <div>${lossBadge}</div>
                    </div>
                    <div style="font-size: 10px; opacity: 0.65; display: flex; justify-content: space-between; margin-top: 3px;">
                      <span>${t.regionHistory.rangeText}: ${item.minLatency} ~ ${item.maxLatency} ms</span>
                    </div>
                  </div>
                `
              }

              // 今日模式浮动卡片
              const run = sparseTodayRuns[idx]
              if (!run) return ""
              const lossBadge =
                run.avgLoss > 0
                  ? `<span style="color: #f43f5e; font-weight: 600; font-size: ${isMobileView ? "10px" : "11px"};">${t.regionHistory.packetLoss} ${run.avgLoss}%</span>`
                  : `<span style="color: #10b981; font-weight: 500; font-size: ${isMobileView ? "10px" : "11px"};">${t.regionHistory.noPacketLoss}</span>`

              const probeItemsHtml = run.probes
                .map((p) => {
                  const theme = getCarrierTheme(p.carrier || p.carrier_name)
                  const latStr = p.latency_avg !== null ? `${p.latency_avg.toFixed(1)} ms` : "-"
                  const labelColor = isDarkMode ? theme.textDark : theme.textLight
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                      <span style="display: inline-flex; align-items: center; gap: 5px; color: ${labelColor}; font-weight: 500; font-size: 10px;">
                        <span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: ${theme.hex};"></span>
                        ${p.carrier_name}
                      </span>
                      <span style="font-family: monospace; font-weight: 600; color: ${textColor}; font-size: 10px;">
                        ${latStr}
                      </span>
                    </div>
                  `
                })
                .join("")

              return `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 4px; padding-bottom: 3px; border-bottom: 1px solid ${splitLineColor};">
                    <span style="font-size: 11px; font-weight: 600; font-family: monospace; opacity: 0.85;">${run.timeStr}</span>
                    <span style="font-size: 10px; padding: 1px 6px; border-radius: 9999px; background: ${primaryColor}15; color: ${primaryColor}; font-weight: 500;">
                      ${run.probes.length} ${t.regionHistory.nodesUnit}
                    </span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                    <div style="font-size: 15px; font-weight: 700; font-family: monospace; color: ${primaryColor}; line-height: 1.1;">
                      ${run.avgLatency.toFixed(1)} <span style="font-size: 10px; font-weight: 400;">ms</span>
                    </div>
                    <div>${lossBadge}</div>
                  </div>
                  <div style="font-size: 10px; display: flex; flex-direction: column; gap: 2px; background: ${
                    isDarkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"
                  }; padding: 3px 6px; border-radius: 6px;">
                    ${probeItemsHtml}
                  </div>
                </div>
              `
            },
          },
          xAxis: {
            type: "category",
            data: currentDataConfig.xData,
            boundaryGap: currentDataConfig.pointCount <= 3 ? true : false,
            axisLine: {
              lineStyle: {
                color: isDarkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
              },
            },
            axisTick: { show: false },
            axisLabel: {
              color: textColor,
              fontSize: 10,
              fontFamily: "monospace",
              margin: 8,
              hideOverlap: true,
              interval: (index: number) => {
                if (timeRange === "30d") {
                  return index % (isMobileView ? 6 : 4) === 0
                }
                if (timeRange === "7d") {
                  return true
                }
                // today 模式：自适应步长，避免标签重叠
                const total = currentDataConfig.pointCount
                if (total <= 6) return true
                const maxLabels = isMobileView ? 4 : 6
                const step = Math.ceil(total / maxLabels)
                return index % step === 0 || index === total - 1
              },
            },
          },
          yAxis: [
            {
              type: "value",
              axisLine: { show: false },
              axisTick: { show: false },
              splitLine: {
                lineStyle: {
                  color: splitLineColor,
                  type: "dashed",
                },
              },
              axisLabel: {
                color: textColor,
                fontSize: 10,
                fontFamily: "monospace",
                formatter: "{value}ms",
              },
            },
            {
              type: "value",
              min: 0,
              max: (value: { max: number }) => {
                if (!value || value.max <= 0) return 10
                if (value.max <= 5) return 10
                const buffered = Math.min(100, value.max * 1.25)
                return Math.min(100, Math.ceil(buffered / 5) * 5)
              },
              axisLine: { show: false },
              axisTick: { show: false },
              splitLine: { show: false },
              axisLabel: {
                color: lossColor,
                fontSize: 10,
                fontFamily: "monospace",
                formatter: "{value}%",
              },
            },
          ],
          series: [
            {
              name: t.regionHistory.chartSeriesLabel || "时延",
              type: "line",
              yAxisIndex: 0,
              smooth: 0.35,
              showSymbol: currentDataConfig.pointCount <= 30,
              symbol: "circle",
              symbolSize: currentDataConfig.symbolSize,
              itemStyle: {
                color: primaryColor,
                borderWidth: 2,
                borderColor: isDarkMode ? "#1c1c1e" : "#ffffff",
              },
              emphasis: {
                scale: 1.6,
                itemStyle: {
                  color: primaryColor,
                  borderWidth: 3,
                  shadowBlur: 8,
                  shadowColor: `${primaryColor}66`,
                },
              },
              lineStyle: {
                color: primaryColor,
                width: 2.4,
              },
              areaStyle: {
                color: new echartsModule.graphic.LinearGradient(0, 0, 0, 1, [
                  {
                    offset: 0,
                    color: isDarkMode ? "rgba(41, 151, 255, 0.28)" : "rgba(0, 102, 204, 0.22)",
                  },
                  {
                    offset: 1,
                    color: isDarkMode ? "rgba(41, 151, 255, 0.01)" : "rgba(0, 102, 204, 0.01)",
                  },
                ]),
              },
              data: currentDataConfig.yData,
            },
            {
              name: t.regionHistory.chartLossLabel || "丢包率",
              type: "line",
              yAxisIndex: 1,
              smooth: 0.35,
              showSymbol: currentDataConfig.pointCount <= 30,
              symbol: "circle",
              symbolSize: Math.max(4, currentDataConfig.symbolSize - 1.5),
              itemStyle: {
                color: lossColor,
                borderWidth: 1.5,
                borderColor: isDarkMode ? "#1c1c1e" : "#ffffff",
              },
              emphasis: {
                scale: 1.5,
                itemStyle: {
                  color: lossColor,
                  borderWidth: 2.5,
                  shadowBlur: 8,
                  shadowColor: `${lossColor}66`,
                },
              },
              lineStyle: {
                color: lossColor,
                width: 1.8,
              },
              areaStyle: {
                color: new echartsModule.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: "rgba(244, 63, 94, 0.18)" },
                  { offset: 0.8, color: "rgba(244, 63, 94, 0.03)" },
                  { offset: 1, color: "transparent" },
                ]),
              },
              data: currentDataConfig.yLossData,
            },
          ],
        }

        chart.setOption(option, true)
      } catch (err) {
        console.error("ECharts load/render error:", err)
      }
    }

    void renderChart()

    // 监听窗口尺寸自适应
    let lastWidth = chartRef.current?.clientWidth || 0
    const resizeHandler = () => {
      const currentW = chartRef.current?.clientWidth || 0
      if ((lastWidth < 520 && currentW >= 520) || (lastWidth >= 520 && currentW < 520)) {
        lastWidth = currentW
        void renderChart()
      } else {
        lastWidth = currentW
        chartInstanceRef.current?.resize()
      }
    }
    window.addEventListener("resize", resizeHandler)

    // 移动端点击图表外部自动收起悬浮提示
    const handleDocumentTouch = (e: TouchEvent) => {
      if (chartRef.current && !chartRef.current.contains(e.target as Node)) {
        chartInstanceRef.current?.dispatchAction({ type: "hideTip" })
      }
    }
    document.addEventListener("touchstart", handleDocumentTouch, { passive: true })

    let resizeObserver: ResizeObserver | null = null
    if (chartRef.current && typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        resizeHandler()
      })
      resizeObserver.observe(chartRef.current)
    }

    return () => {
      isDisposed = true
      window.removeEventListener("resize", resizeHandler)
      document.removeEventListener("touchstart", handleDocumentTouch)
      resizeObserver?.disconnect()
      chartInstanceRef.current?.dispose()
      chartInstanceRef.current = null
    }
  }, [currentDataConfig, isDarkMode, timeRange, last7Daily, last30Daily, sparseTodayRuns, locale])

  if (currentDataConfig.yData.length === 0) {
    return (
      <div className="flex h-36 items-center justify-center rounded-2xl border border-neutral-200/80 bg-neutral-50/40 text-xs text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900/40">
        {t.regionHistory.noChartData}
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-white dark:bg-[#1c1c1e] p-3 sm:p-3.5 shadow-xs transition-all overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-2 px-0.5 whitespace-nowrap overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#0066cc] dark:bg-[#2997ff] shrink-0" />
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
              {t.regionHistory.trendTitle}
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-[10px] text-neutral-500 dark:text-neutral-400">
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0066cc] dark:bg-[#2997ff]" />
              <span className="text-neutral-600 dark:text-neutral-300">{t.regionHistory.chartSeriesLabel || "时延"}</span>
            </span>
            <span className="inline-flex items-center gap-1 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f43f5e]" />
              <span className="text-neutral-600 dark:text-neutral-300">{t.regionHistory.chartLossLabel || "丢包率"}</span>
            </span>
          </div>

          <span className="text-[10px] text-neutral-400 font-mono hidden md:inline whitespace-nowrap">
            ({timeRange === "today"
              ? (isYesterday ? (timeWindowLabel || t.regionHistory.yesterday) : t.regionHistory.timeRanges.todayOnly)
              : t.regionHistory.daysCount.replace("{count}", String(currentDataConfig.pointCount))})
          </span>
        </div>

        <div className="inline-flex items-center rounded-lg bg-neutral-100 dark:bg-neutral-800/80 p-0.5 shrink-0 text-[11px]">
          <button
            type="button"
            onClick={() => handleRangeChange("7d")}
            className={`rounded-md px-2 py-0.5 transition-all font-medium whitespace-nowrap ${
              timeRange === "7d"
                ? "bg-white text-[#0066cc] shadow-xs dark:bg-neutral-700 dark:text-[#2997ff] font-semibold"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {t.regionHistory.timeRanges.sevenDaysAvg}
          </button>
          <button
            type="button"
            onClick={() => handleRangeChange("30d")}
            className={`rounded-md px-2 py-0.5 transition-all font-medium whitespace-nowrap ${
              timeRange === "30d"
                ? "bg-white text-[#0066cc] shadow-xs dark:bg-neutral-700 dark:text-[#2997ff] font-semibold"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {t.regionHistory.timeRanges.thirtyDaysAvg}
          </button>
          <button
            type="button"
            onClick={() => handleRangeChange("today")}
            className={`rounded-md px-2 py-0.5 transition-all font-medium whitespace-nowrap ${
              timeRange === "today"
                ? "bg-white text-[#0066cc] shadow-xs dark:bg-neutral-700 dark:text-[#2997ff] font-semibold"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {t.regionHistory.timeRanges.todayOnly}
          </button>
        </div>
      </div>

      <div ref={chartRef} className="w-full h-40 sm:h-44" />
    </div>
  )
}
