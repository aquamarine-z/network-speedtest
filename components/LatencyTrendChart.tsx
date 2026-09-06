"use client"

import * as React from "react"
import type * as echartsType from "echarts"
import { useNetworkStore } from "@/store/useNetworkStore"
import { useLocale } from "@/components/Providers"
import { HistoryRecord } from "@/lib/types"
import { TrendingUp } from "lucide-react"
import { t } from "@/locales"

interface AggregatedBucket {
  bucketKey: number
  timeLabel: string
  timeRangeLabel: string
  fullDateRange: string
  overallAvgLatency: number
  overallLossRate: number
  telecomAvg: number
  unicomAvg: number
  mobileAvg: number
  eduAvg?: number
  minLatency?: number
  maxLatency?: number
  probesCount: number
  runCount: number
  target: string
}

const BUCKET_MS = 30 * 60 * 1000 // 30 分钟刻度窗口

export function LatencyTrendChart() {
  const { historyList } = useNetworkStore()
  const { locale } = useLocale()
  const chartRef = React.useRef<HTMLDivElement>(null)
  const chartInstanceRef = React.useRef<echartsType.ECharts | null>(null)
  const [isDarkMode, setIsDarkMode] = React.useState(false)

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

  // 30分钟刻度聚合：将原始巡检记录聚合为30分钟步长桶，桶内数据求平均值
  const aggregatedData = React.useMemo<AggregatedBucket[]>(() => {
    if (!historyList || historyList.length === 0) return []

    // 确保按时间戳升序排序
    const sorted = [...historyList].sort((a, b) => a.timestamp - b.timestamp)

    const map = new Map<number, HistoryRecord[]>()
    sorted.forEach((rec) => {
      const bucketTime = Math.floor(rec.timestamp / BUCKET_MS) * BUCKET_MS
      const list = map.get(bucketTime) || []
      list.push(rec)
      map.set(bucketTime, list)
    })

    const bucketKeys = Array.from(map.keys()).sort((a, b) => a - b)

    return bucketKeys.map((bTime) => {
      const records = map.get(bTime)!
      const count = records.length

      const totalLat = records.reduce((acc, cur) => acc + cur.overallAvgLatency, 0)
      const totalLoss = records.reduce((acc, cur) => acc + cur.overallLossRate, 0)

      const telList = records.filter((r) => r.telecomAvg > 0)
      const uniList = records.filter((r) => r.unicomAvg > 0)
      const mobList = records.filter((r) => r.mobileAvg > 0)
      const eduList = records.filter((r) => r.eduAvg && r.eduAvg > 0)

      const telAvg = telList.length > 0 ? telList.reduce((acc, cur) => acc + cur.telecomAvg, 0) / telList.length : 0
      const uniAvg = uniList.length > 0 ? uniList.reduce((acc, cur) => acc + cur.unicomAvg, 0) / uniList.length : 0
      const mobAvg = mobList.length > 0 ? mobList.reduce((acc, cur) => acc + cur.mobileAvg, 0) / mobList.length : 0
      const eduAvg = eduList.length > 0 ? eduList.reduce((acc, cur) => acc + (cur.eduAvg || 0), 0) / eduList.length : undefined

      const validMinLats = records.map((r) => r.minLatency).filter((v): v is number => typeof v === "number")
      const validMaxLats = records.map((r) => r.maxLatency).filter((v): v is number => typeof v === "number")

      const minLatency = validMinLats.length > 0 ? Math.min(...validMinLats) : undefined
      const maxLatency = validMaxLats.length > 0 ? Math.max(...validMaxLats) : undefined

      const totalProbes = records.reduce((acc, cur) => acc + (cur.probesCount || 0), 0)
      const avgProbes = Math.round(totalProbes / count)

      const startDate = new Date(bTime)
      const endDate = new Date(bTime + BUCKET_MS)

      const pad = (n: number) => String(n).padStart(2, "0")
      const startHm = `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`
      const endHm = `${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`
      const monthDay = `${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`

      return {
        bucketKey: bTime,
        timeLabel: startHm,
        timeRangeLabel: `${startHm} – ${endHm}`,
        fullDateRange: `${monthDay} ${startHm} – ${endHm}`,
        overallAvgLatency: Number((totalLat / count).toFixed(1)),
        overallLossRate: Number((totalLoss / count).toFixed(1)),
        telecomAvg: Number(telAvg.toFixed(1)),
        unicomAvg: Number(uniAvg.toFixed(1)),
        mobileAvg: Number(mobAvg.toFixed(1)),
        eduAvg: eduAvg !== undefined ? Number(eduAvg.toFixed(1)) : undefined,
        minLatency,
        maxLatency,
        probesCount: avgProbes,
        runCount: count,
        target: records[records.length - 1].target,
      }
    })
  }, [historyList])

  // 聚合统计指标
  const latestBucket = aggregatedData.length > 0 ? aggregatedData[aggregatedData.length - 1] : null

  const overallHistoryAvg = React.useMemo(() => {
    if (aggregatedData.length === 0) return 0
    const sum = aggregatedData.reduce((acc, cur) => acc + cur.overallAvgLatency, 0)
    return Number((sum / aggregatedData.length).toFixed(1))
  }, [aggregatedData])

  const overallHistoryLoss = React.useMemo(() => {
    if (aggregatedData.length === 0) return 0
    const sum = aggregatedData.reduce((acc, cur) => acc + cur.overallLossRate, 0)
    return Number((sum / aggregatedData.length).toFixed(1))
  }, [aggregatedData])

  // 初始化与渲染 ECharts 走势图
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

        if (aggregatedData.length === 0) {
          chart.clear()
          return
        }

        // Apple 主题色彩
        const primaryColor = isDarkMode ? "#2997ff" : "#0066cc"
        const lossColor = "#f43f5e"
        const textColor = isDarkMode ? "#a1a1aa" : "#71717a"
        const titleColor = isDarkMode ? "#f4f4f5" : "#18181b"
        const splitLineColor = isDarkMode ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)"
        const tooltipBg = isDarkMode ? "rgba(28, 28, 30, 0.94)" : "rgba(255, 255, 255, 0.96)"
        const tooltipBorder = isDarkMode ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"

        const clientWidth = chartRef.current?.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 500)
        const isMobileView = clientWidth < 520

        // X轴：30分钟整刻度标签 (HH:mm)
        const xData = aggregatedData.map((d) => d.timeLabel)

        // Y1轴：时延
        const yLatencyData = aggregatedData.map((d) => d.overallAvgLatency)
        // Y2轴：丢包率
        const yLossData = aggregatedData.map((d) => d.overallLossRate)

        const option: echartsType.EChartsOption = {
          animationDuration: 400,
          grid: {
            top: isMobileView ? 40 : 44,
            right: isMobileView ? 38 : 48,
            bottom: isMobileView ? 24 : 28,
            left: isMobileView ? 40 : 48,
            containLabel: false,
          },
          tooltip: {
            trigger: "axis",
            backgroundColor: tooltipBg,
            borderColor: tooltipBorder,
            borderWidth: 1,
            borderRadius: isMobileView ? 12 : 16,
            padding: isMobileView ? [8, 10] : [12, 14],
            textStyle: {
              color: titleColor,
              fontSize: isMobileView ? 11 : 12,
              fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
            },
            extraCssText: isMobileView
              ? "box-shadow: 0 8px 24px -4px rgba(0,0,0,0.22); backdrop-filter: blur(16px); z-index: 50; min-width: 170px; max-width: 260px; pointer-events: none;"
              : "box-shadow: 0 16px 36px -8px rgba(0,0,0,0.22); backdrop-filter: blur(16px); z-index: 50; min-width: 230px; pointer-events: none;",
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
                const minX = 8
                const maxX = Math.max(minX, viewWidth - boxWidth - 8)
                const posX = Math.max(minX, Math.min(px - boxWidth / 2, maxX))
                const posY = py > viewHeight * 0.5 ? 8 : Math.max(8, viewHeight - boxHeight - 8)
                return [posX, posY]
              }

              let posX = px < viewWidth / 2 ? px + 16 : px - boxWidth - 16
              const minX = 12
              const maxX = Math.max(minX, viewWidth - boxWidth - 12)
              posX = Math.max(minX, Math.min(posX, maxX))

              let posY = py - boxHeight / 2
              const minY = 10
              const maxY = Math.max(minY, viewHeight - boxHeight - 10)
              posY = Math.max(minY, Math.min(posY, maxY))

              return [posX, posY]
            },
            formatter: (params: unknown) => {
              const pArray = params as Array<{ dataIndex: number }>
              if (!pArray || pArray.length === 0) return ""
              const idx = pArray[0].dataIndex
              const item = aggregatedData[idx]
              if (!item) return ""

              const lossBadge =
                item.overallLossRate > 0
                  ? `<span style="color: #f43f5e; font-weight: 600; font-size: ${isMobileView ? "10px" : "11px"};">${item.overallLossRate.toFixed(1)}% ${t.trend.pointLoss}</span>`
                  : `<span style="color: #10b981; font-weight: 500; font-size: ${isMobileView ? "10px" : "11px"};">0% ${t.trend.pointLoss}</span>`

              const telStr = item.telecomAvg > 0 ? `${item.telecomAvg.toFixed(1)}ms` : "-"
              const uniStr = item.unicomAvg > 0 ? `${item.unicomAvg.toFixed(1)}ms` : "-"
              const mobStr = item.mobileAvg > 0 ? `${item.mobileAvg.toFixed(1)}ms` : "-"
              const eduStr = item.eduAvg && item.eduAvg > 0 ? `${item.eduAvg.toFixed(1)}ms` : null

              return `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; padding-bottom: 5px; border-bottom: 1px solid ${splitLineColor};">
                    <div style="font-size: 11px; font-weight: 600; font-family: monospace; letter-spacing: -0.2px;">
                      <span style="opacity: 0.85;">${item.fullDateRange}</span>
                    </div>
                    <span style="font-size: 10px; padding: 1px 6px; border-radius: 9999px; background: ${primaryColor}15; color: ${primaryColor}; font-weight: 600;">
                      ${item.runCount} ${t.trend.probeSamples}
                    </span>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 7px;">
                    <div>
                      <div style="font-size: 10px; opacity: 0.6; text-transform: uppercase;">${t.trend.nationalAvg}</div>
                      <div style="font-size: 18px; font-weight: 700; font-family: monospace; color: ${primaryColor}; line-height: 1.1;">
                        ${item.overallAvgLatency.toFixed(1)} <span style="font-size: 11px; font-weight: 400;">ms</span>
                      </div>
                    </div>
                    <div>${lossBadge}</div>
                  </div>

                  <!-- 扁平化融入上一层背景，去二级嵌套卡片 -->
                  <div style="display: flex; flex-direction: column; gap: 4px; padding: 5px 0 6px 0; border-top: 1px solid ${splitLineColor}; border-bottom: 1px solid ${splitLineColor};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="display: inline-flex; align-items: center; gap: 6px; color: ${isDarkMode ? "#93c5fd" : "#1d4ed8"}; font-size: 10.5px;">
                        <span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #2563eb;"></span>
                        ${t.carrier.telecom}
                      </span>
                      <span style="font-family: monospace; font-weight: 600; color: ${titleColor}; font-size: 10.5px;">${telStr}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="display: inline-flex; align-items: center; gap: 6px; color: ${isDarkMode ? "#d8b4fe" : "#7e22ce"}; font-size: 10.5px;">
                        <span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #9333ea;"></span>
                        ${t.carrier.unicom}
                      </span>
                      <span style="font-family: monospace; font-weight: 600; color: ${titleColor}; font-size: 10.5px;">${uniStr}</span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="display: inline-flex; align-items: center; gap: 6px; color: ${isDarkMode ? "#67e8f9" : "#0e7490"}; font-size: 10.5px;">
                        <span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #06b6d4;"></span>
                        ${t.carrier.mobile}
                      </span>
                      <span style="font-family: monospace; font-weight: 600; color: ${titleColor}; font-size: 10.5px;">${mobStr}</span>
                    </div>

                    ${
                      eduStr
                        ? `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="display: inline-flex; align-items: center; gap: 6px; color: ${isDarkMode ? "#a5b4fc" : "#4338ca"}; font-size: 10.5px;">
                        <span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #6366f1;"></span>
                        ${t.carrier.edu}
                      </span>
                      <span style="font-family: monospace; font-weight: 600; color: ${titleColor}; font-size: 10.5px;">${eduStr}</span>
                    </div>`
                        : ""
                    }
                  </div>

                  <div style="margin-top: 5px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; opacity: 0.65; font-family: monospace;">
                    ${
                      item.minLatency !== undefined && item.maxLatency !== undefined
                        ? `<span>${t.trend.extremeRange} ${item.minLatency.toFixed(0)} – ${item.maxLatency.toFixed(0)} ms</span>`
                        : `<span>${t.trend.aggregate30m}</span>`
                    }
                    <span>${t.trend.probeCount} ${item.probesCount}</span>
                  </div>
                </div>
              `
            },
          },
          xAxis: {
            type: "category",
            data: xData,
            boundaryGap: false,
            axisLine: {
              lineStyle: {
                color: splitLineColor,
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
                const total = aggregatedData.length
                if (total <= 6) return true
                const maxLabels = isMobileView ? 4 : 7
                const step = Math.ceil(total / maxLabels)
                return index % step === 0 || index === total - 1
              },
            },
          },
          yAxis: [
            {
              type: "value",
              name: t.trend.latencyAxis,
              nameTextStyle: {
                color: textColor,
                fontSize: 10,
                align: "left",
                padding: [0, 0, 8, -6],
              },
              max: (value: { max: number }) => {
                if (!value || value.max <= 0) return 50
                // 顶部留出 18% 缓冲空间，杜绝曲线峰值点与顶部刻度文字裁切重合
                const buffered = value.max * 1.18
                return Math.ceil(buffered / 10) * 10
              },
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
              name: t.trend.lossAxis,
              nameTextStyle: {
                color: lossColor,
                fontSize: 10,
                align: "right",
                padding: [0, -6, 8, 0],
              },
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
              name: t.trend.compositeSeries,
              type: "line",
              yAxisIndex: 0,
              smooth: 0.35,
              showSymbol: aggregatedData.length <= 40,
              symbol: "circle",
              symbolSize: 6,
              data: yLatencyData,
              itemStyle: {
                color: primaryColor,
                borderColor: isDarkMode ? "#1c1c1e" : "#ffffff",
                borderWidth: 2,
              },
              emphasis: {
                scale: 1.5,
                itemStyle: {
                  color: primaryColor,
                  borderColor: isDarkMode ? "#1c1c1e" : "#ffffff",
                  borderWidth: 3,
                  shadowBlur: 8,
                  shadowColor: `${primaryColor}66`,
                },
              },
              lineStyle: {
                width: 2.6,
                color: primaryColor,
                shadowColor: `${primaryColor}33`,
                shadowBlur: 8,
              },
              areaStyle: {
                color: new echartsModule.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: `${primaryColor}35` },
                  { offset: 0.8, color: `${primaryColor}06` },
                  { offset: 1, color: `${primaryColor}00` },
                ]),
              },
            },
            {
              name: t.trend.lossSeries,
              type: "line",
              yAxisIndex: 1,
              smooth: 0.35,
              showSymbol: aggregatedData.length <= 40,
              symbol: "circle",
              symbolSize: 5,
              data: yLossData,
              itemStyle: {
                color: lossColor,
                borderColor: isDarkMode ? "#1c1c1e" : "#ffffff",
                borderWidth: 2,
              },
              emphasis: {
                scale: 1.5,
                itemStyle: {
                  color: lossColor,
                  borderColor: isDarkMode ? "#1c1c1e" : "#ffffff",
                  borderWidth: 3,
                  shadowBlur: 8,
                  shadowColor: "rgba(244, 63, 94, 0.4)",
                },
              },
              lineStyle: {
                width: 1.8,
                color: lossColor,
                type: "solid",
              },
              areaStyle: {
                color: new echartsModule.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: "rgba(244, 63, 94, 0.18)" },
                  { offset: 0.8, color: "rgba(244, 63, 94, 0.03)" },
                  { offset: 1, color: "rgba(244, 63, 94, 0.00)" },
                ]),
              },
            },
          ],
        }

        chart.setOption(option, true)
      } catch (err) {
        console.error("Failed to render LatencyTrendChart:", err)
      }
    }

    renderChart()

    let lastWidth = chartRef.current?.clientWidth || 0
    const handleResize = () => {
      const currentW = chartRef.current?.clientWidth || 0
      if ((lastWidth < 520 && currentW >= 520) || (lastWidth >= 520 && currentW < 520)) {
        lastWidth = currentW
        renderChart()
      } else {
        lastWidth = currentW
        chartInstanceRef.current?.resize()
      }
    }
    window.addEventListener("resize", handleResize)

    const handleDocumentTouch = (e: TouchEvent) => {
      if (chartRef.current && !chartRef.current.contains(e.target as Node)) {
        chartInstanceRef.current?.dispatchAction({ type: "hideTip" })
      }
    }
    document.addEventListener("touchstart", handleDocumentTouch, { passive: true })

    let resizeObserver: ResizeObserver | null = null
    if (chartRef.current) {
      resizeObserver = new ResizeObserver(() => {
        handleResize()
      })
      resizeObserver.observe(chartRef.current)
    }

    return () => {
      isDisposed = true
      window.removeEventListener("resize", handleResize)
      document.removeEventListener("touchstart", handleDocumentTouch)
      if (resizeObserver) resizeObserver.disconnect()
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose()
        chartInstanceRef.current = null
      }
    }
  }, [aggregatedData, isDarkMode, locale])

  if (aggregatedData.length === 0) {
    return null
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-black/[0.06] bg-white p-4 sm:p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] transition-all">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3.5 sm:pb-4 border-b border-neutral-100 dark:border-neutral-800 gap-3 sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#0066cc] dark:text-[#2997ff] shrink-0" />
            <h3 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 truncate">
              {t.trend.title}
            </h3>
          </div>
        </div>

        {latestBucket && (
          <div className="inline-flex items-center gap-2 sm:gap-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800/80 px-3 py-1 text-xs shrink-0 self-start md:self-auto">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">{t.map.timeRange.latest.split(" ")[0]}</span>
              <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                {latestBucket.overallAvgLatency.toFixed(1)}
                <span className="text-[10px] font-normal text-neutral-400 ml-0.5">{t.common.ms}</span>
              </span>
            </div>
            <span className="text-neutral-300 dark:text-neutral-700 text-xs">·</span>
            <div className="inline-flex items-baseline gap-1">
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                {t.trend.periodAvg}
              </span>
              <span className="font-mono font-bold text-[#0066cc] dark:text-[#2997ff] text-xs">
                {overallHistoryAvg}
                <span className="text-[10px] font-normal opacity-70 ml-0.5">{t.common.ms}</span>
              </span>
            </div>
            <span className="text-neutral-300 dark:text-neutral-700 text-xs">·</span>
            <div className="inline-flex items-baseline gap-1">
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                {t.trend.lossAvg}
              </span>
              <span className="font-mono font-bold text-[#f43f5e] text-xs">
                {overallHistoryLoss}%
              </span>
            </div>
            <span className="text-neutral-300 dark:text-neutral-700 text-xs">·</span>
            <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400">
              {aggregatedData.length} {t.trend.timeSlots}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 rounded-full bg-[#0066cc] dark:bg-[#2997ff]" />
            <span className="text-neutral-700 dark:text-neutral-300">{t.trend.compositeSeries}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="h-2 w-2 rounded-full bg-[#f43f5e]" />
            <span className="text-neutral-700 dark:text-neutral-300">{t.trend.lossSeries}</span>
          </span>
        </div>

        <span className="inline-flex items-center rounded-md bg-neutral-100 dark:bg-neutral-800/80 px-2 py-0.5 text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
          {t.trend.aggregate30m}
        </span>
      </div>

      <div className="mt-2 w-full">
        <div
          ref={chartRef}
          className="w-full h-[245px] sm:h-[255px] select-none"
        />
      </div>
    </div>
  )
}
