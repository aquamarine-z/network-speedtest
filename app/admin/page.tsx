"use client"

import * as React from "react"
import Link from "next/link"
import { useTheme } from "@/components/Providers"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Shield,
  ArrowLeft,
  Globe,
  Clock,
  Zap,
  Database,
  Trash2,
  Play,
  LogOut,
  Sun,
  Moon,
  CheckCircle2,
  AlertCircle,
  Activity,
  Calendar,
  Layers,
  Code2,
  RotateCcw,
  Sparkles,
  Search,
  Plus,
  Sliders,
  MapPin,
  KeyRound,
  Lock,
  HardDrive,
} from "lucide-react"

import { formatDuration } from "@/lib/utils"
import { dialog } from "@/components/ui/surface"
import { CITY_METADATA_MAP, CityMeta, getCityMeta } from "@/lib/city-metadata"
import { QualityTiersEditor } from "@/components/QualityTiersEditor"
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog"
import { NetworkQualityTier, DbStats, DbFileSizeInfo, AutoMergePolicy } from "@/lib/types"
import { DEFAULT_QUALITY_TIERS } from "@/lib/quality-tiers"
import { t } from "@/locales"

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

interface SchedulerConfig {
  targetNode: string
  intervalSeconds: number
  scheduleMode: "aligned" | "interval"
  pingPackets: number
  lastRunTimestamp: number
  nextRunTimestamp: number
  activeProvider: "globalping" | "custom" | "all"
  customApiUrl: string
  customApiToken: string
}

const REGION_OPTIONS = [
  { key: "all", label: t.admin.regions.all },
  { key: "西南中心", label: t.admin.regions.southwest },
  { key: "西北中心", label: t.admin.regions.northwest },
  { key: "华中中心", label: t.admin.regions.central },
  { key: "华北中心", label: t.admin.regions.north },
  { key: "华东中心", label: t.admin.regions.east },
  { key: "华南中心", label: t.admin.regions.south },
  { key: "东北地区", label: t.admin.regions.northeast },
]

type TimeUnit = "s" | "m" | "h" | "d" | "mo"

const TIME_UNIT_SECONDS: Record<TimeUnit, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  mo: 2592000, // 30 天
}

function decomposeSeconds(sec: number): { value: number; unit: TimeUnit } {
  const s = Math.max(5, Math.round(sec))
  if (s >= 2592000 && s % 2592000 === 0) {
    return { value: s / 2592000, unit: "mo" }
  }
  if (s >= 86400 && s % 86400 === 0) {
    return { value: s / 86400, unit: "d" }
  }
  if (s >= 3600 && s % 3600 === 0) {
    return { value: s / 3600, unit: "h" }
  }
  if (s >= 60 && s % 60 === 0) {
    return { value: s / 60, unit: "m" }
  }
  return { value: s, unit: "s" }
}

interface PresetIntervalItem {
  label: string
  sec: number
  val: number
  unit: TimeUnit
}

const PRESET_INTERVAL_MAP: Record<TimeUnit, PresetIntervalItem[]> = {
  s: [
    { label: t.admin.intervals.s10, sec: 10, val: 10, unit: "s" },
    { label: t.admin.intervals.s30, sec: 30, val: 30, unit: "s" },
    { label: t.admin.intervals.s45, sec: 45, val: 45, unit: "s" },
  ],
  m: [
    { label: t.admin.intervals.m1, sec: 60, val: 1, unit: "m" },
    { label: t.admin.intervals.m2, sec: 120, val: 2, unit: "m" },
    { label: t.admin.intervals.m5, sec: 300, val: 5, unit: "m" },
    { label: t.admin.intervals.m10, sec: 600, val: 10, unit: "m" },
    { label: t.admin.intervals.m15, sec: 900, val: 15, unit: "m" },
    { label: t.admin.intervals.m30, sec: 1800, val: 30, unit: "m" },
  ],
  h: [
    { label: t.admin.intervals.h1, sec: 3600, val: 1, unit: "h" },
    { label: t.admin.intervals.h2, sec: 7200, val: 2, unit: "h" },
    { label: t.admin.intervals.h6, sec: 21600, val: 6, unit: "h" },
    { label: t.admin.intervals.h12, sec: 43200, val: 12, unit: "h" },
  ],
  d: [
    { label: t.admin.intervals.d1, sec: 86400, val: 1, unit: "d" },
    { label: t.admin.intervals.d3, sec: 259200, val: 3, unit: "d" },
    { label: t.admin.intervals.d7, sec: 604800, val: 7, unit: "d" },
    { label: t.admin.intervals.d15, sec: 1296000, val: 15, unit: "d" },
  ],
  mo: [
    { label: t.admin.intervals.mo1, sec: 2592000, val: 1, unit: "mo" },
    { label: t.admin.intervals.mo3, sec: 7776000, val: 3, unit: "mo" },
  ],
}

const PRESET_INTERVAL_SECONDS: PresetIntervalItem[] = Object.values(PRESET_INTERVAL_MAP).flat()

interface ConfigSnapshotData {
  targetInput: string
  intervalSeconds: number | string
  scheduleMode: "aligned" | "interval"
  pingPackets: number
  activeProvider: "globalping" | "custom" | "all"
  customApiUrl: string
  customApiToken: string
  guaranteedHubs: string[]
  rotatingCandidates: string[]
  rotationBatchSize: number
  enableGeneralPool: boolean
  qualityTiers: NetworkQualityTier[]
  autoMergePolicy: AutoMergePolicy
}

function serializeConfig(cfg: ConfigSnapshotData): string {
  const sec = Math.max(5, typeof cfg.intervalSeconds === "number" ? cfg.intervalSeconds : (parseInt(String(cfg.intervalSeconds), 10) || 60))
  return JSON.stringify({
    target: cfg.targetInput.trim(),
    intervalSeconds: sec,
    scheduleMode: cfg.scheduleMode,
    pingPackets: Number(cfg.pingPackets) || 3,
    activeProvider: cfg.activeProvider,
    customApiUrl: cfg.customApiUrl.trim(),
    customApiToken: cfg.customApiToken.trim(),
    guaranteedHubs: [...cfg.guaranteedHubs],
    rotatingCandidates: [...cfg.rotatingCandidates],
    rotationBatchSize: Number(cfg.rotationBatchSize) || 16,
    enableGeneralPool: Boolean(cfg.enableGeneralPool),
    qualityTiers: cfg.qualityTiers,
    autoMergePolicy: {
      enabled: Boolean(cfg.autoMergePolicy.enabled),
      daysAgo: Number(cfg.autoMergePolicy.daysAgo) || 7,
      pointsPerDay: Number(cfg.autoMergePolicy.pointsPerDay) || 24,
    },
  })
}

