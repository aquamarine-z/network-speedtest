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

  // pickerColor 是传给 HexColorPicker 的受控色彩，在拖拽期间保持不变，彻底杜绝 react-colorful 内部 Effect 1 触发死循环
  const [pickerColor, setPickerColor] = React.useState(value || "#8b5cf6")
  // localColor 与 inputVal 用于实时响应预览色块和十六进制输入框
  const [localColor, setLocalColor] = React.useState(value || "#8b5cf6")
  const [inputVal, setInputVal] = React.useState(value || "#8b5cf6")

  const isDraggingRef = React.useRef(false)
  const rafIdRef = React.useRef<number | null>(null)
  const pendingColorRef = React.useRef(value || "#8b5cf6")
  const lastEmittedColorRef = React.useRef(value || "#8b5cf6")
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  // 当外部传入的 value 发生非拖拽变更时（例如重置策略），同步更新内部各状态
  React.useEffect(() => {
    if (isDraggingRef.current) return
    if (value && value.toLowerCase() !== lastEmittedColorRef.current.toLowerCase()) {
      lastEmittedColorRef.current = value
      pendingColorRef.current = value
      setPickerColor(value)
      setLocalColor(value)
      setInputVal(value)
    }
  }, [value])

  // 弹窗打开时，重置拖拽标记并同步初始颜色
  React.useEffect(() => {
    if (open) {
      const initial = value || "#8b5cf6"
      isDraggingRef.current = false
      lastEmittedColorRef.current = initial
      pendingColorRef.current = initial
      setPickerColor(initial)
      setLocalColor(initial)
      setInputVal(initial)
    }
  }, [open, value])

  // 全局 pointerup / pointercancel 兜底：防止用户在拾色器外松开鼠标导致 isDraggingRef 卡在 true
  React.useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
          rafIdRef.current = null
        }
        const finalColor = pendingColorRef.current
        setPickerColor(finalColor)
        setLocalColor(finalColor)
        setInputVal(finalColor)
        if (finalColor.toLowerCase() !== lastEmittedColorRef.current.toLowerCase()) {
          lastEmittedColorRef.current = finalColor
          onChangeRef.current(finalColor)
        }
      }
    }

    window.addEventListener("pointerup", handleGlobalPointerUp)
    window.addEventListener("pointercancel", handleGlobalPointerUp)
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp)
      window.removeEventListener("pointercancel", handleGlobalPointerUp)
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
      isDraggingRef.current = false
      setPickerColor(val)
      setLocalColor(val)
      pendingColorRef.current = val
      lastEmittedColorRef.current = val
      onChangeRef.current(val)
    }
  }

  const handleHexBlur = () => {
    if (!/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(inputVal)) {
      setInputVal(localColor)
    }
  }

  // 拾色器在指针移动（拖拽中）时的回调
  // 注意：此处绝不同步更新 pickerColor，避免 react-colorful 内部通过 Effect 1 引起级联渲染死循环
  // 并且使用 requestAnimationFrame 将 state 更新与 parent onChange 限制在 60fps / 120fps 帧周期内
  const handlePickerChange = (color: string) => {
    isDraggingRef.current = true
    pendingColorRef.current = color

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        const current = pendingColorRef.current
        // 仅更新视觉预览色块与输入框，不更新 pickerColor
        setLocalColor(current)
        setInputVal(current)
        lastEmittedColorRef.current = current
        onChangeRef.current(current)
      })
    }
  }

  // 拾色器拖拽或点击结束
  const handlePickerChangeEnd = (color?: string) => {
    isDraggingRef.current = false
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    const final = color || pendingColorRef.current || localColor
    pendingColorRef.current = final
    setPickerColor(final)
    setLocalColor(final)
    setInputVal(final)
    if (final.toLowerCase() !== lastEmittedColorRef.current.toLowerCase()) {
      lastEmittedColorRef.current = final
      onChangeRef.current(final)
    }
  }

  const handlePresetClick = (hex: string) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
    isDraggingRef.current = false
    pendingColorRef.current = hex
    setPickerColor(hex)
    setLocalColor(hex)
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
              style={{ backgroundColor: open ? localColor : (value || "#8b5cf6") }}
            />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "z-50 w-64 p-3.5 rounded-3xl border border-black/[0.08] dark:border-white/[0.12] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-2xl shadow-2xl space-y-3",
          className
        )}
      >
        <div
          className="w-full overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.12] shadow-xs"
          onPointerDown={() => {
            isDraggingRef.current = true
          }}
        >
          <HexColorPicker
            color={pickerColor}
            onChange={handlePickerChange}
            onChangeEnd={handlePickerChangeEnd}
            style={{ width: "100%", height: 164 }}
          />
        </div>

        <div className="flex items-center gap-2">
          <div
            className="h-8 w-8 rounded-xl border border-black/10 dark:border-white/10 shadow-xs shrink-0"
            style={{ backgroundColor: localColor }}
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
              const isSelected = localColor.toLowerCase() === hex.toLowerCase()
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
