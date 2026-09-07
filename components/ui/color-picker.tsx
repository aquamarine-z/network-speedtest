"use client"

import * as React from "react"
import { HexColorPicker } from "react-colorful"
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
  const setOpen = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen)
      }
      controlledOnOpenChange?.(newOpen)
    },
    [isControlled, controlledOnOpenChange]
  )

  // 内部维护活跃颜色与输入框状态
  const [color, setColor] = React.useState(value || "#8b5cf6")
  const [inputVal, setInputVal] = React.useState(value || "#8b5cf6")

  const rafIdRef = React.useRef<number | null>(null)
  const lastEmittedColorRef = React.useRef(value || "#8b5cf6")
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  // 弹窗打开时，初始化同步本地状态；若弹窗未打开，外部 value 变更时同步本地状态
  React.useEffect(() => {
    if (open) {
      const initial = value || "#8b5cf6"
      setColor(initial)
      setInputVal(initial)
      lastEmittedColorRef.current = initial
    }
  }, [open])

  React.useEffect(() => {
    // 仅在弹窗未打开时响应外部传入的 value 变更（例如父组件重置默认值）
    // 弹窗打开期间完全由用户本地交互主导，杜绝父子组件间 state-prop 互踩引发的死循环
    if (!open && value) {
      setColor(value)
      setInputVal(value)
      lastEmittedColorRef.current = value
    }
  }, [open, value])

  // 弹窗关闭时，如果还有未冲刷的 RAF，立即冲刷最后选中的颜色
  React.useEffect(() => {
    if (!open && rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
      onChangeRef.current(lastEmittedColorRef.current)
    }
  }, [open])

  // 组件卸载时清理 RAF
  React.useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
    }
  }, [])

  // 处理输入框十六进制变更
  const handleHexChange = (val: string) => {
    setInputVal(val)
    if (/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(val)) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
        rafIdRef.current = null
      }
      setColor(val)
      lastEmittedColorRef.current = val
      onChangeRef.current(val)
    }
  }

  const handleHexBlur = () => {
    if (!/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(inputVal)) {
      setInputVal(color)
    }
  }

  // HexColorPicker 拖拽与选色回调
  // 本地 color 立即同步（保证与 react-colorful 内部同步，光标随鼠标 60/120fps 丝滑跟随，绝不卡顿、绝不回弹）
  // HexColorPicker 拖拽与选色回调
  // 本地 color 立即同步（保证与 react-colorful 内部同步，光标随鼠标 60/120fps 丝滑跟随，绝不卡顿、绝不回弹）
  // 向父组件派发则使用 requestAnimationFrame 合并为一帧一次，避免高频 mousemove 导致父级全量重渲染过载
  const handlePickerChange = React.useCallback((newColor: string) => {
    setColor(newColor)
    setInputVal(newColor)
    lastEmittedColorRef.current = newColor

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        onChangeRef.current(lastEmittedColorRef.current)
      })
    }
  }, [])

  // 拖拽或点击结束回调，立即冲刷最后一次颜色到父级
  const handlePickerChangeEnd = React.useCallback((newColor?: string) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    const final = newColor || lastEmittedColorRef.current
    if (final) {
      setColor(final)
      setInputVal(final)
      lastEmittedColorRef.current = final
      onChangeRef.current(final)
    }
  }, [])

  const handlePresetClick = (hex: string) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
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
        // Ignored or cancelled by user
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
          // 如果点击或拖拽是在色盘区域内部（包含快速滑出色盘边缘的 mousemove），防止关闭中断拖拽
          const target = e.target as HTMLElement | null
          if (target?.closest?.('.react-colorful')) {
            e.preventDefault()
          }
        }}
        className={cn(
          "z-50 w-64 p-3.5 rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl shadow-2xl space-y-3",
          className
        )}
      >
        <div
          className="w-full overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-xs select-none touch-none"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <HexColorPicker
            color={color}
            onChange={handlePickerChange}
            onChangeEnd={handlePickerChangeEnd}
            style={{ width: "100%", height: 164 }}
          />
        </div>

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