export default function AdminPage() {
  const { theme, toggleTheme } = useTheme()

  const [isLoggedIn, setIsLoggedIn] = React.useState<boolean | null>(null)
  const [password, setPassword] = React.useState("")
  const [loginLoading, setLoginLoading] = React.useState(false)

  // 5 个主 Tab 标签：'provider' | 'dispatch' | 'thresholds' | 'scheduler' | 'database'
  const [activeTab, setActiveTab] = React.useState<"provider" | "dispatch" | "thresholds" | "scheduler" | "database">("provider")

  // 网络质量档位评级规则状态
  const [qualityTiers, setQualityTiers] = React.useState<NetworkQualityTier[]>(DEFAULT_QUALITY_TIERS)
  const [savingTiers, setSavingTiers] = React.useState(false)

  // 修改密码弹窗状态
  const [showChangePassword, setShowChangePassword] = React.useState(false)

  // 1. 监控目标与数据源状态
  const [targetInput, setTargetInput] = React.useState("speed.cloudflare.com")
  const [pingPackets, setPingPackets] = React.useState<number>(3)
  const [activeProvider, setActiveProvider] = React.useState<"globalping" | "custom" | "all">("globalping")
  const [customApiUrl, setCustomApiUrl] = React.useState("")
  const [customApiToken, setCustomApiToken] = React.useState("")
  const [showDoc, setShowDoc] = React.useState(false)
  const [testingApi, setTestingApi] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string; probes?: any[] } | null>(null)

  // 2. 调度时间配置 (以秒为绝对单位存储，UI 支持秒/分/时/天/月且支持小数，切换单位自动无损换算)
  const [rawIntervalSeconds, setRawIntervalSeconds] = React.useState<number>(60)
  const [intervalValue, setIntervalValue] = React.useState<string>("60")
  const [intervalUnit, setIntervalUnit] = React.useState<TimeUnit>("s")
  const [scheduleMode, setScheduleMode] = React.useState<"aligned" | "interval">("aligned")

  const currentTotalSec = React.useMemo(() => {
    const num = parseFloat(intervalValue)
    if (isNaN(num) || num <= 0) return rawIntervalSeconds || 60
    return Math.max(5, Math.round(num * TIME_UNIT_SECONDS[intervalUnit]))
  }, [intervalValue, intervalUnit, rawIntervalSeconds])

  const handleUnitChange = React.useCallback((newUnit: TimeUnit) => {
    if (newUnit === intervalUnit) return
    // 以底层真实秒数 (rawIntervalSeconds) 为单一基准无损换算到新单位，杜绝中间浮点数多次截断误差累积
    const targetVal = rawIntervalSeconds / TIME_UNIT_SECONDS[newUnit]
    const formatted = parseFloat(targetVal.toFixed(6)).toString()
    setIntervalUnit(newUnit)
    setIntervalValue(formatted)
  }, [intervalUnit, rawIntervalSeconds])

  // 3. 省市保底与轮换调度状态
  const [guaranteedHubs, setGuaranteedHubs] = React.useState<string[]>([])
  const [rotatingCandidates, setRotatingCandidates] = React.useState<string[]>([])
  const [rotationBatchSize, setRotationBatchSize] = React.useState<number>(16)
  const [enableGeneralPool, setEnableGeneralPool] = React.useState<boolean>(false)
  const [usedCitiesInCycle, setUsedCitiesInCycle] = React.useState<string[]>([])
  const [knownCities, setKnownCities] = React.useState<Record<string, CityMeta>>(CITY_METADATA_MAP)

  // 城市筛选与添加
  const [citySearch, setCitySearch] = React.useState("")
  const [selectedRegion, setSelectedRegion] = React.useState("all")
  const [showAddCity, setShowAddCity] = React.useState(false)
  const [newCityKey, setNewCityKey] = React.useState("")
  const [newCityNameZh, setNewCityNameZh] = React.useState("")
  const [newCityProvince, setNewCityProvince] = React.useState("")
  const [newCityRegion, setNewCityRegion] = React.useState("西南中心")
  const [newCityTargetPool, setNewCityTargetPool] = React.useState<"guaranteed" | "rotating">("guaranteed")

  const [stats, setStats] = React.useState<DbStats | null>(null)
  const [config, setConfig] = React.useState<SchedulerConfig | null>(null)

  const [saving, setSaving] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [pruning, setPruning] = React.useState(false)
  const [clearing, setClearing] = React.useState(false)
  const [deletingBefore, setDeletingBefore] = React.useState(false)
  const [vacuuming, setVacuuming] = React.useState(false)
  const [customDateCutoff, setCustomDateCutoff] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })

  // 历史数据合并与智能降采样 (Data Rollup) 状态
  const [autoMergePolicy, setAutoMergePolicy] = React.useState<AutoMergePolicy>({
    enabled: false,
    daysAgo: 7,
    pointsPerDay: 24,
  })
  const [runningAutoMerge, setRunningAutoMerge] = React.useState(false)
  const [manualMerging, setManualMerging] = React.useState(false)
  const [mergeMode, setMergeMode] = React.useState<"single" | "range">("single")
  const [mergeDate, setMergeDate] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })
  const [mergeStartDate, setMergeStartDate] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })
  const [mergeEndDate, setMergeEndDate] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  })
  const [mergePointsPerDay, setMergePointsPerDay] = React.useState(24)

  // 配置脏检查基准快照 (用于比对配置文件是否发生变动并控制保存按钮 disable)
  const [savedConfigSnapshot, setSavedConfigSnapshot] = React.useState<string | null>(null)

  const currentConfigStr = React.useMemo(() => {
    return serializeConfig({
      targetInput,
      intervalSeconds: currentTotalSec,
      scheduleMode,
      pingPackets,
      activeProvider,
      customApiUrl,
      customApiToken,
      guaranteedHubs,
      rotatingCandidates,
      rotationBatchSize,
      enableGeneralPool,
      qualityTiers,
      autoMergePolicy,
    })
  }, [
    targetInput,
    currentTotalSec,
    scheduleMode,
    pingPackets,
    activeProvider,
    customApiUrl,
    customApiToken,
    guaranteedHubs,
    rotatingCandidates,
    rotationBatchSize,
    enableGeneralPool,
    qualityTiers,
    autoMergePolicy,
  ])

  // 当配置快照已就绪且当前配置与已保存快照完全一致时，认为无变动
  const isConfigDirty = savedConfigSnapshot !== null && currentConfigStr !== savedConfigSnapshot

  const [toast, setToast] = React.useState<{ text: string; type: "success" | "error" } | null>(null)

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type })
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev))
    }, 4000)
  }

  // 加载管理员配置
  const loadAdminConfig = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/config")
      if (res.status === 401) {
        setIsLoggedIn(false)
        return
      }
      const data = await res.json()
      if (data.success) {
        setIsLoggedIn(true)
        setConfig(data.config)
        setStats(data.stats)
        setTargetInput(data.config?.targetNode || "speed.cloudflare.com")
        setActiveProvider(data.config?.activeProvider || "globalping")
        setCustomApiUrl(data.config?.customApiUrl || "")
        setCustomApiToken(data.config?.customApiToken || "")

        const rawSec = data.config?.intervalSeconds ?? 60
        const decomposed = decomposeSeconds(rawSec)
        setRawIntervalSeconds(rawSec)
        setIntervalUnit(decomposed.unit)
        setIntervalValue(decomposed.value.toString())
        setScheduleMode(data.config?.scheduleMode || "aligned")
        setPingPackets(data.config?.pingPackets || 3)

        if (data.cityDispatch) {
          setGuaranteedHubs(data.cityDispatch.guaranteedHubs || [])
          setRotatingCandidates(data.cityDispatch.rotatingCandidates || [])
          setRotationBatchSize(data.cityDispatch.rotationBatchSize || 16)
          setEnableGeneralPool(!!data.cityDispatch.enableGeneralPool)
          setUsedCitiesInCycle(data.cityDispatch.usedCitiesInCycle || [])
          if (data.cityDispatch.knownMetadata) {
            setKnownCities(data.cityDispatch.knownMetadata)
          }
        }
        if (data.qualityTiers && Array.isArray(data.qualityTiers)) {
          setQualityTiers(data.qualityTiers)
        }
        if (data.autoMergePolicy) {
          setAutoMergePolicy(data.autoMergePolicy)
        }

        // 初始化基准快照
        const initialSnapshot = serializeConfig({
          targetInput: data.config?.targetNode || "speed.cloudflare.com",
          intervalSeconds: data.config?.intervalSeconds ?? 60,
          scheduleMode: data.config?.scheduleMode || "aligned",
          pingPackets: data.config?.pingPackets || 3,
          activeProvider: data.config?.activeProvider || "globalping",
          customApiUrl: data.config?.customApiUrl || "",
          customApiToken: data.config?.customApiToken || "",
          guaranteedHubs: data.cityDispatch?.guaranteedHubs || [],
          rotatingCandidates: data.cityDispatch?.rotatingCandidates || [],
          rotationBatchSize: data.cityDispatch?.rotationBatchSize || 16,
          enableGeneralPool: !!data.cityDispatch?.enableGeneralPool,
          qualityTiers: data.qualityTiers && Array.isArray(data.qualityTiers) ? data.qualityTiers : DEFAULT_QUALITY_TIERS,
          autoMergePolicy: data.autoMergePolicy || { enabled: false, daysAgo: 7, pointsPerDay: 24 },
        })
        setSavedConfigSnapshot(initialSnapshot)
      } else {
        setIsLoggedIn(false)
      }
    } catch {
      setIsLoggedIn(false)
    }
  }, [])

  React.useEffect(() => {
    void loadAdminConfig()
  }, [loadAdminConfig])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()
      if (data.success) {
        setPassword("")
        await loadAdminConfig()
        showToast(t.admin.toast.loginSuccess)
      } else {
        showToast(data.error || t.admin.toast.loginFailed, "error")
      }
    } catch {
      showToast(t.admin.toast.loginNetError, "error")
    } finally {
      setLoginLoading(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!targetInput.trim()) {
      showToast(t.admin.toast.targetRequired, "error")
      return
    }

    if ((activeProvider === "custom" || activeProvider === "all") && !customApiUrl.trim()) {
      showToast(t.admin.toast.customApiRequired, "error")
      return
    }

    const totalSec = currentTotalSec
    if (totalSec < 5) {
      showToast(t.admin.toast.intervalMin, "error")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: targetInput.trim(),
          intervalSeconds: totalSec,
          scheduleMode,
          pingPackets,
          activeProvider,
          customApiUrl: customApiUrl.trim(),
          customApiToken: customApiToken.trim(),
          guaranteedHubs,
          rotatingCandidates,
          rotationBatchSize,
          enableGeneralPool,
          qualityTiers,
          autoMergePolicy,
        }),
      })

      const data = await res.json()
      if (data.success) {
        setConfig(data.config)
        setStats(data.stats)
        if (data.cityDispatch) {
          setGuaranteedHubs(data.cityDispatch.guaranteedHubs)
          setRotatingCandidates(data.cityDispatch.rotatingCandidates)
          setRotationBatchSize(data.cityDispatch.rotationBatchSize)
          setEnableGeneralPool(!!data.cityDispatch.enableGeneralPool)
          setUsedCitiesInCycle(data.cityDispatch.usedCitiesInCycle)
        }
        if (data.qualityTiers) {
          setQualityTiers(data.qualityTiers)
        }
        if (data.autoMergePolicy) {
          setAutoMergePolicy(data.autoMergePolicy)
        }

        const updatedSnapshot = serializeConfig({
          targetInput: data.config?.targetNode || targetInput.trim(),
          intervalSeconds: data.config?.intervalSeconds ?? totalSec,
          scheduleMode: data.config?.scheduleMode || scheduleMode,
          pingPackets: data.config?.pingPackets ?? pingPackets,
          activeProvider: data.config?.activeProvider || activeProvider,
          customApiUrl: data.config?.customApiUrl ?? customApiUrl.trim(),
          customApiToken: data.config?.customApiToken ?? customApiToken.trim(),
          guaranteedHubs: data.cityDispatch?.guaranteedHubs ?? guaranteedHubs,
          rotatingCandidates: data.cityDispatch?.rotatingCandidates ?? rotatingCandidates,
          rotationBatchSize: data.cityDispatch?.rotationBatchSize ?? rotationBatchSize,
          enableGeneralPool: data.cityDispatch ? !!data.cityDispatch.enableGeneralPool : enableGeneralPool,
          qualityTiers: data.qualityTiers ?? qualityTiers,
          autoMergePolicy: data.autoMergePolicy ?? autoMergePolicy,
        })
        setSavedConfigSnapshot(updatedSnapshot)
        showToast(t.admin.toast.saveSuccess)
      } else {
        showToast(data.error || t.admin.toast.saveFailed, "error")
      }
    } catch {
      showToast(t.admin.toast.saveNetError, "error")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveQualityTiers = async (newTiers: NetworkQualityTier[]) => {
    setSavingTiers(true)
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qualityTiers: newTiers }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(t.admin.toast.qualitySaved)
        if (data.qualityTiers) {
          setQualityTiers(data.qualityTiers)
          setSavedConfigSnapshot((prev) => {
            if (!prev) return null
            try {
              const obj = JSON.parse(prev)
              obj.qualityTiers = data.qualityTiers
              return JSON.stringify(obj)
            } catch {
              return prev
            }
          })
        }
      } else {
        showToast(data.error || t.admin.toast.qualitySaveFailed, "error")
      }
    } catch {
      showToast(t.admin.toast.qualitySaveNetError, "error")
    } finally {
      setSavingTiers(false)
    }
  }

  const handleResetQualityTiers = async () => {
    const confirmed = await dialog.confirm({
      title: t.admin.dialogs.qualityResetTitle,
      message: t.admin.dialogs.qualityResetMsg,
      cancelButtonContent: t.common.dialog.cancel,
      confirmButtonContent: t.admin.dialogs.confirmResetQuality,
    })
    if (!confirmed) return

    setSavingTiers(true)
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_quality_tiers" }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || t.admin.toast.qualityResetDefault)
        if (data.qualityTiers) {
          setQualityTiers(data.qualityTiers)
          setSavedConfigSnapshot((prev) => {
            if (!prev) return null
            try {
              const obj = JSON.parse(prev)
              obj.qualityTiers = data.qualityTiers
              return JSON.stringify(obj)
            } catch {
              return prev
            }
          })
        }
      } else {
        showToast(data.error || t.admin.toast.qualityResetFailed, "error")
      }
    } catch {
      showToast(t.admin.toast.qualityResetNetError, "error")
    } finally {
      setSavingTiers(false)
    }
  }

  const handleTestCustomApi = async () => {
    if (!customApiUrl.trim()) {
      setTestResult({ success: false, message: t.admin.toast.apiTestFillUrl })
      return
    }
    setTestingApi(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_custom_api",
          customApiUrl: customApiUrl.trim(),
          customApiToken: customApiToken.trim(),
          target: targetInput.trim() || "speed.cloudflare.com",
        }),
      })
      const data = await res.json()
      if (data.success) {
        setTestResult({
          success: true,
          message: t.admin.toast.apiTestSuccess.replace("{count}", String(data.probesCount)),
          probes: data.probes || [],
        })
      } else {
        setTestResult({
          success: false,
          message: t.admin.toast.apiTestFailed.replace("{error}", data.error || ""),
        })
      }
    } catch {
      setTestResult({ success: false, message: t.admin.toast.apiTestNetError })
    } finally {
      setTestingApi(false)
    }
  }

  const handleResetRotationCycle = async () => {
    const confirmed = await dialog.confirm({
      title: t.admin.dialogs.cycleResetTitle,
      message: t.admin.dialogs.cycleResetMsg,
      cancelButtonContent: t.common.dialog.cancel,
      confirmButtonContent: t.admin.dialogs.confirmResetCycle,
    })
    if (!confirmed) return

    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_rotation_cycle" }),
      })
      const data = await res.json()
      if (data.success) {
        setUsedCitiesInCycle([])
        showToast(t.admin.toast.cycleResetSuccess)
      }
    } catch {
      showToast(t.admin.toast.cycleResetFailed, "error")
    }
  }

  const handleResetCityDefaults = async () => {
    const confirmed = await dialog.confirm({
      title: t.admin.dialogs.recommendCityTitle,
      message: t.admin.dialogs.recommendCityMsg,
      cancelButtonContent: t.common.dialog.cancel,
      confirmButtonContent: t.admin.dialogs.confirmRecommendCity,
    })
    if (!confirmed) return

    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_city_defaults" }),
      })
      const data = await res.json()
      if (data.success && data.cityDispatch) {
        setGuaranteedHubs(data.cityDispatch.guaranteedHubs)
        setRotatingCandidates(data.cityDispatch.rotatingCandidates)
        setRotationBatchSize(data.cityDispatch.rotationBatchSize)
        setEnableGeneralPool(false)
        setUsedCitiesInCycle([])
        setSavedConfigSnapshot((prev) => {
          if (!prev) return null
          try {
            const obj = JSON.parse(prev)
            obj.guaranteedHubs = [...data.cityDispatch.guaranteedHubs]
            obj.rotatingCandidates = [...data.cityDispatch.rotatingCandidates]
            obj.rotationBatchSize = data.cityDispatch.rotationBatchSize
            obj.enableGeneralPool = false
            return JSON.stringify(obj)
          } catch {
            return prev
          }
        })
        showToast(t.admin.toast.recommendResetSuccess)
      }
    } catch {
      showToast(t.admin.toast.recommendResetFailed, "error")
    }
  }

  const handleSetCityStatus = (cityKey: string, status: "guaranteed" | "rotating" | "excluded") => {
    if (status === "guaranteed") {
      setGuaranteedHubs((prev) => (prev.includes(cityKey) ? prev : [...prev, cityKey]))
      setRotatingCandidates((prev) => prev.filter((c) => c !== cityKey))
    } else if (status === "rotating") {
      setRotatingCandidates((prev) => (prev.includes(cityKey) ? prev : [...prev, cityKey]))
      setGuaranteedHubs((prev) => prev.filter((c) => c !== cityKey))
    } else {
      setGuaranteedHubs((prev) => prev.filter((c) => c !== cityKey))
      setRotatingCandidates((prev) => prev.filter((c) => c !== cityKey))
    }
  }

  const handleAddCustomCity = () => {
    const key = newCityKey.trim()
    const nameZh = newCityNameZh.trim() || key
    const province = newCityProvince.trim() || "其他省份"
    const region = newCityRegion || "西南中心"

    if (!key) {
      showToast(t.admin.toast.addCityKeyRequired, "error")
      return
    }

    const meta: CityMeta = {
      key,
      nameZh,
      province,
      region,
    }

    setKnownCities((prev) => ({ ...prev, [key]: meta }))

    if (newCityTargetPool === "guaranteed") {
      setGuaranteedHubs((prev) => (prev.includes(key) ? prev : [...prev, key]))
      setRotatingCandidates((prev) => prev.filter((c) => c !== key))
    } else {
      setRotatingCandidates((prev) => (prev.includes(key) ? prev : [...prev, key]))
      setGuaranteedHubs((prev) => prev.filter((c) => c !== key))
    }

    setNewCityKey("")
    setNewCityNameZh("")
    setNewCityProvince("")
    setShowAddCity(false)
    showToast(t.admin.toast.addCitySuccess.replace("{name}", nameZh).replace("{key}", key))
  }

  const handleRunManualTest = async () => {
    setTesting(true)
    try {
      const res = await fetch("/api/measure", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        showToast(t.admin.toast.manualTestComplete.replace("{count}", String(data.latest?.successfulProbes || 0)))
        await loadAdminConfig()
      } else {
        showToast(data.error || t.admin.toast.manualTestFailed, "error")
      }
    } catch {
      showToast(t.admin.toast.manualTestNetError, "error")
    } finally {
      setTesting(false)
    }
  }

  const handleDeleteBeforeDays = async (days: number) => {
    const targetDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toLocaleDateString("zh-CN")
    const confirmed = await dialog.confirm({
      title: t.admin.dialogs.cleanDaysTitle.replace("{days}", String(days)),
      message: t.admin.dialogs.cleanDaysMsg.replace("{days}", String(days)).replace("{date}", targetDate),
      confirmButtonContent: t.admin.dialogs.confirmClean,
      cancelButtonContent: t.common.dialog.cancel,
    })
    if (!confirmed) return

    setDeletingBefore(true)
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_before", days }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || t.admin.toast.cleanDaysSuccess.replace("{days}", String(days)))
        if (data.stats) setStats(data.stats)
      } else {
        showToast(data.error || t.admin.toast.cleanDaysFailed, "error")
      }
    } catch {
      showToast(t.admin.toast.cleanDaysNetError, "error")
    } finally {
      setDeletingBefore(false)
    }
  }

  const handleDeleteCustomDate = async () => {
    if (!customDateCutoff) {
      showToast(t.admin.toast.cleanCutoffSelect, "error")
      return
    }
    const confirmed = await dialog.confirm({
      title: t.admin.dialogs.cleanCutoffTitle,
      message: t.admin.dialogs.cleanCutoffMsg.replace("{date}", customDateCutoff),
      confirmButtonContent: t.admin.dialogs.confirmClean,
      cancelButtonContent: t.common.dialog.cancel,
    })
    if (!confirmed) return

    setDeletingBefore(true)
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_before", date: customDateCutoff }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || t.admin.toast.cleanCutoffSuccess.replace("{date}", customDateCutoff))
        if (data.stats) setStats(data.stats)
      } else {
        showToast(data.error || t.admin.toast.cleanCutoffFailed, "error")
      }
    } catch {
      showToast(t.admin.toast.cleanCutoffNetError, "error")
    } finally {
      setDeletingBefore(false)
    }
  }

  const handleVacuumDb = async () => {
    setVacuuming(true)
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vacuum" }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || t.admin.toast.vacuumSuccess)
        if (data.stats) setStats(data.stats)
      } else {
        showToast(data.error || t.admin.toast.vacuumFailed, "error")
      }
    } catch {
      showToast(t.admin.toast.vacuumNetError, "error")
    } finally {
      setVacuuming(false)
    }
  }

  const handleRunAutoMerge = async () => {
    const confirmed = await dialog.confirm({
      title: t.admin.dialogs.autoMergeTitle,
      message: t.admin.dialogs.autoMergeMsg.replace("{days}", String(autoMergePolicy.daysAgo)).replace("{points}", String(autoMergePolicy.pointsPerDay)),
      confirmButtonContent: t.admin.dialogs.confirmAutoMerge,
      cancelButtonContent: t.common.dialog.cancel,
    })
    if (!confirmed) return

    setRunningAutoMerge(true)
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "run_auto_merge",
          policy: autoMergePolicy,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || t.admin.toast.autoMergeSuccess)
        if (data.stats) setStats(data.stats)
        if (data.autoMergePolicy) {
          setAutoMergePolicy(data.autoMergePolicy)
          setSavedConfigSnapshot((prev) => {
            if (!prev) return null
            try {
              const obj = JSON.parse(prev)
              obj.autoMergePolicy = {
                enabled: Boolean(data.autoMergePolicy.enabled),
                daysAgo: Number(data.autoMergePolicy.daysAgo) || 7,
                pointsPerDay: Number(data.autoMergePolicy.pointsPerDay) || 24,
              }
              return JSON.stringify(obj)
            } catch {
              return prev
            }
          })
        }
      } else {
        showToast(data.error || t.admin.toast.autoMergeFailed, "error")
      }
    } catch {
      showToast(t.admin.toast.autoMergeNetError, "error")
    } finally {
      setRunningAutoMerge(false)
    }
  }

  const handleManualMerge = async () => {
    if (mergeMode === "single" && !mergeDate) {
      showToast(t.admin.toast.manualMergeSelectDate, "error")
      return
    }
    if (mergeMode === "range" && (!mergeStartDate || !mergeEndDate)) {
      showToast(t.admin.toast.manualMergeSelectRange, "error")
      return
    }

    const dateScopeText = mergeMode === "single" ? `单日【${mergeDate}】` : `日期范围【${mergeStartDate} 至 ${mergeEndDate}】`
    const confirmed = await dialog.confirm({
      title: t.admin.dialogs.manualMergeTitle,
      message: t.admin.dialogs.manualMergeMsg.replace("{scope}", dateScopeText).replace("{points}", String(mergePointsPerDay)),
      confirmButtonContent: t.admin.dialogs.confirmManualMerge,
      cancelButtonContent: t.common.dialog.cancel,
    })
    if (!confirmed) return

    setManualMerging(true)
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual_merge",
          dateDay: mergeMode === "single" ? mergeDate : undefined,
          startDate: mergeMode === "range" ? mergeStartDate : undefined,
          endDate: mergeMode === "range" ? mergeEndDate : undefined,
          pointsPerDay: mergePointsPerDay,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || t.admin.toast.manualMergeSuccess)
        if (data.stats) setStats(data.stats)
      } else {
        showToast(data.error || t.admin.toast.manualMergeFailed, "error")
      }
    } catch {
      showToast(t.admin.toast.manualMergeNetError, "error")
    } finally {
      setManualMerging(false)
    }
  }

  const handlePruneData = async () => {
    const confirmed = await dialog.confirm({
      title: t.admin.dialogs.clearOldTitle,
      message: t.admin.dialogs.clearOldMsg,
      confirmButtonContent: t.admin.dialogs.confirmClean,
      cancelButtonContent: t.common.dialog.cancel,
    })
    if (!confirmed) return

    setPruning(true)
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prune" }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || t.admin.toast.clearOldSuccess)
        if (data.stats) setStats(data.stats)
      } else {
        showToast(data.error || t.admin.toast.clearOldFailed, "error")
      }
    } catch {
      showToast(t.admin.toast.clearOldNetError, "error")
    } finally {
      setPruning(false)
    }
  }

  const handleClearAllHistory = async () => {
    const confirmed = await dialog.confirm({
      title: t.admin.dialogs.clearAllTitle,
      message: t.admin.dialogs.clearAllMsg,
      confirmButtonContent: t.admin.dialogs.confirmClearAll,
      cancelButtonContent: t.common.dialog.cancel,
    })
    if (!confirmed) return

    setClearing(true)
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_all" }),
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message || t.admin.toast.clearAllSuccess)
        if (data.stats) setStats(data.stats)
      } else {
        showToast(data.error || t.admin.toast.clearAllFailed, "error")
      }
    } catch {
      showToast(t.admin.toast.clearAllNetError, "error")
    } finally {
      setClearing(false)
    }
  }

  const handleLogout = async () => {
    const confirmed = await dialog.confirm({
      title: t.admin.dialogs.logoutTitle,
      message: t.admin.dialogs.logoutMsg,
      confirmButtonContent: t.admin.dialogs.confirmLogout,
      cancelButtonContent: t.common.dialog.cancel,
    })
    if (!confirmed) return

    await fetch("/api/admin/login", { method: "DELETE" })
    setIsLoggedIn(false)
    showToast(t.admin.toast.logoutSuccess)
  }

  // 过滤展示的城市列表
  const allCityKeys = React.useMemo(() => {
    const set = new Set<string>()
    guaranteedHubs.forEach((c) => set.add(c))
    rotatingCandidates.forEach((c) => set.add(c))
    Object.keys(knownCities).forEach((c) => set.add(c))
    return Array.from(set)
  }, [guaranteedHubs, rotatingCandidates, knownCities])

  const filteredCityKeys = React.useMemo(() => {
    return allCityKeys.filter((key) => {
      const meta = knownCities[key] || getCityMeta(key)
      if (selectedRegion !== "all" && meta.region !== selectedRegion) {
        return false
      }
      if (citySearch.trim()) {
        const q = citySearch.toLowerCase().trim()
        const matchZh = meta.nameZh.toLowerCase().includes(q)
        const matchEn = meta.key.toLowerCase().includes(q)
        const matchProv = meta.province.toLowerCase().includes(q)
        if (!matchZh && !matchEn && !matchProv) return false
      }
      return true
    })
  }, [allCityKeys, knownCities, selectedRegion, citySearch])

  // 加载中状态
  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] dark:bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0066cc] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f7] text-[#1d1d1f] dark:bg-black dark:text-[#f5f5f7] transition-colors duration-200">
      {/* 顶部管理员专用导航栏 */}
      <header className="sticky top-0 z-40 w-full border-b border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#1c1c1e]/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-neutral-200/80 bg-white hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors shadow-sm"
              title={t.admin.backToHome}
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/20 dark:text-[#2997ff]">
                <Shield className="h-4 w-4" />
              </div>
              <h1 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                {t.admin.pageTitle}
              </h1>
              <span className="hidden sm:inline-block rounded-full bg-neutral-200/70 px-2 py-0.5 text-[10px] font-mono text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                /admin
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium text-[#0066cc] hover:underline dark:text-[#2997ff] hidden sm:inline-block"
            >
              {t.admin.backToHome}
            </Link>

            <LanguageSwitcher />

            <Button
              onClick={toggleTheme}
              variant="ghost"
              size="icon"
              className="rounded-full text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {isLoggedIn && (
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-full text-xs text-neutral-600 border-neutral-200 dark:border-neutral-700 dark:text-neutral-400 hover:text-rose-600 hover:border-rose-200 dark:hover:text-rose-400 dark:hover:border-rose-800 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.admin.logout}</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 浮动 Toast 消息提示 */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-medium shadow-xl backdrop-blur-xl border ${
              toast.type === "success"
                ? "bg-emerald-500/90 text-white border-emerald-400/50"
                : "bg-rose-500/90 text-white border-rose-400/50"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
        </div>
      )}

      {/* 主体内容 */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-8">
        {!isLoggedIn ? (
          /* 未登录拦截视图 */
          <div className="mx-auto max-w-md mt-12 rounded-3xl border border-black/[0.06] bg-white p-8 apple-card-shadow backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#1c1c1e]">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff]">
                <Shield className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                {t.admin.loginTitle}
              </h2>
              <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500 leading-relaxed">
                {t.admin.loginDesc}
              </p>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  {t.admin.loginPasswordLabel}
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.admin.passwordPlaceholder}
                  autoFocus
                  className="rounded-xl"
                />
              </div>

              <Button
                type="submit"
                disabled={loginLoading}
                className="w-full rounded-xl py-2.5 font-medium shadow-sm"
              >
                {loginLoading ? t.admin.loginVerifying : t.admin.loginBtn}
              </Button>
            </form>
          </div>
        ) : (
          /* 已登录后台管理面板 */
          <div className="space-y-6">
            {/* 顶栏概览与操作 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-black/[0.06] bg-white p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e]">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {t.admin.overviewTitle}
                </h2>
                <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                  {t.admin.overviewDesc}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleRunManualTest}
                  disabled={testing}
                  variant="outline"
                  className="rounded-full text-xs gap-1.5 border-neutral-200 dark:border-neutral-700 h-9"
                >
                  <Play className={`h-3.5 w-3.5 text-[#0066cc] dark:text-[#2997ff] ${testing ? "animate-spin" : ""}`} />
                  <span>{testing ? t.admin.runningManualTest : t.admin.runManualTestBtn}</span>
                </Button>

                <Button
                  onClick={handleSaveConfig}
                  disabled={saving || !isConfigDirty}
                  className={`rounded-full text-xs px-5 shadow-sm h-9 font-semibold transition-all duration-200 ${
                    !isConfigDirty
                      ? "opacity-40 cursor-not-allowed bg-neutral-200 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 shadow-none hover:bg-neutral-200 dark:hover:bg-neutral-800"
                      : "bg-[#0066cc] hover:bg-[#0055b3] text-white dark:bg-[#2997ff] dark:hover:bg-[#147ce5] dark:text-black hover:scale-[1.02] active:scale-[0.98]"
                  }`}
                  title={!isConfigDirty ? t.admin.noChangesTitle : t.admin.dirtyTitle}
                >
                  {saving ? t.admin.saving : t.admin.saveAllChanges}
                </Button>
              </div>
            </div>

            {/* Tab 标签页切换器 */}
            <div className="flex items-center gap-1.5 rounded-2xl bg-neutral-200/60 p-1.5 backdrop-blur-md dark:bg-neutral-800/60 text-xs sm:text-sm font-medium">
              <button
                type="button"
                onClick={() => setActiveTab("provider")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
                  activeTab === "provider"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-[#1c1c1e] dark:text-neutral-100 font-semibold"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                }`}
              >
                <Layers className="h-4 w-4 text-[#0066cc] dark:text-[#2997ff]" />
                <span className="whitespace-nowrap">{t.admin.tabs.provider}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("dispatch")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
                  activeTab === "dispatch"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-[#1c1c1e] dark:text-neutral-100 font-semibold"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                }`}
              >
                <MapPin className="h-4 w-4 text-amber-500" />
                <span className="whitespace-nowrap">{t.admin.tabs.dispatch}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("thresholds")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
                  activeTab === "thresholds"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-[#1c1c1e] dark:text-neutral-100 font-semibold"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                }`}
              >
                <Sliders className="h-4 w-4 text-emerald-500" />
                <span className="whitespace-nowrap">{t.admin.tabs.thresholds}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("scheduler")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
                  activeTab === "scheduler"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-[#1c1c1e] dark:text-neutral-100 font-semibold"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                }`}
              >
                <Clock className="h-4 w-4 text-purple-500" />
                <span className="whitespace-nowrap">{t.admin.tabs.scheduler}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("database")}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 transition-all ${
                  activeTab === "database"
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-[#1c1c1e] dark:text-neutral-100 font-semibold"
                    : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                }`}
              >
                <Database className="h-4 w-4 text-emerald-500" />
                <span className="whitespace-nowrap">{t.admin.tabs.database}</span>
              </button>
            </div>

            {/* TAB 1: 数据源与目标 */}
            {activeTab === "provider" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex flex-col justify-between rounded-3xl border border-black/[0.06] bg-white p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e]">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-[#0066cc] dark:text-[#2997ff]" />
                        <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                          {t.admin.provider.targetInputLabel}
                        </h3>
                      </div>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">
                        {t.admin.provider.desc}
                      </p>

                      <div className="pt-2">
                        <Input
                          value={targetInput}
                          onChange={(e) => setTargetInput(e.target.value)}
                          placeholder={t.admin.provider.targetInputPlaceholder}
                          className="rounded-xl font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400">
                      {t.admin.provider.activeTargetLabel} <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">{targetInput}</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-3xl border border-black/[0.06] bg-white p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e]">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-amber-500" />
                          <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                            {t.admin.provider.packetsLabel}
                          </h3>
                        </div>
                        <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-100 px-2.5 py-1 rounded-lg dark:bg-neutral-800">
                          {pingPackets} {t.admin.provider.packetsPerNode}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 dark:text-neutral-500">
                        {t.admin.provider.packetsHint}
                      </p>

                      <div className="pt-2 space-y-2">
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={pingPackets}
                          onChange={(e) => setPingPackets(parseInt(e.target.value, 10))}
                          className="w-full accent-[#0066cc]"
                        />
                        <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                          <span>{t.admin.provider.packetSpeed1}</span>
                          <span>{t.admin.provider.packetSpeed3}</span>
                          <span>{t.admin.provider.packetSpeed5}</span>
                          <span>{t.admin.provider.packetSpeed10}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-400">
                      {t.admin.provider.packetsFootnote}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-black/[0.06] bg-white p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] space-y-5">
                  <div className="flex items-center justify-between border-b border-neutral-100 pb-4 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-[#0066cc] dark:text-[#2997ff]" />
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                          {t.admin.provider.modeLabel}
                        </h3>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500">
                          {t.admin.provider.desc}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#0066cc]/10 px-2.5 py-1 text-xs font-medium text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff]">
                      {t.admin.provider.multiSourceBadge}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveProvider("globalping")}
                      className={`rounded-2xl p-4 text-left transition-all border ${
                        activeProvider === "globalping"
                          ? "border-[#0066cc] bg-[#0066cc]/5 dark:border-[#2997ff] dark:bg-[#2997ff]/10 shadow-sm"
                          : "border-neutral-200/80 bg-neutral-50/50 hover:bg-neutral-100/50 dark:border-neutral-800 dark:bg-neutral-900/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">{t.admin.provider.globalpingCardTitle}</span>
                        {activeProvider === "globalping" && (
                          <span className="h-2.5 w-2.5 rounded-full bg-[#0066cc] dark:bg-[#2997ff]" />
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                        {t.admin.provider.globalpingCardDesc}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveProvider("custom")}
                      className={`rounded-2xl p-4 text-left transition-all border ${
                        activeProvider === "custom"
                          ? "border-[#0066cc] bg-[#0066cc]/5 dark:border-[#2997ff] dark:bg-[#2997ff]/10 shadow-sm"
                          : "border-neutral-200/80 bg-neutral-50/50 hover:bg-neutral-100/50 dark:border-neutral-800 dark:bg-neutral-900/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">{t.admin.provider.customCardTitle}</span>
                        {activeProvider === "custom" && (
                          <span className="h-2.5 w-2.5 rounded-full bg-[#0066cc] dark:bg-[#2997ff]" />
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                        {t.admin.provider.customCardDesc}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveProvider("all")}
                      className={`rounded-2xl p-4 text-left transition-all border ${
                        activeProvider === "all"
                          ? "border-[#0066cc] bg-[#0066cc]/5 dark:border-[#2997ff] dark:bg-[#2997ff]/10 shadow-sm"
                          : "border-neutral-200/80 bg-neutral-50/50 hover:bg-neutral-100/50 dark:border-neutral-800 dark:bg-neutral-900/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">{t.admin.provider.hybridCardTitle}</span>
                        {activeProvider === "all" && (
                          <span className="h-2.5 w-2.5 rounded-full bg-[#0066cc] dark:bg-[#2997ff]" />
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                        {t.admin.provider.hybridCardDesc}
                      </p>
                    </button>
                  </div>

                  {(activeProvider === "custom" || activeProvider === "all") && (
                    <div className="space-y-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                            <span>{t.admin.provider.customApiUrlLabel}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">{t.admin.provider.postEndpointBadge}</span>
                          </label>
                          <Input
                            value={customApiUrl}
                            onChange={(e) => setCustomApiUrl(e.target.value)}
                            placeholder={t.admin.provider.customApiUrlPlaceholder}
                            className="font-mono text-xs rounded-xl"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                            <span>{t.admin.provider.customApiTokenLabel}</span>
                            <span className="text-[10px] text-neutral-400">{t.admin.provider.tokenOptionalHint}</span>
                          </label>
                          <Input
                            type="password"
                            value={customApiToken}
                            onChange={(e) => setCustomApiToken(e.target.value)}
                            placeholder={t.admin.provider.customApiTokenPlaceholder}
                            className="font-mono text-xs rounded-xl"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleTestCustomApi}
                          disabled={testingApi || !customApiUrl.trim()}
                          className="text-xs rounded-xl h-9"
                        >
                          {testingApi ? t.admin.provider.testingAndPreviewing : t.admin.provider.testAndPreviewBtn}
                        </Button>

                        <button
                          type="button"
                          onClick={() => setShowDoc(!showDoc)}
                          className="text-xs text-[#0066cc] dark:text-[#2997ff] hover:underline flex items-center gap-1"
                        >
                          <Code2 className="h-4 w-4" />
                          <span>{showDoc ? t.admin.provider.docCollapse : t.admin.provider.docExpand}</span>
                        </button>
                      </div>

                      {testResult && (
                        <div
                          className={`rounded-2xl p-4 text-xs space-y-2 ${
                            testResult.success
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          <div className="font-semibold">{testResult.message}</div>
                          {testResult.probes && testResult.probes.length > 0 && (
                            <div className="max-h-40 overflow-y-auto space-y-1 text-xs font-mono border-t border-emerald-500/20 pt-2">
                              {testResult.probes.map((p: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center py-1">
                                  <span>
                                    {p.probe?.city || t.admin.provider.unknownCity} · {p.carrierName} ({p.probe?.asn ? `AS${p.probe.asn}` : t.admin.provider.selfBuilt})
                                  </span>
                                  <span className="font-semibold">{p.stats?.avg ?? "-"} ms</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {showDoc && (
                        <div className="rounded-2xl bg-neutral-100 dark:bg-black/40 p-4 text-xs font-mono space-y-2 border border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
                          <p className="font-sans font-semibold text-neutral-900 dark:text-neutral-100">
                            {t.admin.provider.docSectionTitle}
                          </p>
                          <pre className="overflow-x-auto text-[11px] leading-relaxed p-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5">
{`POST /ping
Content-Type: application/json
Authorization: Bearer <token>

Body: { "target": "speed.cloudflare.com", "packets": 3 }

${t.admin.provider.docResponseTitle}
{
  "probes": [
    {
      "city": "重庆",
      "carrier": "unicom",
      "carrierName": "中国联通",
      "avg": 24.5,
      "min": 23.1,
      "max": 28.0,
      "loss": 0
    }
  ]
}`}
                          </pre>
                          <p className="font-sans text-xs text-neutral-400">
                            * 运行项目内的轻量示例服务端即可体验：<code className="text-[#0066cc] dark:text-[#2997ff]">node docs/custom-provider-example.js</code>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: 省市保底与轮换调度 */}
            {activeTab === "dispatch" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="relative overflow-hidden rounded-3xl border border-black/[0.06] bg-white p-5 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] transition-all duration-200 hover:-translate-y-0.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-[#0066cc] dark:bg-blue-500/20 dark:text-[#2997ff]">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                          {t.admin.dispatch.guaranteedTitle}
                        </span>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-[#0066cc] dark:bg-blue-500/20 dark:text-[#2997ff]">
                        {t.admin.dispatch.guaranteedBadge}
                      </span>
                    </div>
                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-semibold tracking-tight font-mono text-neutral-900 dark:text-neutral-50">
                        {guaranteedHubs.length}
                      </span>
                      <span className="text-xs font-normal text-neutral-400">{t.common.units.cities}</span>
                    </div>
                    <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500 leading-relaxed">
                      {t.admin.dispatch.guaranteedHubDesc}
                    </p>
                  </div>

                  <div className="relative overflow-hidden rounded-3xl border border-black/[0.06] bg-white p-5 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] transition-all duration-200 hover:-translate-y-0.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                          <RotateCcw className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                          {t.admin.dispatch.rotatingTitle}
                        </span>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                        {t.admin.dispatch.rotatingBadge}
                      </span>
                    </div>
                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="text-3xl sm:text-4xl font-semibold tracking-tight font-mono text-neutral-900 dark:text-neutral-50">
                        {rotatingCandidates.length}
                      </span>
                      <span className="text-xs font-normal text-neutral-400">{t.common.units.cities}</span>
                    </div>
                    <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500 leading-relaxed">
                      {t.admin.dispatch.rotatingHubDesc.replace("{count}", String(rotationBatchSize))}
                    </p>
                  </div>

                  <div className="relative overflow-hidden rounded-3xl border border-black/[0.06] bg-white p-5 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] transition-all duration-200 hover:-translate-y-0.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                          <Activity className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                          {t.admin.dispatch.cycleProgressTitle}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetRotationCycle}
                        className="group inline-flex items-center gap-1.5 rounded-full bg-blue-50 hover:bg-[#0066cc] text-[#0066cc] hover:text-white dark:bg-blue-950/60 dark:hover:bg-[#2997ff] dark:text-[#2997ff] dark:hover:text-black border border-blue-200/90 dark:border-blue-800/80 px-2.5 py-1 text-[11px] font-semibold transition-all duration-200 active:scale-95 cursor-pointer shadow-2xs hover:shadow-xs"
                        title={t.admin.dispatch.resetCycleBtn}
                      >
                        <RotateCcw className="h-3 w-3 transition-transform duration-300 group-hover:-rotate-90" />
                        <span>{t.admin.dispatch.resetCycleBtnText}</span>
                      </button>
                    </div>
                    <div className="mt-4 flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl sm:text-4xl font-semibold tracking-tight font-mono text-neutral-900 dark:text-neutral-50">
                          {usedCitiesInCycle.length}
                        </span>
                        <span className="text-sm font-medium text-neutral-400">/ {rotatingCandidates.length}</span>
                        <span className="text-xs font-normal text-neutral-400 ml-0.5">{t.admin.dispatch.testedUnit}</span>
                      </div>
                      <span className="text-xs font-mono text-neutral-400 font-medium">
                        {Math.round((usedCitiesInCycle.length / (rotatingCandidates.length || 1)) * 100)}%
                      </span>
                    </div>
                    <div className="mt-2.5 space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out"
                          style={{
                            width: `${Math.min(100, Math.round((usedCitiesInCycle.length / (rotatingCandidates.length || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 pt-0.5">
                        <span>{t.admin.dispatch.pendingCities.replace("{count}", String(Math.max(rotatingCandidates.length - usedCitiesInCycle.length, 0)))}</span>
                        <span>{usedCitiesInCycle.length >= rotatingCandidates.length ? t.admin.dispatch.cycleCompleted : t.admin.dispatch.cycleRunning}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-black/[0.06] bg-white p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Sliders className="h-4 w-4 text-[#0066cc] dark:text-[#2997ff]" />
                      <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                        {t.admin.dispatch.batchQuotaTitle}
                      </h3>
                    </div>
                    <div className="inline-flex items-center rounded-full bg-neutral-100/90 p-1 dark:bg-neutral-800/90 border border-black/[0.04] dark:border-white/[0.06]">
                      {[10, 12, 16, 20].map((preset) => {
                        const isSelected = rotationBatchSize === preset
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setRotationBatchSize(preset)}
                            className={`w-[72px] py-1 rounded-full text-xs font-mono select-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 transition-colors duration-150 text-center ${
                              isSelected
                                ? "bg-[#0066cc] text-white shadow-sm dark:bg-[#2997ff] dark:text-black font-semibold"
                                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white font-medium"
                            }`}
                          >
                            {preset} {t.admin.dispatch.nodeUnit}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                          {t.admin.dispatch.generalPoolTitle}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                            enableGeneralPool
                              ? "bg-blue-500/10 text-[#0066cc] dark:bg-blue-500/20 dark:text-[#2997ff]"
                              : "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                          }`}
                        >
                          {enableGeneralPool ? t.admin.dispatch.modeFullMesh : t.admin.dispatch.modePreciseSaving}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                        {enableGeneralPool
                          ? t.admin.dispatch.modeFullMeshDesc
                          : t.admin.dispatch.modePreciseSavingDesc.replace("{count}", String(guaranteedHubs.length + rotationBatchSize))}
                      </p>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={enableGeneralPool}
                      onClick={() => setEnableGeneralPool(!enableGeneralPool)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        enableGeneralPool ? "bg-[#0066cc] dark:bg-[#2997ff]" : "bg-neutral-200 dark:bg-neutral-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          enableGeneralPool ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <p className="text-xs text-neutral-400 dark:text-neutral-500 pt-1">
                    {enableGeneralPool ? (
                      <>
                        {t.admin.dispatch.actualLimitDescFull
                          .replace("{hubs}", String(guaranteedHubs.length))
                          .replace("{batch}", String(rotationBatchSize))
                          .replace("{pool}", String(Math.max(45 - guaranteedHubs.length - rotationBatchSize, 10)))}
                      </>
                    ) : (
                      <>
                        {t.admin.dispatch.actualLimitDescSaving
                          .replace("{hubs}", String(guaranteedHubs.length))
                          .replace("{batch}", String(rotationBatchSize))
                          .replace("{total}", String(guaranteedHubs.length + rotationBatchSize))}
                      </>
                    )}
                  </p>
                </div>

                <div className="rounded-3xl border border-black/[0.06] bg-white p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                      <Input
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        placeholder={t.admin.dispatch.searchPlaceholder}
                        className="pl-9 h-9 text-xs bg-neutral-50 dark:bg-neutral-900 rounded-xl"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddCity(!showAddCity)}
                        className="h-9 text-xs rounded-xl flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>{t.admin.dispatch.addCityBtn}</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetCityDefaults}
                        className="h-9 text-xs rounded-xl flex items-center gap-1.5 text-[#0066cc] dark:text-[#2997ff]"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{t.admin.dispatch.resetRecommendBtn}</span>
                      </Button>
                    </div>
                  </div>

                  {showAddCity && (
                    <div className="rounded-2xl border border-neutral-200/80 bg-neutral-100/70 p-4 dark:border-neutral-800 dark:bg-black/40 space-y-3">
                      <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                        {t.admin.dispatch.addCityModalTitle}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                        <Input
                          placeholder={t.admin.dispatch.cityKeyInput}
                          value={newCityKey}
                          onChange={(e) => setNewCityKey(e.target.value)}
                          className="bg-white dark:bg-[#1c1c1e] text-xs h-9"
                        />
                        <Input
                          placeholder={t.admin.dispatch.cityNameZhInput}
                          value={newCityNameZh}
                          onChange={(e) => setNewCityNameZh(e.target.value)}
                          className="bg-white dark:bg-[#1c1c1e] text-xs h-9"
                        />
                        <Input
                          placeholder={t.admin.dispatch.cityProvinceInput}
                          value={newCityProvince}
                          onChange={(e) => setNewCityProvince(e.target.value)}
                          className="bg-white dark:bg-[#1c1c1e] text-xs h-9"
                        />
                        <select
                          value={newCityRegion}
                          onChange={(e) => setNewCityRegion(e.target.value)}
                          className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs dark:border-neutral-800 dark:bg-[#1c1c1e] text-neutral-700 dark:text-neutral-300"
                        >
                          {REGION_OPTIONS.filter((r) => r.key !== "all").map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-neutral-500 text-xs">{t.admin.dispatch.initialAllocation}</span>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="targetPool"
                              checked={newCityTargetPool === "guaranteed"}
                              onChange={() => setNewCityTargetPool("guaranteed")}
                            />
                            <span>{t.admin.dispatch.allocGuaranteed}</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="targetPool"
                              checked={newCityTargetPool === "rotating"}
                              onChange={() => setNewCityTargetPool("rotating")}
                            />
                            <span>{t.admin.dispatch.allocRotating}</span>
                          </label>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAddCity(false)}
                            className="h-8 text-xs"
                          >
                            {t.common.dialog.cancel}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAddCustomCity}
                            className="h-8 text-xs rounded-xl"
                          >
                            {t.admin.dispatch.confirmAddBtn}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    {REGION_OPTIONS.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setSelectedRegion(r.key)}
                        className={`rounded-xl px-3 py-1.5 transition-all shrink-0 font-medium ${
                          selectedRegion === r.key
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800/60 dark:text-neutral-400 dark:hover:bg-neutral-800"
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {filteredCityKeys.map((cityKey) => {
                      const meta = knownCities[cityKey] || getCityMeta(cityKey)
                      const isGuaranteed = guaranteedHubs.includes(cityKey)
                      const isRotating = rotatingCandidates.includes(cityKey)
                      const isExcluded = !isGuaranteed && !isRotating
                      const isUsedInCycle = usedCitiesInCycle.includes(cityKey)

                      return (
                        <div
                          key={cityKey}
                          className={`flex items-center justify-between rounded-2xl p-3 border transition-all ${
                            isGuaranteed
                              ? "border-blue-500/30 bg-blue-50/40 dark:border-blue-500/30 dark:bg-blue-950/15"
                              : isRotating
                              ? "border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-[#1c1c1e]"
                              : "border-neutral-200/40 bg-neutral-100/50 opacity-60 dark:border-neutral-800/40 dark:bg-neutral-900/40"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                                {meta.nameZh}
                              </span>
                              <span className="text-[10px] text-neutral-400 font-mono">
                                {meta.key}
                              </span>
                              {isUsedInCycle && isRotating && (
                                <span className="rounded-full bg-emerald-500/15 px-2 py-0.2 text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  {t.admin.dispatch.statusTestedInCycle}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                              <span>{meta.province}</span>
                              <span>·</span>
                              <span>{meta.region}</span>
                            </div>
                          </div>

                          <div className="flex items-center rounded-xl bg-neutral-200/60 p-0.5 dark:bg-neutral-800/80 text-[11px]">
                            <button
                              type="button"
                              title={t.admin.dispatch.btnGuaranteedTitle}
                              onClick={() => handleSetCityStatus(cityKey, "guaranteed")}
                              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                                isGuaranteed
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                              }`}
                            >
                              {t.admin.dispatch.btnGuaranteed}
                            </button>
                            <button
                              type="button"
                              title={t.admin.dispatch.btnRotatingTitle}
                              onClick={() => handleSetCityStatus(cityKey, "rotating")}
                              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                                isRotating
                                  ? "bg-amber-500 text-white shadow-xs"
                                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                              }`}
                            >
                              {t.admin.dispatch.btnRotating}
                            </button>
                            <button
                              type="button"
                              title={t.admin.dispatch.btnExcludedTitle}
                              onClick={() => handleSetCityStatus(cityKey, "excluded")}
                              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                                isExcluded
                                  ? "bg-neutral-400 text-white dark:bg-neutral-600"
                                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
                              }`}
                            >
                              {t.admin.dispatch.btnExcluded}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: 网络评级档位与色彩级联规则引擎 */}
            {activeTab === "thresholds" && (
              <QualityTiersEditor
                initialTiers={qualityTiers}
                onChange={setQualityTiers}
                onReset={handleResetQualityTiers}
              />
            )}

            {/* TAB 4: 自动巡检周期与调度算法 */}
            {activeTab === "scheduler" && (
              <div className="rounded-3xl border border-black/[0.06] bg-white p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] space-y-6">
                <div className="flex items-center gap-2 border-b border-neutral-100 pb-4 dark:border-neutral-800">
                  <Clock className="h-4 w-4 text-[#0066cc] dark:text-[#2997ff]" />
                  <div>
                    <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                      {t.admin.scheduler.title}
                    </h3>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">
                      {t.admin.scheduler.desc}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    {t.admin.scheduler.modeHeader}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setScheduleMode("aligned")}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        scheduleMode === "aligned"
                          ? "border-[#0066cc] bg-[#0066cc]/5 dark:border-[#2997ff] dark:bg-[#2997ff]/10"
                          : "border-neutral-200/80 bg-neutral-50/50 hover:bg-neutral-100/50 dark:border-neutral-800 dark:bg-neutral-900/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-[#0066cc] dark:text-[#2997ff]" />
                          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                            {t.admin.scheduler.alignedModeTitle}
                          </span>
                        </div>
                        <span className={`h-2.5 w-2.5 rounded-full ${scheduleMode === "aligned" ? "bg-[#0066cc] dark:bg-[#2997ff]" : "bg-neutral-300"}`} />
                      </div>
                      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        {t.admin.scheduler.alignedModeDesc}
                      </p>
                    </div>

                    <div
                      onClick={() => setScheduleMode("interval")}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                        scheduleMode === "interval"
                          ? "border-[#0066cc] bg-[#0066cc]/5 dark:border-[#2997ff] dark:bg-[#2997ff]/10"
                          : "border-neutral-200/80 bg-neutral-50/50 hover:bg-neutral-100/50 dark:border-neutral-800 dark:bg-neutral-900/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-emerald-500" />
                          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                            {t.admin.scheduler.intervalModeTitle}
                          </span>
                        </div>
                        <span className={`h-2.5 w-2.5 rounded-full ${scheduleMode === "interval" ? "bg-emerald-500" : "bg-neutral-300"}`} />
                      </div>
                      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                        {t.admin.scheduler.intervalModeDesc}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      {t.admin.scheduler.intervalSectionLabel}
                    </label>
                    <span className="font-mono text-xs text-neutral-400">
                      {t.admin.scheduler.actualEffectiveCycle}{" "}
                      <span className="font-bold text-[#0066cc] dark:text-[#2997ff]">
                        {formatDuration(currentTotalSec)}
                      </span>
                      <span className="text-neutral-400 font-normal ml-1">
                        ({currentTotalSec} {t.admin.scheduler.secondsUnit})
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="relative w-36 sm:w-40">
                        <Input
                          type="number"
                          step="any"
                          min="0.001"
                          value={intervalValue}
                          onChange={(e) => {
                            const val = e.target.value
                            setIntervalValue(val)
                            const num = parseFloat(val)
                            if (!isNaN(num) && num > 0) {
                              setRawIntervalSeconds(Math.max(5, Math.round(num * TIME_UNIT_SECONDS[intervalUnit])))
                            }
                          }}
                          placeholder={t.admin.scheduler.secondsPlaceholder}
                          className="rounded-xl font-mono text-sm pr-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-400 pointer-events-none font-mono">
                          {intervalUnit}
                        </span>
                      </div>

                      {/* 单位切换胶囊组 */}
                      <div className="flex items-center rounded-xl bg-neutral-100 dark:bg-neutral-800/80 p-1 border border-black/[0.04] dark:border-white/[0.04]">
                        {(["s", "m", "h", "d", "mo"] as TimeUnit[]).map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => handleUnitChange(u)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                              intervalUnit === u
                                ? "bg-white dark:bg-neutral-700 text-[#0066cc] dark:text-[#2997ff] font-semibold shadow-2xs"
                                : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
                            }`}
                          >
                            {t.admin.scheduler.units[u]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-neutral-400 dark:text-neutral-500 leading-relaxed">
                      {t.admin.scheduler.secondsFootnote}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                    <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500">
                      {t.admin.scheduler.presetQuickSelect}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {(PRESET_INTERVAL_MAP[intervalUnit] || []).map((item) => (
                        <button
                          key={item.sec}
                          type="button"
                          onClick={() => {
                            setRawIntervalSeconds(item.sec)
                            setIntervalUnit(item.unit)
                            setIntervalValue(item.val.toString())
                          }}
                          className={`rounded-xl px-3 py-1.5 text-xs font-mono transition-all cursor-pointer ${
                            currentTotalSec === item.sec
                              ? "bg-[#0066cc] text-white dark:bg-[#2997ff] dark:text-black font-semibold shadow-xs"
                              : "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800/80 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: 数据库与运维 */}
            {activeTab === "database" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="rounded-3xl border border-black/[0.06] bg-white p-4 sm:p-5 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500">
                      <span className="text-xs font-medium">{t.admin.database.diskSpaceTitle}</span>
                      <HardDrive className="h-4 w-4 text-[#0066cc] dark:text-[#2997ff]" />
                    </div>
                    <div className="mt-2.5">
                      <p className="font-mono text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        {stats?.fileSize?.formattedSize || "0 B"}
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-0.5 truncate">
                        {t.admin.database.mainDbLabel} {formatBytes(stats?.fileSize?.mainBytes || 0)}
                        {stats?.fileSize?.walBytes ? ` · ${t.admin.database.walDbLabel} ${formatBytes(stats.fileSize.walBytes)}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/[0.06] bg-white p-4 sm:p-5 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500">
                      <span className="text-xs font-medium">{t.admin.database.totalRoundsTitle}</span>
                      <Activity className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="mt-2.5">
                      <p className="font-mono text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        {stats?.totalMeasurements ?? 0} <span className="text-xs font-normal text-neutral-400">{t.admin.database.roundUnit}</span>
                      </p>
                      <p className="text-[10px] text-emerald-500 font-medium mt-0.5">
                        {t.admin.database.todayRoundsInc.replace("{count}", String(stats?.todayMeasurements ?? 0))}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/[0.06] bg-white p-4 sm:p-5 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500">
                      <span className="text-xs font-medium">{t.admin.database.probeRecordsTitle}</span>
                      <Layers className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div className="mt-2.5">
                      <p className="font-mono text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        {stats?.totalProbeRecords ?? 0} <span className="text-xs font-normal text-neutral-400">{t.admin.database.recordUnit}</span>
                      </p>
                      <p className="text-[10px] text-indigo-500 font-medium mt-0.5">
                        {t.admin.database.todayRecordsInc.replace("{count}", String(stats?.todayProbeRecords ?? 0))}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/[0.06] bg-white p-4 sm:p-5 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] flex flex-col justify-between">
                    <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500">
                      <span className="text-xs font-medium">{t.admin.database.historySpanTitle}</span>
                      <Calendar className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="mt-2.5">
                      <p className="font-mono text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                        {stats?.oldestTimestamp && stats?.latestTimestamp
                          ? `${Math.max(1, Math.round((stats.latestTimestamp - stats.oldestTimestamp) / (24 * 3600 * 1000)) + 1)} ${t.common.units.days}`
                          : (stats?.totalMeasurements ? `1 ${t.common.units.days}` : `0 ${t.common.units.days}`)}
                      </p>
                      <p className="text-[10px] text-neutral-400 mt-0.5 truncate">
                        {t.admin.database.earliestDatePrefix} {stats?.oldestTimestamp ? new Date(stats.oldestTimestamp).toLocaleDateString("zh-CN") : "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-black/[0.06] bg-white p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4 dark:border-neutral-800">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-400">
                        <Layers className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                            {t.admin.database.rollupCardTitle}
                          </h3>
                          <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                            {t.admin.database.storageOptimizationBadge}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                          {t.admin.database.rollupCardDesc}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900/40 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={autoMergePolicy.enabled}
                          onClick={() => setAutoMergePolicy((prev) => ({ ...prev, enabled: !prev.enabled }))}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            autoMergePolicy.enabled ? "bg-indigo-600" : "bg-neutral-200 dark:bg-neutral-700"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              autoMergePolicy.enabled ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                        <div>
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                            {t.admin.database.enableAutoMerge}
                          </span>
                          <p className="text-[11px] text-neutral-400">
                            {t.admin.database.enableAutoMergeDesc}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          type="button"
                          onClick={handleRunAutoMerge}
                          disabled={runningAutoMerge}
                          variant="default"
                          size="sm"
                          className="rounded-full text-xs h-8 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                        >
                          <Play className={`h-3 w-3 mr-1 ${runningAutoMerge ? "animate-spin" : ""}`} />
                          <span>{runningAutoMerge ? t.admin.database.executingAutoMerge : t.admin.database.execAutoMergeBtn}</span>
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-neutral-200/60 dark:border-neutral-800/60">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          {t.admin.database.thresholdDaysLabel}
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { label: t.admin.database.daysAgoPreset.replace("{days}", "3"), val: 3 },
                            { label: t.admin.database.daysAgoPreset.replace("{days}", "7"), val: 7 },
                            { label: t.admin.database.daysAgoPreset.replace("{days}", "14"), val: 14 },
                            { label: t.admin.database.daysAgoPreset.replace("{days}", "30"), val: 30 },
                          ].map((item) => (
                            <button
                              key={item.val}
                              type="button"
                              onClick={() => setAutoMergePolicy((prev) => ({ ...prev, daysAgo: item.val }))}
                              className={`rounded-xl py-1.5 text-xs font-medium border transition-all ${
                                autoMergePolicy.daysAgo === item.val
                                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
                                  : "bg-white border-black/[0.06] text-neutral-600 hover:bg-neutral-50 dark:bg-[#1c1c1e] dark:border-white/[0.08] dark:text-neutral-400"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                            {t.admin.database.pointsPerDayLabel}
                          </label>
                          {Boolean(autoMergePolicy.pointsPerDay) && (
                            <span className="text-[11px] text-neutral-400 font-mono">
                              {(() => {
                                const p = parseInt(String(autoMergePolicy.pointsPerDay), 10)
                                if (!p || p <= 0) return ""
                                const mins = Math.round(1440 / p)
                                if (mins >= 60) {
                                  const hours = (mins / 60).toFixed(mins % 60 === 0 ? 0 : 1)
                                  return t.admin.database.approxHoursPerPoint.replace("{hours}", hours)
                                }
                                return t.admin.database.approxMinsPerPoint.replace("{mins}", String(mins))
                              })()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {[
                            { label: t.admin.database.pointPreset.replace("{pts}", "12"), val: 12 },
                            { label: t.admin.database.pointPreset.replace("{pts}", "24"), val: 24 },
                            { label: t.admin.database.pointPreset.replace("{pts}", "48"), val: 48 },
                          ].map((item) => (
                            <button
                              key={item.val}
                              type="button"
                              onClick={() => setAutoMergePolicy((prev) => ({ ...prev, pointsPerDay: item.val }))}
                              className={`rounded-xl px-2.5 py-1.5 text-xs font-medium border transition-all ${
                                Number(autoMergePolicy.pointsPerDay) === item.val
                                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
                                  : "bg-white border-black/[0.06] text-neutral-600 hover:bg-neutral-50 dark:bg-[#1c1c1e] dark:border-white/[0.08] dark:text-neutral-400"
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                          <div className="relative flex-1">
                            <Input
                              type="number"
                              min={1}
                              max={144}
                              step={1}
                              value={autoMergePolicy.pointsPerDay || ""}
                              onChange={(e) => {
                                const raw = e.target.value
                                if (raw === "") {
                                  setAutoMergePolicy((prev) => ({ ...prev, pointsPerDay: "" as unknown as number }))
                                } else {
                                  const val = parseInt(raw, 10)
                                  if (!isNaN(val)) {
                                    setAutoMergePolicy((prev) => ({ ...prev, pointsPerDay: val }))
                                  }
                                }
                              }}
                              onBlur={() => {
                                setAutoMergePolicy((prev) => ({
                                  ...prev,
                                  pointsPerDay: Math.max(1, Math.min(144, parseInt(String(prev.pointsPerDay), 10) || 24)),
                                }))
                              }}
                              placeholder={t.admin.database.customPlaceholder}
                              className={`rounded-xl text-xs font-mono h-[30px] text-center transition-all ${
                                ![12, 24, 48].includes(Number(autoMergePolicy.pointsPerDay)) && Boolean(autoMergePolicy.pointsPerDay)
                                  ? "border-indigo-400 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-semibold"
                                  : ""
                              }`}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {autoMergePolicy.lastRunTimestamp && (
                      <div className="text-[11px] text-neutral-400 flex items-center gap-1 pt-1">
                        <Clock className="h-3 w-3" />
                        <span>{t.admin.database.lastAutoRunTime.replace("{time}", new Date(autoMergePolicy.lastRunTimestamp).toLocaleString("zh-CN"))}</span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-4 sm:p-5 dark:border-neutral-800 dark:bg-neutral-900/40 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                          {t.admin.database.manualMergeTitle}
                        </h4>
                        <p className="text-[11px] text-neutral-400">
                          {t.admin.database.manualMergeDesc}
                        </p>
                      </div>

                      <div className="inline-flex rounded-xl bg-neutral-200/70 p-0.5 dark:bg-neutral-800 shrink-0 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setMergeMode("single")}
                          className={`rounded-[10px] px-3 py-1 text-xs font-medium transition-all ${
                            mergeMode === "single"
                              ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                              : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                          }`}
                        >
                          {t.admin.database.singleDayMode}
                        </button>
                        <button
                          type="button"
                          onClick={() => setMergeMode("range")}
                          className={`rounded-[10px] px-3 py-1 text-xs font-medium transition-all ${
                            mergeMode === "range"
                              ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-neutral-100"
                              : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                          }`}
                        >
                          {t.admin.database.dateRangeMode}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      {mergeMode === "single" ? (
                        <div className="sm:col-span-5 space-y-1.5">
                          <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                            {t.admin.database.selectTargetDate}
                          </label>
                          <Input
                            type="date"
                            value={mergeDate}
                            onChange={(e) => setMergeDate(e.target.value)}
                            className="rounded-xl text-xs font-mono h-9"
                          />
                        </div>
                      ) : (
                        <div className="sm:col-span-5 space-y-1.5">
                          <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                            {t.admin.database.selectDateRange}
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={mergeStartDate}
                              onChange={(e) => setMergeStartDate(e.target.value)}
                              className="rounded-xl text-xs font-mono h-9 flex-1"
                            />
                            <span className="text-xs text-neutral-400">{t.admin.database.rangeTo}</span>
                            <Input
                              type="date"
                              value={mergeEndDate}
                              onChange={(e) => setMergeEndDate(e.target.value)}
                              className="rounded-xl text-xs font-mono h-9 flex-1"
                            />
                          </div>
                        </div>
                      )}

                      <div className="sm:col-span-4 space-y-1.5">
                        <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                          {t.admin.database.pointsPerDayN}
                        </label>
                        <div className="flex items-center gap-1.5">
                          {[12, 24, 48].map((pts) => (
                            <button
                              key={pts}
                              type="button"
                              onClick={() => setMergePointsPerDay(pts)}
                              className={`rounded-xl px-2.5 py-1.5 text-xs font-medium border transition-all ${
                                mergePointsPerDay === pts
                                  ? "bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300"
                                  : "bg-white border-black/[0.06] text-neutral-600 hover:bg-neutral-50 dark:bg-[#1c1c1e] dark:border-white/[0.08] dark:text-neutral-400"
                              }`}
                            >
                              {t.admin.database.pointsUnit.replace("{pts}", String(pts))}
                            </button>
                          ))}
                          <div className="relative flex-1">
                            <Input
                              type="number"
                              min={1}
                              max={144}
                              value={mergePointsPerDay}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10)
                                if (!isNaN(val)) setMergePointsPerDay(val)
                              }}
                              placeholder={t.admin.database.customPlaceholder}
                              className="rounded-xl text-xs font-mono h-8 text-center"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <Button
                          type="button"
                          onClick={handleManualMerge}
                          disabled={manualMerging}
                          className="w-full rounded-xl text-xs h-9 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm gap-1.5"
                        >
                          <Layers className={`h-3.5 w-3.5 ${manualMerging ? "animate-spin" : ""}`} />
                          <span>{manualMerging ? t.admin.database.executingManualMerge : t.admin.database.execManualMergeBtn}</span>
                        </Button>
                      </div>
                    </div>

                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      {t.admin.database.mergeTip}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border border-black/[0.06] bg-white p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4 dark:border-neutral-800">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400">
                        <Trash2 className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                          {t.admin.database.batchCleanTitle}
                        </h3>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500">
                          {t.admin.database.batchCleanDesc}
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={handleVacuumDb}
                      disabled={vacuuming}
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs gap-1.5 h-8 border-neutral-200 dark:border-neutral-700 shrink-0 self-start sm:self-auto"
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${vacuuming ? "animate-spin" : ""}`} />
                      <span>{vacuuming ? t.admin.database.vacuuming : t.admin.database.vacuumBtn}</span>
                    </Button>
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                      <span>{t.admin.database.presetCleanLabel}</span>
                      <span className="text-[10px] font-normal text-neutral-400">{t.admin.database.presetCleanHint}</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleDeleteBeforeDays(7)}
                        disabled={deletingBefore}
                        className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-neutral-50/70 dark:bg-neutral-900/60 p-3 text-left hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/30 dark:hover:bg-rose-950/10 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                            {t.admin.database.clean7Days}
                          </span>
                          <Trash2 className="h-3 w-3 text-neutral-300 group-hover:text-rose-500 transition-colors" />
                        </div>
                        <p className="text-[10px] text-neutral-400">{t.admin.database.clean7DaysHint}</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBeforeDays(14)}
                        disabled={deletingBefore}
                        className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-neutral-50/70 dark:bg-neutral-900/60 p-3 text-left hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/30 dark:hover:bg-rose-950/10 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                            {t.admin.database.clean14Days}
                          </span>
                          <Trash2 className="h-3 w-3 text-neutral-300 group-hover:text-rose-500 transition-colors" />
                        </div>
                        <p className="text-[10px] text-neutral-400">{t.admin.database.clean14DaysHint}</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBeforeDays(30)}
                        disabled={deletingBefore}
                        className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-neutral-50/70 dark:bg-neutral-900/60 p-3 text-left hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/30 dark:hover:bg-rose-950/10 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                            {t.admin.database.clean30Days}
                          </span>
                          <Trash2 className="h-3 w-3 text-neutral-300 group-hover:text-rose-500 transition-colors" />
                        </div>
                        <p className="text-[10px] text-neutral-400">{t.admin.database.clean30DaysHint}</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteBeforeDays(90)}
                        disabled={deletingBefore}
                        className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-neutral-50/70 dark:bg-neutral-900/60 p-3 text-left hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/30 dark:hover:bg-rose-950/10 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-rose-600 dark:group-hover:text-rose-400">
                            {t.admin.database.clean90Days}
                          </span>
                          <Trash2 className="h-3 w-3 text-neutral-300 group-hover:text-rose-500 transition-colors" />
                        </div>
                        <p className="text-[10px] text-neutral-400">{t.admin.database.clean90DaysHint}</p>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/40 p-3.5 sm:p-4 dark:border-neutral-800 dark:bg-neutral-900/40 space-y-3">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                      {t.admin.database.cutoffCleanLabel}
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="relative flex-1 max-w-[220px]">
                        <Input
                          type="date"
                          value={customDateCutoff}
                          onChange={(e) => setCustomDateCutoff(e.target.value)}
                          className="rounded-xl text-xs font-mono"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleDeleteCustomDate}
                        disabled={deletingBefore || !customDateCutoff}
                        variant="outline"
                        className="rounded-xl text-xs h-9 px-4 border-rose-200 dark:border-rose-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 self-start sm:self-auto"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        <span>{deletingBefore ? t.admin.database.cleaningBeforeDate : t.admin.database.cleanBeforeDateBtn}</span>
                      </Button>
                      <span className="text-[11px] text-neutral-400 hidden sm:inline">
                        {t.admin.database.cutoffSafeHint}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="text-xs text-neutral-400">
                      <span>{t.admin.database.dangerNotice}</span>
                    </div>

                    <Button
                      onClick={handleClearAllHistory}
                      disabled={clearing}
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs gap-1.5 h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900 shrink-0 self-start sm:self-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{clearing ? t.admin.database.clearingAll : t.admin.database.clearAllBtn}</span>
                    </Button>
                  </div>
                </div>

                <div className="rounded-3xl border border-black/[0.06] bg-white p-6 apple-card-shadow dark:border-white/[0.08] dark:bg-[#1c1c1e] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/20 dark:text-[#2997ff]">
                        <KeyRound className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                          {t.admin.database.securityCardTitle}
                        </h3>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500">
                          {t.admin.database.securityCardDesc}
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={() => setShowChangePassword(true)}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 rounded-full text-xs border-neutral-200 dark:border-neutral-700 h-9 px-4 shrink-0"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>{t.admin.changePassword}</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* 浮动未保存提示与快捷保存条 */}
      {isLoggedIn && isConfigDirty && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-neutral-900/90 dark:bg-neutral-100/95 text-white dark:text-neutral-900 pl-4 pr-2 py-1.5 shadow-2xl backdrop-blur-xl border border-white/10 dark:border-black/10">
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{t.admin.dirtyTitle}</span>
            </div>
            <Button
              onClick={handleSaveConfig}
              disabled={saving}
              size="sm"
              className="rounded-full text-xs px-4 h-8 bg-[#0066cc] hover:bg-[#0055b3] text-white dark:bg-[#2997ff] dark:hover:bg-[#147ce5] dark:text-black font-semibold shadow-sm"
            >
              {saving ? t.admin.saving : t.admin.saveAllChanges}
            </Button>
          </div>
        </div>
      )}

      {/* 修改管理员密码弹窗 */}
      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
        onSuccess={(msg) => showToast(msg)}
      />
    </div>
  )
}
