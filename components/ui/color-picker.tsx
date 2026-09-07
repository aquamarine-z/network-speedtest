"use client"

import * as React from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Pipette, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { t } from "@/locales"

const QUICK_PRESETS = [
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#84cc16",
  "#10b981",
  "#14b8a6",
  "#64748b",
  "#18181b",
]

export function hsvToHex(h: number, s: number, v: number): string {
  s = Math.max(0, Math.min(1, s / 100))
  v = Math.max(0, Math.min(1, v / 100))
  h = ((h % 360) + 360) % 360
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c
  } else {
    r = c; g = 0; b = x
  }
  const toHex = (n: number) => {
    const val = Math.round((n + m) * 255)
    const hex = Math.max(0, Math.min(255, val)).toString(16)
    return hex.length === 1 ? "0" + hex : hex
  }
  return "#" + toHex(r) + toHex(g) + toHex(b)
}

export function hexToHsv(hex: string, fallbackHue = 0): { h: number; s: number; v: number } {
  let cleaned = hex.replace("#", "").trim()
  if (cleaned.length === 3) {
    cleaned = cleaned.split("").map((c) => c + c).join("")
  }
  if (cleaned.length !== 6) return { h: fallbackHue, s: 0, v: 100 }
  const r = parseInt(cleaned.substring(0, 2), 16) / 255
  const g = parseInt(cleaned.substring(2, 4), 16) / 255
  const b = parseInt(cleaned.substring(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = fallbackHue
  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) * 60
    } else if (max === g) {
      h = ((b - r) / d + 2) * 60
    } else {
      h = ((r - g) / d + 4) * 60
    }
  }
  const s = max === 0 ? 0 : (d / max) * 100
  const v = max * 100
  return { h, s, v }
}

interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  className?: string
  triggerClassName?: string
  children?: React.ReactNode
}

