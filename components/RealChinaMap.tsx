"use client"

import * as React from "react"
import { geoMercator, geoPath, geoArea } from "d3-geo"
import { useNetworkStore } from "@/store/useNetworkStore"
import { mapCityToProvince } from "@/lib/provinces"
import { SingleProbeResult, MapTimeRange, ProvinceMapStat, NetworkQualityTier } from "@/lib/types"
import { matchNetworkQuality, getQualityColorTheme, formatLatencyRange, formatLossRange } from "@/lib/quality-tiers"
import { MapPin, Calendar, ChevronRight, Activity, Zap, ChevronDown, Clock, ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react"
import { openRegionHistoryModal } from "@/components/RegionHistoryPopover"
import chinaGeoJson from "@/public/data/china.json"
import { t } from "@/locales"

interface GeoFeature {
  type: string
  properties: {
    name?: string
    adcode?: number | string
    center?: [number, number]
    centroid?: [number, number]
  }
  geometry: any
}

interface GeoJsonData {
  type: string
  features: GeoFeature[]
}

interface ProvinceStats {
  count: number
  avgLat: number
  loss: number
  probes: SingleProbeResult[]
}

function ensureProperWinding(geo: GeoJsonData): GeoJsonData {
  if (!geo?.features) return geo
  geo.features.forEach((f) => {
    try {
      if (geoArea(f as any) > 2 * Math.PI) {
        const geom = f.geometry
        if (geom.type === "Polygon") {
          geom.coordinates = geom.coordinates.map((ring: any) => ring.slice().reverse())
        } else if (geom.type === "MultiPolygon") {
          geom.coordinates = geom.coordinates.map((poly: any) => poly.map((ring: any) => ring.slice().reverse()))
        }
      }
    } catch {
      // Ignore single geometry exceptions
    }
  })
  return geo
}

interface ProvincePathProps {
  name: string
  d: string
  idx: number
  stat?: ProvinceStats
  isHovered: boolean
  qualityTiers: NetworkQualityTier[]
  onHover: (name: string) => void
  onSelect: (name: string) => void
}

const ProvincePath = React.memo(function ProvincePath({
  name,
  d,
  idx,
  stat,
  isHovered,
  qualityTiers,
  onHover,
  onSelect,
}: ProvincePathProps) {
  // 南海十段线 / 诸岛边界虚线特殊渲染
  if (!name) {
    return (
      <path
        key={`jd-line-${idx}`}
        d={d}
        vectorEffect="non-scaling-stroke"
        className="fill-none stroke-neutral-400/70 dark:stroke-neutral-500/70 stroke-[1] stroke-dasharray-[3,3] pointer-events-none opacity-60"
      />
    )
  }

  // 1. 省份具有真实探针数据 (按网络健康状态着色)
  if (stat && stat.count > 0) {
    const matched = matchNetworkQuality(stat.avgLat, stat.loss, qualityTiers)
    const theme = getQualityColorTheme(matched.color, matched.customColor)

    const fillColor = theme.isCustom ? undefined : (isHovered ? theme.hoverFillClass : theme.fillClass)
    const strokeColor = theme.isCustom ? undefined : `${theme.strokeClass} stroke-[1.2]`

    return (
      <path
        d={d}
        vectorEffect="non-scaling-stroke"
        className={`cursor-pointer transition-colors duration-150 ${fillColor || ""} ${strokeColor || ""}`}
        style={
          theme.isCustom
            ? {
                fill: isHovered ? `${theme.hex}55` : `${theme.hex}30`,
                stroke: isHovered ? theme.hex : `${theme.hex}cc`,
                strokeWidth: 1.2,
              }
            : undefined
        }
        onMouseEnter={() => onHover(name)}
        onClick={() => onSelect(name)}
      />
    )
  }

  // 2. 省份暂无在线探针数据 (严格灰度标记)
  const grayFill = isHovered
    ? "fill-neutral-300/60 dark:fill-[#26262a]"
    : "fill-neutral-200/40 dark:fill-[#1b1b1e]/85"
  const grayStroke = isHovered
    ? "stroke-neutral-400 dark:stroke-neutral-600 stroke-[1]"
    : "stroke-neutral-300/60 dark:stroke-neutral-800/80 stroke-[0.8]"

  return (
    <path
      d={d}
      vectorEffect="non-scaling-stroke"
      className={`cursor-pointer transition-colors duration-150 ${grayFill} ${grayStroke}`}
      onMouseEnter={() => onHover(name)}
      onClick={() => onSelect(name)}
    />
  )
})

export function RealChinaMap() {
  const { latestResult, carrierFilter, setCarrierFilter, qualityTiers } = useNetworkStore()
  const [geoData] = React.useState<GeoJsonData>(() => ensureProperWinding(chinaGeoJson as any))
  const [hoveredProvince, setHoveredProvince] = React.useState<string | null>(null)
  const [timeRange, setTimeRange] = React.useState<MapTimeRange>('7d')
  const [aggregatedMap, setAggregatedMap] = React.useState<Record<string, ProvinceMapStat>>({})
  const [isLoadingStats, setIsLoadingStats] = React.useState<boolean>(false)

  // 网络评级详情 Popover 浮窗状态 (选中的档位或 'uncovered')
  const [activeTierPopover, setActiveTierPopover] = React.useState<NetworkQualityTier | 'uncovered' | null>(null)
  const [isPopoverPinned, setIsPopoverPinned] = React.useState<boolean>(false)
  const popoverRef = React.useRef<HTMLDivElement>(null)
  const popoverTimerRef = React.useRef<NodeJS.Timeout | null>(null)

  const clearPopoverTimer = React.useCallback(() => {
    if (popoverTimerRef.current) {
      clearTimeout(popoverTimerRef.current)
      popoverTimerRef.current = null
    }
  }, [])

  const closePopover = React.useCallback(() => {
    clearPopoverTimer()
    setIsPopoverPinned(false)
    setActiveTierPopover(null)
  }, [clearPopoverTimer])

  const handleTierMouseEnter = React.useCallback((tier: NetworkQualityTier | 'uncovered') => {
    clearPopoverTimer()
    setActiveTierPopover(tier)
  }, [clearPopoverTimer])

  const handleTierMouseLeave = React.useCallback(() => {
    clearPopoverTimer()
    if (!isPopoverPinned) {
      popoverTimerRef.current = setTimeout(() => {
        setActiveTierPopover(null)
      }, 200)
    }
  }, [clearPopoverTimer, isPopoverPinned])

  const handleTierClick = React.useCallback((tier: NetworkQualityTier | 'uncovered') => {
    clearPopoverTimer()
    setActiveTierPopover((prev) => {
      const isSame = prev === tier || (prev !== null && prev !== 'uncovered' && tier !== 'uncovered' && prev.id === tier.id)
      if (isSame && isPopoverPinned) {
        setIsPopoverPinned(false)
        return null
      }
      setIsPopoverPinned(true)
      return tier
    })
  }, [clearPopoverTimer, isPopoverPinned])

  // 监听点击外部与 Esc 键自动关闭评级 Popover
  React.useEffect(() => {
    if (!activeTierPopover) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePopover()
      }
    }

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Element | null
      if (target?.closest?.("[data-tier-legend-button]")) {
        return
      }
      if (popoverRef.current && !popoverRef.current.contains(target as Node)) {
        closePopover()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("pointerdown", handleClickOutside)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("pointerdown", handleClickOutside)
    }
  }, [activeTierPopover, closePopover])

  // 缩放与平移状态 (缩放范围 1.0 ~ 4.0，严格限制边界绝不移出空白)
  const [zoom, setZoom] = React.useState<number>(1.0)
  const [pan, setPan] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = React.useState<boolean>(false)

  const hasDraggedRef = React.useRef<boolean>(false)
  const dragStartRef = React.useRef<{
    clientX: number
    clientY: number
    panX: number
    panY: number
  } | null>(null)

  const touchInfoRef = React.useRef<{
    mode: 'none' | 'pan' | 'pinch'
    startDist: number
    startZoom: number
    startPan: { x: number; y: number }
    focalSvg: { x: number; y: number }
    startTouch: { x: number; y: number }
  }>({
    mode: 'none',
    startDist: 0,
    startZoom: 1,
    startPan: { x: 0, y: 0 },
    focalSvg: { x: 480, y: 400 },
    startTouch: { x: 0, y: 0 },
  })

  // 使用 ref 直接操控 Tooltip 位置，脱离 React 重渲染循环，达到原生 120Hz 丝滑交互
  const containerRef = React.useRef<HTMLDivElement>(null)
  const tooltipRef = React.useRef<HTMLDivElement>(null)
  const svgRef = React.useRef<SVGSVGElement>(null)

  // 严格边界限制计算：缩放后地图绝对不允许移出视口边界
  const clampPan = React.useCallback((targetX: number, targetY: number, currentZoom: number) => {
    if (currentZoom <= 1.001) {
      return { x: 0, y: 0 }
    }
    // SVG viewBox 规范尺寸为 960 x 800
    const minX = (1 - currentZoom) * 960
    const minY = (1 - currentZoom) * 800
    return {
      x: Math.min(0, Math.max(minX, targetX)),
      y: Math.min(0, Math.max(minY, targetY)),
    }
  }, [])

  // 视口焦点缩放 (以 SVG 视口中心 480, 400 为基准平滑缩放)
  const handleZoomTo = React.useCallback((nextZoom: number) => {
    setZoom((currentZoom) => {
      const clampedZoom = Math.min(4.0, Math.max(1.0, nextZoom))
      if (clampedZoom <= 1.001) {
        setPan({ x: 0, y: 0 })
        return 1.0
      }
      const fx = 480
      const fy = 400
      setPan((currentPan) => {
        const newPanX = fx - (fx - currentPan.x) * (clampedZoom / currentZoom)
        const newPanY = fy - (fy - currentPan.y) * (clampedZoom / currentZoom)
        return clampPan(newPanX, newPanY, clampedZoom)
      })
      return clampedZoom
    })
  }, [clampPan])

  const handleZoomIn = React.useCallback(() => {
    handleZoomTo(Math.min(4.0, Math.round((zoom + 0.35) * 10) / 10))
  }, [handleZoomTo, zoom])

  const handleZoomOut = React.useCallback(() => {
    handleZoomTo(Math.max(1.0, Math.round((zoom - 0.35) * 10) / 10))
  }, [handleZoomTo, zoom])

  const handleReset = React.useCallback(() => {
    setZoom(1.0)
    setPan({ x: 0, y: 0 })
  }, [])

  // 鼠标滚轮缩放监听 (以鼠标悬停处在地图上的 SVG 坐标为焦点)
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const fx = (e.clientX - rect.left) * (960 / rect.width)
      const fy = (e.clientY - rect.top) * (800 / rect.height)

      const factor = e.deltaY < 0 ? 1.15 : 0.87
      setZoom((currentZoom) => {
        const targetZoom = Math.min(4.0, Math.max(1.0, currentZoom * factor))
        if (targetZoom <= 1.001) {
          setPan({ x: 0, y: 0 })
          return 1.0
        }
        setPan((currentPan) => {
          const newPanX = fx - (fx - currentPan.x) * (targetZoom / currentZoom)
          const newPanY = fy - (fy - currentPan.y) * (targetZoom / currentZoom)
          return clampPan(newPanX, newPanY, targetZoom)
        })
        return targetZoom
      })
    }

    container.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      container.removeEventListener("wheel", onWheel)
    }
  }, [clampPan])

  // 全局捕获 mouseup，即使鼠标甩出容器也能干净释放拖拽状态
  React.useEffect(() => {
    if (!isDragging) return
    const onWindowMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
      setTimeout(() => {
        hasDraggedRef.current = false
      }, 80)
    }
    window.addEventListener("mouseup", onWindowMouseUp)
    return () => {
      window.removeEventListener("mouseup", onWindowMouseUp)
    }
  }, [isDragging])

  // 动态获取大屏地图聚合数据
  const fetchMapStats = React.useCallback(async (range: MapTimeRange) => {
    try {
      setIsLoadingStats(true)
      const res = await fetch(`/api/map-stats?range=${range}`)
      if (res.ok) {
        const data = await res.json()
        if (data.provinces) {
          setAggregatedMap(data.provinces)
        }
      }
    } catch (err) {
      console.error('Failed to fetch map stats:', err)
    } finally {
      setIsLoadingStats(false)
    }
  }, [])

  React.useEffect(() => {
    fetchMapStats(timeRange)
  }, [timeRange, fetchMapStats, latestResult])

  // 基础地图设定 (viewBox 0 0 960 800，增大缩放比例至 770，使全中国版图填满画面)
  const width = 960
  const height = 800

  const projection = React.useMemo(() => {
    return geoMercator()
      .center([104.5, 36.2])
      .scale(770)
      .translate([width / 2, 360])
  }, [width, height])

  const pathGenerator = React.useMemo(() => {
    return geoPath().projection(projection)
  }, [projection])

  // 一次性预编译所有省份的 SVG 路径 d 属性与中心坐标
  const precomputedFeatures = React.useMemo(() => {
    if (!geoData?.features) return []
    return geoData.features.map((feature, idx) => ({
      feature,
      idx,
      name: feature.properties.name || "",
      center: feature.properties.center || feature.properties.centroid || null,
      d: pathGenerator(feature as any) || "",
    }))
  }, [geoData, pathGenerator])

  // 省份中心坐标速查表，用于在聚合历史模式下定位呼吸脉冲圆点
  const provinceCenterMap = React.useMemo(() => {
    const map = new Map<string, [number, number]>()
    precomputedFeatures.forEach((item) => {
      if (item.name && item.center) {
        map.set(item.name, item.center as [number, number])
      }
    })
    return map
  }, [precomputedFeatures])

  // 按省份归集探针与统计数据（根据所选时间周期与运营商过滤）
  const provinceStats = React.useMemo(() => {
    const map = new Map<string, ProvinceStats>()

    if (timeRange === 'latest') {
      if (latestResult?.probes && latestResult.probes.length > 0) {
        const filtered = carrierFilter === "all"
          ? latestResult.probes
          : latestResult.probes.filter((p) => p.carrier === carrierFilter)

        for (const p of filtered) {
          const prov = mapCityToProvince(p.probe.city)
          const existing = map.get(prov) || { count: 0, avgLat: 0, loss: 0, probes: [] }
          existing.count += 1
          existing.probes.push(p)
          const currentSum = (existing.avgLat * (existing.count - 1)) + (p.stats?.avg ?? 0)
          existing.avgLat = Math.round((currentSum / existing.count) * 10) / 10
          existing.loss = Math.max(existing.loss, p.stats?.loss ?? 0)
          map.set(prov, existing)
        }
        return map
      }
    }

    // 历史聚合模式 (7d / 30d / today / 或 latest 数据源回退)
    Object.values(aggregatedMap).forEach((stat) => {
      let count = 0
      let avgLat = 0
      let loss = 0

      if (carrierFilter === 'all') {
        count = stat.count
        avgLat = stat.avgLat
        loss = stat.loss
      } else {
        const carrierStat = stat.carriers?.[carrierFilter]
        if (carrierStat) {
          count = carrierStat.count
          avgLat = carrierStat.avgLat
          loss = carrierStat.loss
        }
      }

      if (count > 0) {
        map.set(stat.province, {
          count,
          avgLat,
          loss,
          probes: [],
        })
      }
    })

    return map
  }, [timeRange, latestResult, carrierFilter, aggregatedMap])

  // 计算探针在地图上的经纬度投影
  const activeProbes = React.useMemo(() => {
    if (timeRange === 'latest' && latestResult?.probes && latestResult.probes.length > 0) {
      const list = carrierFilter === "all"
        ? latestResult.probes
        : latestResult.probes.filter((p) => p.carrier === carrierFilter)

      return list.map((p) => {
        const coords = projection([p.probe.longitude, p.probe.latitude])
        return {
          id: p.id,
          coords: coords ? { x: coords[0], y: coords[1] } : null,
          avg: p.stats?.avg ?? 40,
          loss: p.stats?.loss ?? 0,
          provinceName: mapCityToProvince(p.probe.city),
        }
      }).filter((p): p is { id: string; coords: { x: number; y: number }; avg: number; loss: number; provinceName: string } => p.coords !== null)
    }

    // 历史聚合模式：为有测速记录的省份展示呼吸脉冲节点
    const list: { id: string; coords: { x: number; y: number }; avg: number; loss: number; provinceName: string }[] = []
    provinceStats.forEach((stat, provName) => {
      if (stat.count > 0) {
        const center = provinceCenterMap.get(provName)
        if (center) {
          const coords = projection(center)
          if (coords) {
            list.push({
              id: `agg-node-${provName}`,
              coords: { x: coords[0], y: coords[1] },
              avg: stat.avgLat,
              loss: stat.loss,
              provinceName: provName,
            })
          }
        }
      }
    })
    return list
  }, [timeRange, latestResult, carrierFilter, projection, provinceStats, provinceCenterMap])

  // 高性能鼠标移动跟随：利用 translate3d GPU 硬件加速，不触发组件任何 Re-render
  const handleContainerMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!tooltipRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const tooltipWidth = 280
    const tooltipHeight = 140
    const clampedX = Math.min(Math.max(x + 16, 12), rect.width - tooltipWidth - 12)
    // 光标靠上时提示窗显于下方，反之显于上方，杜绝浮窗遮挡鼠标引起反复触发
    const clampedY = y < tooltipHeight + 30 ? y + 20 : y - tooltipHeight - 12
    tooltipRef.current.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0)`
  }, [])

  // 鼠标拖拽平移事件 (单手指/鼠标按住平移)
  const handleMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    setIsDragging(true)
    hasDraggedRef.current = false
  }, [pan.x, pan.y])

  const handleMouseMove = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) {
      handleContainerMouseMove(e)
    } else {
      setHoveredProvince(null)
    }

    if (!isDragging || !dragStartRef.current || !containerRef.current) return

    const dx = e.clientX - dragStartRef.current.clientX
    const dy = e.clientY - dragStartRef.current.clientY

    if (Math.hypot(dx, dy) > 5) {
      hasDraggedRef.current = true
    }

    if (zoom > 1.0) {
      const rect = containerRef.current.getBoundingClientRect()
      const deltaSvgX = dx * (960 / rect.width)
      const deltaSvgY = dy * (800 / rect.height)
      const newX = dragStartRef.current.panX + deltaSvgX
      const newY = dragStartRef.current.panY + deltaSvgY
      setPan(clampPan(newX, newY, zoom))
    }
  }, [isDragging, zoom, clampPan, handleContainerMouseMove])

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false)
    dragStartRef.current = null
    setTimeout(() => {
      hasDraggedRef.current = false
    }, 80)
  }, [])

  // 移动端单指平移与双指捏合缩放手势 (Touch Events)
  const handleTouchStart = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()

    if (e.touches.length === 1) {
      touchInfoRef.current = {
        mode: 'pan',
        startDist: 0,
        startZoom: zoom,
        startPan: { ...pan },
        focalSvg: { x: 480, y: 400 },
        startTouch: { x: e.touches[0].clientX, y: e.touches[0].clientY },
      }
      hasDraggedRef.current = false
      setIsDragging(true)
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      const dist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
      const midX = (t0.clientX + t1.clientX) / 2
      const midY = (t0.clientY + t1.clientY) / 2

      const fx = (midX - rect.left) * (960 / rect.width)
      const fy = (midY - rect.top) * (800 / rect.height)

      touchInfoRef.current = {
        mode: 'pinch',
        startDist: dist,
        startZoom: zoom,
        startPan: { ...pan },
        focalSvg: { x: fx, y: fy },
        startTouch: { x: midX, y: midY },
      }
      hasDraggedRef.current = true
      setIsDragging(true)
      setHoveredProvince(null)
    }
  }, [zoom, pan])

  const handleTouchMove = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    const info = touchInfoRef.current

    if (e.touches.length === 1 && info.mode === 'pan') {
      const touch = e.touches[0]
      const dx = touch.clientX - info.startTouch.x
      const dy = touch.clientY - info.startTouch.y

      if (Math.hypot(dx, dy) > 6) {
        hasDraggedRef.current = true
        setHoveredProvince(null)
      }

      if (zoom > 1.0) {
        const rect = containerRef.current.getBoundingClientRect()
        const deltaSvgX = dx * (960 / rect.width)
        const deltaSvgY = dy * (800 / rect.height)
        const newX = info.startPan.x + deltaSvgX
        const newY = info.startPan.y + deltaSvgY
        setPan(clampPan(newX, newY, zoom))
      }
    } else if (e.touches.length === 2 && info.mode === 'pinch') {
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      const currentDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY)
      if (info.startDist > 0) {
        const scaleFactor = currentDist / info.startDist
        const targetZoom = Math.min(4.0, Math.max(1.0, info.startZoom * scaleFactor))
        setZoom(targetZoom)

        if (targetZoom <= 1.001) {
          setPan({ x: 0, y: 0 })
        } else {
          const { x: fx, y: fy } = info.focalSvg
          const newPanX = fx - (fx - info.startPan.x) * (targetZoom / info.startZoom)
          const newPanY = fy - (fy - info.startPan.y) * (targetZoom / info.startZoom)
          setPan(clampPan(newPanX, newPanY, targetZoom))
        }
      }
    }
  }, [zoom, clampPan])

  const handleTouchEnd = React.useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) {
      touchInfoRef.current.mode = 'none'
      setIsDragging(false)
      setTimeout(() => {
        hasDraggedRef.current = false
      }, 80)
    } else if (e.touches.length === 1) {
      touchInfoRef.current = {
        mode: 'pan',
        startDist: 0,
        startZoom: zoom,
        startPan: { ...pan },
        focalSvg: { x: 480, y: 400 },
        startTouch: { x: e.touches[0].clientX, y: e.touches[0].clientY },
      }
    }
  }, [zoom, pan])

  const handleHover = React.useCallback((name: string) => {
    if (isDragging || hasDraggedRef.current) return
    setHoveredProvince(name)
  }, [isDragging])

  const handleSelect = React.useCallback((name: string) => {
    if (hasDraggedRef.current) return
    if (name) {
      void openRegionHistoryModal(name)
    }
  }, [])

  const activeStat = hoveredProvince ? provinceStats.get(hoveredProvince) : undefined

  return (
    <div className="relative overflow-hidden rounded-3xl border border-black/[0.06] bg-white p-4 sm:p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] transition-all">
      {/* 头部标题与控制栏（Apple HIG 分层布局） */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff]">
              <MapPin className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                {t.map.title}
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex h-9 items-center rounded-xl bg-neutral-100 p-0.5 dark:bg-neutral-800/80 border border-black/[0.05] dark:border-white/[0.06]">
              {[
                { key: "all", label: t.map.tabs.all },
                { key: "telecom", label: t.map.tabs.telecom },
                { key: "unicom", label: t.map.tabs.unicom },
                { key: "mobile", label: t.map.tabs.mobile },
                { key: "edu", label: t.map.tabs.edu },
              ].map((tab) => {
                const isActive = carrierFilter === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setCarrierFilter(tab.key as any)}
                    type="button"
                    className={`h-8 px-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-white text-neutral-900 shadow-xs dark:bg-[#1c1c1e] dark:text-neutral-100 font-semibold"
                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            <div className="relative inline-flex h-9 items-center">
              <div className="pointer-events-none absolute left-3 flex items-center text-neutral-400 dark:text-neutral-500">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as MapTimeRange)}
                aria-label={t.map.selectAriaLabel}
                className="h-9 appearance-none cursor-pointer rounded-xl border border-black/[0.06] bg-neutral-100 py-1.5 pl-8 pr-8 text-xs font-medium text-neutral-800 outline-none transition-all hover:bg-neutral-200/60 focus:border-[#0066cc] focus:ring-2 focus:ring-[#0066cc]/15 dark:border-white/[0.08] dark:bg-neutral-800/80 dark:text-neutral-200 dark:hover:bg-neutral-700/60 dark:focus:border-[#2997ff]"
              >
                <option value="7d">{t.map.timeRange.sevenDays}</option>
                <option value="30d">{t.map.timeRange.thirtyDays}</option>
                <option value="today">{t.map.timeRange.today}</option>
                <option value="latest">{t.map.timeRange.latest}</option>
              </select>
              <div className="pointer-events-none absolute right-2.5 flex items-center text-neutral-400 dark:text-neutral-500">
                <ChevronDown className="h-3.5 w-3.5" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs text-neutral-400 dark:text-neutral-500 pt-1 relative">
          <p className="flex items-center gap-1.5 leading-normal">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0066cc] dark:bg-[#2997ff] shrink-0" />
            <span>{t.map.hint}</span>
          </p>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {qualityTiers.map((tier) => {
              const theme = getQualityColorTheme(tier.color, tier.customColor)
              const isSelected = activeTierPopover && activeTierPopover !== "uncovered" && activeTierPopover.id === tier.id
              return (
                <button
                  key={tier.id}
                  type="button"
                  data-tier-legend-button="true"
                  onMouseEnter={() => handleTierMouseEnter(tier)}
                  onMouseLeave={handleTierMouseLeave}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTierClick(tier)
                  }}
                  title={`「${tier.label}」${t.map.legendTooltipSuffix}`}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium cursor-pointer transition-colors duration-150 select-none outline-none focus:outline-none ${
                    theme.badgeClass
                  } ${
                    isSelected
                      ? "font-semibold brightness-95 dark:brightness-110"
                      : "hover:opacity-80"
                  }`}
                  style={
                    theme.isCustom
                      ? {
                          color: theme.hex,
                          backgroundColor: isSelected ? `${theme.hex}28` : `${theme.hex}14`,
                          borderColor: `${theme.hex}40`,
                        }
                      : undefined
                  }
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${theme.dotClass}`}
                    style={theme.isCustom ? { backgroundColor: theme.hex } : undefined}
                  />
                  <span>{tier.label}</span>
                </button>
              )
            })}
            <button
              type="button"
              data-tier-legend-button="true"
              onMouseEnter={() => handleTierMouseEnter("uncovered")}
              onMouseLeave={handleTierMouseLeave}
              onClick={(e) => {
                e.stopPropagation()
                handleTierClick("uncovered")
              }}
              title={t.map.uncoveredTitle}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium cursor-pointer transition-colors duration-150 select-none outline-none focus:outline-none ${
                activeTierPopover === "uncovered"
                  ? "bg-neutral-300/80 text-neutral-800 dark:bg-neutral-700/80 dark:text-neutral-200 font-semibold"
                  : "bg-neutral-200/60 text-neutral-500 hover:opacity-80 dark:bg-neutral-800/60 dark:text-neutral-400"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
              <span>{t.map.uncovered}</span>
            </button>
          </div>

          {activeTierPopover && (
            <div
              ref={popoverRef}
              onMouseEnter={clearPopoverTimer}
              onMouseLeave={handleTierMouseLeave}
              className="absolute top-full right-0 mt-2 z-50 w-64 sm:w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-black/[0.08] bg-white/95 p-3.5 shadow-xl backdrop-blur-2xl dark:border-white/[0.12] dark:bg-[#1c1c1e]/95 animate-in fade-in zoom-in-95 duration-150 space-y-2.5"
            >
              {activeTierPopover === "uncovered" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-neutral-400 dark:bg-neutral-500" />
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        {t.map.uncovered}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={closePopover}
                      className="flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed pt-0.5">
                    {t.map.uncoveredDesc}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {(() => {
                    const theme = getQualityColorTheme(activeTierPopover.color, activeTierPopover.customColor)

                    return (
                      <>
                        <div className="flex items-center justify-between pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2.5 w-2.5 rounded-full shadow-xs ${theme.dotClass}`}
                              style={theme.isCustom ? { backgroundColor: theme.hex } : undefined}
                            />
                            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                              {activeTierPopover.label}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={closePopover}
                            className="flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 py-1">
                          <div>
                            <span className="block text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                              {t.map.avgLatency}
                            </span>
                            <span className="font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5 block">
                              {formatLatencyRange(activeTierPopover)}
                            </span>
                          </div>

                          <div>
                            <span className="block text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                              {t.map.lossRate}
                            </span>
                            <span className="font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5 block">
                              {formatLossRange(activeTierPopover)}
                            </span>
                          </div>
                        </div>

                        {activeTierPopover.description && activeTierPopover.description.trim() ? (
                          <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                              {activeTierPopover.description}
                            </p>
                          </div>
                        ) : null}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 地图主体区域 */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseLeave={() => setHoveredProvince(null)}
        className={`relative mt-4 w-full overflow-hidden rounded-2xl bg-[#fafafa]/80 dark:bg-black/30 border border-black/[0.04] dark:border-white/[0.05] select-none ${
          zoom > 1.001
            ? isDragging
              ? "cursor-grabbing touch-none"
              : "cursor-grab touch-none"
            : "touch-pan-y"
        }`}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[700px] select-none pointer-events-auto"
        >
          <defs>
            {/* 细腻微点阵底纹 */}
            <pattern
              id="chinaGrid"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="12"
                cy="12"
                r="0.8"
                fill="currentColor"
                className="text-neutral-300/60 dark:text-neutral-700/60"
              />
              <path
                d="M 24 0 L 0 0 0 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.4"
                className="text-neutral-200/40 dark:text-neutral-800/40"
              />
            </pattern>
          </defs>

          {/* 网格底纹 */}
          <rect width="100%" height="100%" fill="url(#chinaGrid)" />

          {/* 缩放与平移变换组 */}
          <g
            transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
            style={{
              transformOrigin: "0 0",
              transition: isDragging ? "none" : "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >

          {/* 1. 渲染全国各省份矢量轮廓（已提取为 Memoized 高性能渲染） */}
          <g>
            {precomputedFeatures.map((item) => (
              <ProvincePath
                key={`prov-${item.idx}-${item.name}`}
                name={item.name}
                d={item.d}
                idx={item.idx}
                stat={provinceStats.get(item.name)}
                isHovered={hoveredProvince === item.name}
                qualityTiers={qualityTiers}
                onHover={handleHover}
                onSelect={handleSelect}
              />
            ))}
          </g>

          {/* 2. 探针脉冲光圈与物理节点（点击进入详情） */}
          <g>
            {activeProbes.map((p) => {
              if (!p.coords) return null
              const { x, y } = p.coords
              const avg = p.avg
              const loss = p.loss

              const matchedTier = matchNetworkQuality(avg, loss, qualityTiers)
              const theme = getQualityColorTheme(matchedTier.color, matchedTier.customColor)
              const color = theme.hex

              const provName = p.provinceName

              return (
                <g
                  key={`dot-${p.id}`}
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (hasDraggedRef.current) return
                    handleSelect(provName)
                  }}
                  onMouseEnter={() => handleHover(provName)}
                >
                  {/* 透明固定碰撞区 (Hitbox)：足够大且位置固定，杜绝动画导致的频繁进出事件 */}
                  <circle
                    cx={x}
                    cy={y}
                    r="14"
                    fill="transparent"
                  />
                  {/* 呼吸脉冲光圈：必须禁用鼠标事件 pointer-events-none，防止扩散时边缘截断触发抖动 */}
                  <circle
                    cx={x}
                    cy={y}
                    r="10"
                    fill="none"
                    stroke={color}
                    strokeWidth="1.8"
                    className="animate-radar pointer-events-none"
                    style={{ transformOrigin: `${x}px ${y}px`, vectorEffect: "non-scaling-stroke" }}
                  />
                  {/* 实体核心小圆点：禁用鼠标事件，通过 group-hover 优雅放大，彻底告别抖动 */}
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill={color}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="drop-shadow-sm pointer-events-none transition-transform duration-150 group-hover:scale-125"
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  />
                </g>
              )
            })}
          </g>
          </g>
        </svg>

        {/* 鼠标悬浮 Apple 极简毛玻璃浮窗 (60/120Hz 硬件加速，pointer-events-none 彻底避免遮挡光标引发闪烁) */}
        <div
          ref={tooltipRef}
          className={`absolute top-0 left-0 pointer-events-none z-30 w-[280px] rounded-2xl border border-black/[0.08] bg-white/95 p-3.5 shadow-xl backdrop-blur-xl dark:border-white/[0.12] dark:bg-[#1c1c1e]/95 transition-opacity duration-150 ${
            hoveredProvince ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
        >
          {hoveredProvince && (
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                    {hoveredProvince}
                  </span>
                  <span className="rounded-md bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 shrink-0 whitespace-nowrap">
                    {timeRange === '7d' ? t.map.timeRange.sevenDays : timeRange === '30d' ? t.map.timeRange.thirtyDays : timeRange === 'today' ? t.map.timeRange.today : t.map.timeRange.latest}
                  </span>
                </div>

                {activeStat && activeStat.count > 0 ? (
                  (() => {
                    const matchedTier = matchNetworkQuality(activeStat.avgLat, activeStat.loss, qualityTiers)
                    const theme = getQualityColorTheme(matchedTier.color, matchedTier.customColor)
                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 whitespace-nowrap ${theme.badgeClass}`}
                        style={theme.isCustom ? { color: theme.hex, backgroundColor: `${theme.hex}18`, borderColor: `${theme.hex}40` } : undefined}
                      >
                        <Zap className="h-2.5 w-2.5 shrink-0" />
                        <span>{matchedTier.label}</span>
                      </span>
                    )
                  })()
                ) : (
                  <span className="rounded-full bg-neutral-200/80 px-2 py-0.5 text-[10px] font-medium text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 shrink-0 whitespace-nowrap">
                    {t.map.noOnlineProbes}
                  </span>
                )}
              </div>

              {activeStat && activeStat.count > 0 ? (
                <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-neutral-100 pt-2 text-center text-xs dark:border-neutral-800">
                  <div>
                    <div className="text-[10px] text-neutral-400 whitespace-nowrap">{t.map.avgLatency}</div>
                    <div className="mt-0.5 font-semibold font-mono text-neutral-900 dark:text-neutral-100">
                      {activeStat.avgLat} <span className="text-[9px] font-normal font-sans text-neutral-400">{t.common.ms}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-400 whitespace-nowrap">{t.map.lossRate}</div>
                    <div
                      className={`mt-0.5 font-semibold font-mono ${
                        activeStat.loss > 0 ? "text-rose-500" : "text-emerald-500"
                      }`}
                    >
                      {activeStat.loss}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neutral-400 whitespace-nowrap">
                      {timeRange === 'latest' ? t.map.probesCountLabel : t.map.sampleCountLabel}
                    </div>
                    <div className="mt-0.5 font-semibold font-mono text-neutral-900 dark:text-neutral-100">
                      {activeStat.count} <span className="text-[9px] font-normal font-sans text-neutral-400">{timeRange === 'latest' ? t.common.units.nodes : t.map.timesUnit}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-2.5 border-t border-neutral-100 pt-2 text-xs text-neutral-400 dark:border-neutral-800 space-y-1">
                  <p className="leading-relaxed">
                    {hoveredProvince}: {t.map.uncoveredDesc}
                  </p>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-neutral-100/80 pt-2 text-[11px] font-medium text-[#0066cc] dark:border-neutral-800/80 dark:text-[#2997ff]">
                <span>{t.map.clickToOpenHistory}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 flex items-center gap-1 rounded-2xl border border-black/[0.08] bg-white/90 p-1 shadow-lg backdrop-blur-xl dark:border-white/[0.12] dark:bg-[#1c1c1e]/90 transition-all">
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 4.0}
            aria-label={t.map.zoomIn}
            title={t.map.zoomIn}
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl text-neutral-700 hover:bg-black/[0.05] active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed dark:text-neutral-200 dark:hover:bg-white/[0.08] transition-all"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            title={t.map.resetZoom}
            className="px-1.5 py-1 text-[11px] font-semibold tracking-tight text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 1.0}
            aria-label={t.map.zoomOut}
            title={t.map.zoomOut}
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl text-neutral-700 hover:bg-black/[0.05] active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed dark:text-neutral-200 dark:hover:bg-white/[0.08] transition-all"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          {zoom > 1.001 && (
            <>
              <div className="h-4 w-[1px] bg-black/[0.08] dark:bg-white/[0.12] mx-0.5" />
              <button
                type="button"
                onClick={handleReset}
                aria-label={t.map.resetZoom}
                title={t.map.resetZoom}
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl text-[#0066cc] hover:bg-[#0066cc]/10 active:scale-95 dark:text-[#2997ff] dark:hover:bg-[#2997ff]/15 transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 pointer-events-none z-10 hidden sm:flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-[11px] text-neutral-500 shadow-sm backdrop-blur-md dark:bg-[#1c1c1e]/85 dark:text-neutral-400">
          <Activity className="h-3 w-3 text-[#0066cc] dark:text-[#2997ff]" />
          <span>
            {zoom > 1.0 ? t.map.hint : t.map.clickToOpenHistory}
          </span>
        </div>
      </div>
    </div>
  )
}
