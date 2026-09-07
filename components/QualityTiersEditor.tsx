"use client"

import * as React from "react"
import {
  QualityColor,
  NetworkQualityTier,
  QUALITY_COLOR_THEMES,
  DEFAULT_QUALITY_TIERS,
  getQualityColorTheme,
  simulateTierMatching,
  MatchStepTrace,
} from "@/lib/quality-tiers"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sliders,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Check,
  Sparkles,
  RotateCcw,
  Zap,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Save,
  Layers,
  ArrowRight,
  Info,
  Palette,
} from "lucide-react"
import { ColorPicker } from "@/components/ui/color-picker"
import { t } from "@/locales"

interface QualityTiersEditorProps {
  initialTiers?: NetworkQualityTier[]
  onChange?: (tiers: NetworkQualityTier[]) => void
  onSave?: (tiers: NetworkQualityTier[]) => Promise<void>
  onReset?: () => Promise<void>
  isSaving?: boolean
}

const COLOR_OPTIONS: QualityColor[] = ["emerald", "blue", "amber", "orange", "rose", "purple", "gray"]

export function QualityTiersEditor({
  initialTiers,
  onChange,
  onSave,
  onReset,
  isSaving = false,
}: QualityTiersEditorProps) {
  const [tiers, setTiers] = React.useState<NetworkQualityTier[]>(() => {
    return initialTiers && initialTiers.length > 0 ? initialTiers : DEFAULT_QUALITY_TIERS
  })

  // 记录是否是组件内部发起的修改，避免内部修改通知父组件后，父组件重新传入 initialTiers 导致循环重渲染和状态回弹
  const isInternalChangeRef = React.useRef(false)
  const prevInitialTiersRef = React.useRef(initialTiers)
  const onChangeTimerRef = React.useRef<NodeJS.Timeout | null>(null)

  // 记录当前展开拾色器的档位序号
  const [openPickerIdx, setOpenPickerIdx] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false
      prevInitialTiersRef.current = initialTiers
      return
    }
    if (initialTiers && initialTiers !== prevInitialTiersRef.current && initialTiers.length > 0) {
      prevInitialTiersRef.current = initialTiers
      setTiers(initialTiers)
    }
  }, [initialTiers])

  React.useEffect(() => {
    return () => {
      if (onChangeTimerRef.current) {
        clearTimeout(onChangeTimerRef.current)
      }
    }
  }, [])

  const [simLatency, setSimLatency] = React.useState<string>("50")
  const [simLoss, setSimLoss] = React.useState<string>("15")

  const parsedSimLat = parseFloat(simLatency) || 0
  const parsedSimLoss = parseFloat(simLoss) || 0

  const simulation = React.useMemo(() => {
    return simulateTierMatching(parsedSimLat, parsedSimLoss, tiers)
  }, [parsedSimLat, parsedSimLoss, tiers])

  const updateTiers = React.useCallback((updater: (prev: NetworkQualityTier[]) => NetworkQualityTier[]) => {
    setTiers((prev) => {
      const next = updater(prev)
      isInternalChangeRef.current = true
      if (onChange) {
        if (onChangeTimerRef.current) {
          clearTimeout(onChangeTimerRef.current)
        }
        onChangeTimerRef.current = setTimeout(() => {
          onChange(next)
        }, 80)
      }
      return next
    })
  }, [onChange])

  const handleMoveUp = (index: number) => {
    if (index <= 0) return
    updateTiers((prev) => {
      const next = [...prev]
      const temp = next[index - 1]
      next[index - 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const handleMoveDown = (index: number) => {
    if (index >= tiers.length - 2) return
    updateTiers((prev) => {
      const next = [...prev]
      const temp = next[index + 1]
      next[index + 1] = next[index]
      next[index] = temp
      return next
    })
  }

  const handleUpdateTier = (index: number, updates: Partial<NetworkQualityTier>) => {
    updateTiers((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...updates }
      return next
    })
  }

  const handleDeleteTier = (index: number) => {
    if (tiers.length <= 1) return
    if (index === tiers.length - 1) return
    updateTiers((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleAddTier = () => {
    const newTier: NetworkQualityTier = {
      id: `tier-${Date.now()}`,
      label: t.quality.newTierDefaultLabel,
      color: "blue",
      minLatency: 0,
      maxLatency: 90,
      minLoss: 0,
      maxLoss: 2,
      description: t.quality.newTierDefaultDesc,
    }
    updateTiers((prev) => {
      if (prev.length === 0) return [newTier]
      const next = [...prev]
      next.splice(next.length - 1, 0, newTier)
      return next
    })
  }

  const PRESET_SCENARIOS = [
    { label: t.quality.presets.direct, lat: "25", loss: "0" },
    { label: t.quality.presets.good, lat: "85", loss: "2" },
    { label: t.quality.presets.lowLatencyHighLoss, lat: "50", loss: "15" },
    { label: t.quality.presets.highLatencyZeroLoss, lat: "160", loss: "0" },
    { label: t.quality.presets.severe, lat: "280", loss: "30" },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/[0.06] bg-white p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/20 dark:text-[#2997ff]">
                <Sliders className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                {t.quality.engineTitle}
              </h3>
            </div>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 leading-relaxed max-w-2xl">
              {t.quality.engineDesc}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              type="button"
              onClick={handleAddTier}
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full text-xs border-neutral-200 dark:border-neutral-700 h-9"
            >
              <Plus className="h-3.5 w-3.5 text-[#0066cc] dark:text-[#2997ff]" />
              <span>{t.quality.addTierBtn}</span>
            </Button>

            {onReset && (
              <Button
                type="button"
                onClick={onReset}
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-full text-xs border-neutral-200 dark:border-neutral-700 h-9 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t.quality.resetBtn}</span>
              </Button>
            )}

            {onSave && (
              <Button
                type="button"
                onClick={() => onSave(tiers)}
                disabled={isSaving}
                size="sm"
                className="gap-1.5 rounded-full text-xs px-4 h-9 bg-[#0066cc] hover:bg-[#0055b3] text-white dark:bg-[#2997ff] dark:hover:bg-[#147ce5] dark:text-black font-semibold shadow-sm"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{isSaving ? t.quality.savingBtn : t.quality.saveBtn}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-3.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {t.quality.priorityChainTitle}
            </span>
            <span className="text-xs font-mono text-neutral-400">{t.quality.tiersCount.replace("{count}", String(tiers.length))}</span>
          </div>

          <div className="space-y-3">
            {tiers.map((tier, idx) => {
              const isFallback = idx === tiers.length - 1 && tier.maxLatency === null && tier.maxLoss === null
              const theme = getQualityColorTheme(tier.color, tier.customColor)

              return (
                <div
                  key={tier.id || `tier-key-${idx}`}
                  className={`group relative rounded-2xl border transition-all duration-200 bg-white dark:bg-[#1c1c1e] p-4 apple-card-shadow ${
                    isFallback
                      ? "border-dashed border-neutral-300 dark:border-neutral-700/80 bg-neutral-50/50 dark:bg-[#18181a]/50"
                      : "border-black/[0.06] dark:border-white/[0.08] hover:border-black/[0.12] dark:hover:border-white/[0.15]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 pb-3 border-b border-black/[0.04] dark:border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center justify-center rounded-lg px-2 py-0.5 text-xs font-mono font-bold ${
                          idx === 0
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : isFallback
                            ? "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                            : "bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/20 dark:text-[#2997ff]"
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        {idx === 0
                          ? t.quality.highestPriority
                          : isFallback
                          ? t.quality.fallbackPriority
                          : t.quality.priorityN.replace("{n}", String(idx + 1))}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {!isFallback && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMoveUp(idx)}
                            disabled={idx === 0}
                            title={t.quality.moveUpTitle}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(idx)}
                            disabled={idx >= tiers.length - 2}
                            title={t.quality.moveDownTitle}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}

                      {!isFallback && tiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTier(idx)}
                          title={t.quality.deleteTitle}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors ml-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="space-y-1 sm:w-1/3">
                        <label className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                          {t.quality.tierNameLabel}
                        </label>
                        <Input
                          value={tier.label}
                          onChange={(e) => handleUpdateTier(idx, { label: e.target.value })}
                          placeholder={t.quality.tierNamePlaceholder}
                          className="h-8.5 rounded-xl text-xs font-medium"
                        />
                      </div>

                      <div className="space-y-1 flex-1">
                        <label className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                          {t.quality.colorLabel.replace("{color}", theme.label)}
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {COLOR_OPTIONS.map((c) => {
                            const cTheme = getQualityColorTheme(c)
                            const isSelected = tier.color === c
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => {
                                  handleUpdateTier(idx, { color: c })
                                  if (openPickerIdx === idx) {
                                    setOpenPickerIdx(null)
                                  }
                                }}
                                title={cTheme.label}
                                className={`group/swatch relative flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 outline-none focus:outline-none focus-visible:outline-none select-none cursor-pointer ${
                                  isSelected
                                    ? "scale-105"
                                    : "opacity-75 hover:opacity-100"
                                }`}
                              >
                                <span className={`h-5 w-5 rounded-full ${cTheme.dotClass} shadow-xs flex items-center justify-center`}>
                                  {isSelected && <Check className="h-3 w-3 text-white stroke-[3]" />}
                                </span>
                              </button>
                            )
                          })}

                          <div className="relative flex items-center">
                            <ColorPicker
                              value={tier.customColor || "#8b5cf6"}
                              open={openPickerIdx === idx}
                              onOpenChange={(isOpen) => {
                                setOpenPickerIdx(isOpen ? idx : null)
                              }}
                              onChange={(color) => {
                                handleUpdateTier(idx, { color: "custom", customColor: color })
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (tier.color !== "custom") {
                                    handleUpdateTier(idx, { color: "custom", customColor: tier.customColor || "#8b5cf6" })
                                  }
                                  setOpenPickerIdx(openPickerIdx === idx ? null : idx)
                                }}
                                title={tier.color === "custom" ? t.quality.customColorTitle.replace("{color}", tier.customColor || "#8b5cf6") : t.quality.customColorOpenTitle}
                                className={`group/swatch relative flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 outline-none focus:outline-none focus-visible:outline-none select-none cursor-pointer ${
                                  tier.color === "custom"
                                    ? "scale-105"
                                    : "opacity-75 hover:opacity-100"
                                }`}
                              >
                                <span
                                  className="h-5 w-5 rounded-full shadow-xs flex items-center justify-center transition-all overflow-hidden border border-black/10 dark:border-white/15"
                                  style={{
                                    backgroundColor: tier.color === "custom" ? (tier.customColor || "#8b5cf6") : "transparent",
                                    backgroundImage:
                                      tier.color === "custom"
                                        ? "none"
                                        : "linear-gradient(135deg, #f43f5e 0%, #f59e0b 25%, #10b981 50%, #0066cc 75%, #8b5cf6 100%)",
                                  }}
                                >
                                  {tier.color === "custom" ? (
                                    <Check className="h-3 w-3 text-white stroke-[3] drop-shadow-sm" />
                                  ) : (
                                    <Palette className="h-3 w-3 text-white drop-shadow-sm" />
                                  )}
                                </span>
                              </button>
                            </ColorPicker>

                            {tier.color === "custom" && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenPickerIdx(openPickerIdx === idx ? null : idx)
                                }}
                                className="ml-1.5 px-2 py-0.5 rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-neutral-100/80 dark:bg-neutral-800/80 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 font-mono text-[11px] text-neutral-600 dark:text-neutral-300 uppercase transition-colors cursor-pointer select-none"
                                title={t.quality.customColorEditTitle}
                              >
                                {tier.customColor || "#8b5cf6"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {isFallback ? (
                      <div className="rounded-xl bg-neutral-100/70 dark:bg-neutral-800/50 p-3 text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-neutral-400 shrink-0" />
                        <span>{t.quality.fallbackRuleDesc}</span>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-neutral-50/70 dark:bg-neutral-800/30 p-3 border border-black/[0.04] dark:border-white/[0.04]">
                        <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-2">
                          <span className="flex items-center gap-1">
                            <span>{t.quality.conditionTitle}</span>
                            <span className="rounded bg-neutral-200/70 dark:bg-neutral-700/60 px-1 py-0.2 text-[9px] font-mono">
                              {t.quality.andLogic}
                            </span>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400">
                              {t.quality.maxLatencyLabel}
                            </label>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-medium text-neutral-500">≤</span>
                              <Input
                                type="number"
                                min={0}
                                value={tier.maxLatency === null ? "" : tier.maxLatency}
                                onChange={(e) => {
                                  const val = e.target.value.trim() === "" ? null : parseFloat(e.target.value)
                                  handleUpdateTier(idx, { maxLatency: isNaN(val as number) ? null : val })
                                }}
                                placeholder={t.quality.noLimitPlaceholder}
                                className="h-8 rounded-xl text-xs font-mono"
                              />
                              <span className="text-xs text-neutral-400 font-mono">ms</span>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] text-neutral-400">
                              {t.quality.maxLossLabel}
                            </label>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-mono font-medium text-neutral-500">≤</span>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={tier.maxLoss === null ? "" : tier.maxLoss}
                                onChange={(e) => {
                                  const val = e.target.value.trim() === "" ? null : parseFloat(e.target.value)
                                  handleUpdateTier(idx, { maxLoss: isNaN(val as number) ? null : val })
                                }}
                                placeholder={t.quality.noLimitPlaceholder}
                                className="h-8 rounded-xl text-xs font-mono"
                              />
                              <span className="text-xs text-neutral-400 font-mono">%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                          <Info className="h-3.5 w-3.5 text-[#0066cc] dark:text-[#2997ff]" />
                          <span>{t.quality.descriptionLabel}</span>
                        </label>
                        <span className="text-[10px] text-neutral-400 font-normal">
                          {t.quality.descriptionHint}
                        </span>
                      </div>
                      <Input
                        value={tier.description || ""}
                        onChange={(e) => handleUpdateTier(idx, { description: e.target.value })}
                        placeholder={t.quality.descriptionPlaceholder}
                        className="h-8.5 rounded-xl text-xs font-normal"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="sticky top-20 rounded-3xl border border-black/[0.06] bg-white p-5 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 dark:bg-amber-500/20">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {t.quality.sandboxTitle}
                </h4>
              </div>
              <span className="rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                {t.quality.sandboxLive}
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                {t.quality.sandboxDesc}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    {t.quality.simLatency}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      value={simLatency}
                      onChange={(e) => setSimLatency(e.target.value)}
                      className="h-8.5 rounded-xl font-mono text-xs"
                    />
                    <span className="text-xs text-neutral-400 font-mono">ms</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                    {t.quality.simLoss}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      value={simLoss}
                      onChange={(e) => setSimLoss(e.target.value)}
                      className="h-8.5 rounded-xl font-mono text-xs"
                    />
                    <span className="text-xs text-neutral-400 font-mono">%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] text-neutral-400 font-medium">{t.quality.presetScenariosTitle}</span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SCENARIOS.map((sc) => (
                    <button
                      key={sc.label}
                      type="button"
                      onClick={() => {
                        setSimLatency(sc.lat)
                        setSimLoss(sc.loss)
                      }}
                      className="rounded-lg bg-neutral-100 hover:bg-neutral-200/70 dark:bg-neutral-800 dark:hover:bg-neutral-700/80 px-2 py-1 text-[10px] font-medium text-neutral-600 dark:text-neutral-300 transition-colors"
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-black/[0.05] dark:border-white/[0.06]">
              <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 flex items-center justify-between">
                <span>{t.quality.executionTraceTitle}</span>
                <span className="font-mono text-[10px]">
                  {parsedSimLat}ms / {parsedSimLoss}%
                </span>
              </div>

              <div className="space-y-2">
                {simulation.trace.map((step, sIdx) => {
                  const sTheme = getQualityColorTheme(step.tier.color, step.tier.customColor)
                  return (
                    <div
                      key={`trace-${sIdx}`}
                      className={`relative rounded-xl p-2.5 transition-all text-xs border ${
                        step.matched
                          ? "border-emerald-500/40 bg-emerald-50/50 dark:border-emerald-500/40 dark:bg-emerald-950/20 shadow-xs"
                          : "border-black/[0.04] bg-neutral-50/50 dark:border-white/[0.04] dark:bg-neutral-900/40 opacity-70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${sTheme.dotClass}`}
                            style={sTheme.isCustom ? { backgroundColor: sTheme.hex } : undefined}
                          />
                          <span className="font-mono font-bold text-[11px] text-neutral-600 dark:text-neutral-400">
                            #{step.tierIndex}
                          </span>
                          <span className="font-medium text-neutral-900 dark:text-neutral-100">
                            {step.tier.label}
                          </span>
                        </div>

                        {step.matched ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{t.quality.firstMatchApplied}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-200/60 dark:bg-neutral-800/60 px-2 py-0.5 text-[10px] text-neutral-400">
                            <XCircle className="h-3 w-3 text-rose-400" />
                            <span>{t.quality.notMatchedContinue}</span>
                          </span>
                        )}
                      </div>

                      <p className="mt-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal">
                        {step.reason}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-black/[0.06] bg-neutral-100/70 p-3.5 dark:border-white/[0.08] dark:bg-neutral-800/40">
              <div className="text-[10px] uppercase font-semibold text-neutral-400 dark:text-neutral-500">
                {t.quality.finalResultTitle}
              </div>
              {(() => {
                const finalTheme = getQualityColorTheme(simulation.matchedTier.color, simulation.matchedTier.customColor)
                return (
                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-3 w-3 rounded-full ${finalTheme.dotClass} shadow-xs`}
                        style={finalTheme.isCustom ? { backgroundColor: finalTheme.hex } : undefined}
                      />
                      <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                        {simulation.matchedTier.label}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${finalTheme.badgeClass}`}
                      style={finalTheme.isCustom ? { color: finalTheme.hex, backgroundColor: `${finalTheme.hex}18`, borderColor: `${finalTheme.hex}40` } : undefined}
                    >
                      <Zap className="h-3 w-3" />
                      <span>{finalTheme.label}</span>
                    </span>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