export function ColorPicker({
  value,
  onChange,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  disabled = false,
  className,
  triggerClassName,
  children,
}: ColorPickerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const [color, setColor] = React.useState(value || "#8b5cf6")
  const [inputVal, setInputVal] = React.useState(value || "#8b5cf6")
  const [hsv, setHsv] = React.useState(() => hexToHsv(value || "#8b5cf6", 260))

  const hsvRef = React.useRef(hsv)
  hsvRef.current = hsv
  const isDraggingRef = React.useRef(false)
  const throttleTimerRef = React.useRef<NodeJS.Timeout | null>(null)
  const pendingColorRef = React.useRef<string | null>(null)
  const lastEmittedColorRef = React.useRef(value || "#8b5cf6")
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  const satContainerRef = React.useRef<HTMLDivElement | null>(null)
  const hueContainerRef = React.useRef<HTMLDivElement | null>(null)

  // 立即冲刷最终颜色给父组件
  const flushEnd = React.useCallback(() => {
    isDraggingRef.current = false
    if (throttleTimerRef.current !== null) {
      clearTimeout(throttleTimerRef.current)
      throttleTimerRef.current = null
    }
    const final = pendingColorRef.current || lastEmittedColorRef.current
    pendingColorRef.current = null
    if (final && final.toLowerCase() !== lastEmittedColorRef.current.toLowerCase()) {
      lastEmittedColorRef.current = final
      onChangeRef.current(final)
    }
  }, [])

  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        flushEnd()
      }
      if (!isControlled) {
        setUncontrolledOpen(newOpen)
      }
      controlledOnOpenChange?.(newOpen)
    },
    [isControlled, controlledOnOpenChange, flushEnd]
  )

  // 当弹窗打开时，初始化同步本地状态
  React.useEffect(() => {
    if (open) {
      const initial = value || "#8b5cf6"
      const parsed = hexToHsv(initial, hsvRef.current.h)
      setHsv(parsed)
      hsvRef.current = parsed
      setColor(initial)
      setInputVal(initial)
      lastEmittedColorRef.current = initial
      pendingColorRef.current = null
    }
  }, [open])

  // 弹窗未打开时，若外部传入的 value 发生变动（例如重置策略），同步更新
  React.useEffect(() => {
    if (!open && value && value.toLowerCase() !== lastEmittedColorRef.current.toLowerCase()) {
      const parsed = hexToHsv(value, hsvRef.current.h)
      setHsv(parsed)
      hsvRef.current = parsed
      setColor(value)
      setInputVal(value)
      lastEmittedColorRef.current = value
      pendingColorRef.current = null
    }
  }, [open, value])

  // 组件卸载时清理未完成的节流计时器
  React.useEffect(() => {
    return () => {
      if (throttleTimerRef.current !== null) {
        clearTimeout(throttleTimerRef.current)
        throttleTimerRef.current = null
      }
    }
  }, [])

  // 全局释放保护：防止用户在拾色器外松开指针导致拖拽状态未释放
  React.useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDraggingRef.current) {
        flushEnd()
      }
    }
    window.addEventListener("pointerup", handleGlobalPointerUp)
    window.addEventListener("pointercancel", handleGlobalPointerUp)
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp)
      window.removeEventListener("pointercancel", handleGlobalPointerUp)
      if (throttleTimerRef.current !== null) {
        clearTimeout(throttleTimerRef.current)
        throttleTimerRef.current = null
      }
    }
  }, [flushEnd])

  // 节流向父级派发更新（拖动期间限制为最高 ~8 次/秒，杜绝高频卡死与闪屏；本地 UI 则依然 120fps 实时渲染）
  const scheduleThrottledEmit = React.useCallback((newHex: string) => {
    pendingColorRef.current = newHex
    if (throttleTimerRef.current === null) {
      throttleTimerRef.current = setTimeout(() => {
        throttleTimerRef.current = null
        if (pendingColorRef.current) {
          const val = pendingColorRef.current
          pendingColorRef.current = null
          lastEmittedColorRef.current = val
          onChangeRef.current(val)
        }
      }, 120)
    }
  }, [])

  // 统一 HSV 变动入口
  const applyHsvChange = React.useCallback(
    (newHsv: { h: number; s: number; v: number }) => {
      hsvRef.current = newHsv
      setHsv(newHsv)
      const newHex = hsvToHex(newHsv.h, newHsv.s, newHsv.v)
      setColor(newHex)
      setInputVal(newHex)
      scheduleThrottledEmit(newHex)
    },
    [scheduleThrottledEmit]
  )

  // 饱和度/明度面板指针交互
  const updateSatFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!satContainerRef.current) return
    const rect = satContainerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
    const s = (x / rect.width) * 100
    const v = 100 - (y / rect.height) * 100
    applyHsvChange({ h: hsvRef.current.h, s, v })
  }

  const handleSatPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    isDraggingRef.current = true
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
    updateSatFromPointer(e)
  }

  const handleSatPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current && (e.buttons > 0 || e.pointerType === "touch")) {
      updateSatFromPointer(e)
    }
  }

  const handleSatPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
    flushEnd()
  }

  // 色相滑块指针交互
  const updateHueFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hueContainerRef.current) return
    const rect = hueContainerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    const h = (x / rect.width) * 360
    applyHsvChange({ h, s: hsvRef.current.s, v: hsvRef.current.v })
  }

  const handleHuePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    isDraggingRef.current = true
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {}
    updateHueFromPointer(e)
  }

  const handleHuePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current && (e.buttons > 0 || e.pointerType === "touch")) {
      updateHueFromPointer(e)
    }
  }

  const handleHuePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {}
    flushEnd()
  }

  // 处理输入框十六进制变更
  const handleHexChange = (val: string) => {
    setInputVal(val)
    if (/^#([0-9a-fA-F]{6})$/.test(val)) {
      if (throttleTimerRef.current !== null) {
        clearTimeout(throttleTimerRef.current)
        throttleTimerRef.current = null
      }
      isDraggingRef.current = false
      pendingColorRef.current = null
      const parsed = hexToHsv(val, hsvRef.current.h)
      hsvRef.current = parsed
      setHsv(parsed)
      setColor(val)
      lastEmittedColorRef.current = val
      onChangeRef.current(val)
    }
  }

  const handleHexBlur = () => {
    if (!/^#([0-9a-fA-F]{6})$/.test(inputVal)) {
      setInputVal(color)
    }
  }

  const handlePresetClick = (hex: string) => {
    if (throttleTimerRef.current !== null) {
      clearTimeout(throttleTimerRef.current)
      throttleTimerRef.current = null
    }
    isDraggingRef.current = false
    pendingColorRef.current = null
    const parsed = hexToHsv(hex, hsvRef.current.h)
    hsvRef.current = parsed
    setHsv(parsed)
    setColor(hex)
    setInputVal(hex)
    lastEmittedColorRef.current = hex
    onChangeRef.current(hex)
  }

  const handleEyeDropper = async () => {
    if (typeof window !== "undefined" && "EyeDropper" in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper()
        const result = await eyeDropper.open()
        if (result?.sRGBHex) {
          handlePresetClick(result.sRGBHex)
        }
      } catch {
        // 取消吸色
      }
    }
  }

  const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children ? (
          children
        ) : (
          <button
            type="button"
            className={cn(
              "group relative flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 outline-none focus:outline-none focus-visible:outline-none select-none cursor-pointer",
              triggerClassName
            )}
            title={t.common.colorPicker.open}
          >
            <span
              className="h-5 w-5 rounded-full shadow-xs flex items-center justify-center border border-black/10 dark:border-white/15"
              style={{ backgroundColor: open ? color : (value || "#8b5cf6") }}
            />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          if (isDraggingRef.current) {
            e.preventDefault()
          }
        }}
        onInteractOutside={(e) => {
          if (isDraggingRef.current) {
            e.preventDefault()
          }
        }}
        className={cn(
          "z-50 w-64 p-3.5 rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl shadow-2xl space-y-3",
          className
        )}
      >
        {/* 2D 饱和度与明度面板 */}
        <div
          ref={satContainerRef}
          role="slider"
          aria-label="Color saturation and brightness"
          tabIndex={0}
          onPointerDown={handleSatPointerDown}
          onPointerMove={handleSatPointerMove}
          onPointerUp={handleSatPointerUp}
          onPointerCancel={handleSatPointerUp}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 5 : 1
            if (e.key === "ArrowLeft") {
              e.preventDefault()
              applyHsvChange({ ...hsvRef.current, s: Math.max(0, hsvRef.current.s - step) })
            } else if (e.key === "ArrowRight") {
              e.preventDefault()
              applyHsvChange({ ...hsvRef.current, s: Math.min(100, hsvRef.current.s + step) })
            } else if (e.key === "ArrowDown") {
              e.preventDefault()
              applyHsvChange({ ...hsvRef.current, v: Math.max(0, hsvRef.current.v - step) })
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              applyHsvChange({ ...hsvRef.current, v: Math.min(100, hsvRef.current.v + step) })
            }
          }}
          className="relative w-full h-[140px] rounded-2xl overflow-hidden border border-black/[0.08] dark:border-white/[0.12] shadow-inner select-none touch-none cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{
            backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
          }}
        >
          {/* 水平白色渐变 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(to right, #ffffff, transparent)",
            }}
          />
          {/* 垂直黑色渐变 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(to top, #000000, transparent)",
            }}
          />
          {/* 颜色光标指示圈 */}
          <div
            className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md pointer-events-none ring-1 ring-black/25"
            style={{
              left: `${Math.max(0, Math.min(100, hsv.s))}%`,
              top: `${Math.max(0, Math.min(100, 100 - hsv.v))}%`,
              backgroundColor: color,
            }}
          />
        </div>

        {/* 1D 色相彩虹滑轨 */}
        <div
          ref={hueContainerRef}
          role="slider"
          aria-label="Color hue"
          tabIndex={0}
          onPointerDown={handleHuePointerDown}
          onPointerMove={handleHuePointerMove}
          onPointerUp={handleHuePointerUp}
          onPointerCancel={handleHuePointerUp}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 15 : 3
            if (e.key === "ArrowLeft") {
              e.preventDefault()
              applyHsvChange({ ...hsvRef.current, h: Math.max(0, hsvRef.current.h - step) })
            } else if (e.key === "ArrowRight") {
              e.preventDefault()
              applyHsvChange({ ...hsvRef.current, h: Math.min(360, hsvRef.current.h + step) })
            }
          }}
          className="relative w-full h-3.5 rounded-full border border-black/[0.08] dark:border-white/[0.12] shadow-inner select-none touch-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          style={{
            background:
              "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
          }}
        >
          {/* 色相光标指示圈 */}
          <div
            className="absolute top-1/2 w-4.5 h-4.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md pointer-events-none ring-1 ring-black/25"
            style={{
              left: `${Math.max(0, Math.min(100, (hsv.h / 360) * 100))}%`,
              backgroundColor: `hsl(${hsv.h}, 100%, 50%)`,
            }}
          />
        </div>

        {/* 颜色预览、十六进制输入与取色器 */}
        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-xl border border-black/10 dark:border-white/10 shadow-xs shrink-0"
            style={{ backgroundColor: color }}
          />
          <div className="relative flex-1">
            <Input
              type="text"
              value={inputVal}
              onChange={(e) => handleHexChange(e.target.value)}
              onBlur={handleHexBlur}
              placeholder="#8b5cf6"
              className="h-8 text-xs font-mono rounded-xl px-2.5 bg-neutral-50 dark:bg-neutral-900 border-neutral-200/80 dark:border-neutral-800 uppercase"
            />
          </div>
          {hasEyeDropper && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleEyeDropper}
              title={t.common.colorPicker.pipette}
              className="h-8 w-8 p-0 rounded-xl border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-black dark:hover:text-white cursor-pointer"
            >
              <Pipette className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* 预设色板快捷选取 */}
        <div className="space-y-1.5 pt-1 border-t border-black/[0.05] dark:border-white/[0.06]">
          <div className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
            {t.common.colorPicker.presetsTitle}
          </div>
          <div className="grid grid-cols-8 gap-1.5 w-full">
            {QUICK_PRESETS.map((hex) => {
              const isSelected = color.toLowerCase() === hex.toLowerCase()
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => handlePresetClick(hex)}
                  title={hex}
                  className="group/preset relative flex w-full aspect-square items-center justify-center rounded-lg transition-transform hover:scale-110 outline-none focus:outline-none focus-visible:outline-none cursor-pointer"
                  style={{ backgroundColor: hex }}
                >
                  {isSelected && (
                    <Check className="h-3 w-3 text-white stroke-[3] drop-shadow-sm" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
