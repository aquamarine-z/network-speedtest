import { create } from 'zustand'
import { CarrierType, HistoryRecord, MeasurementResult, SchedulerConfig, NetworkQualityTier } from '@/lib/types'
import { DEFAULT_QUALITY_TIERS } from '@/lib/quality-tiers'
import { t } from '@/locales'

interface NetworkStore {
  targetNode: string
  carrierFilter: CarrierType | 'all'
  selectedProvince: string | null
  latestResult: MeasurementResult | null
  historyList: HistoryRecord[]
  schedulerConfig: SchedulerConfig | null
  qualityTiers: NetworkQualityTier[]
  isMeasuring: boolean
  isAdminLoggedIn: boolean
  error: string | null

  setCarrierFilter: (filter: CarrierType | 'all') => void
  setSelectedProvince: (province: string | null) => void
  setIsAdminLoggedIn: (status: boolean) => void
  setSchedulerConfig: (config: SchedulerConfig) => void
  setQualityTiers: (tiers: NetworkQualityTier[]) => void
  fetchLatest: () => Promise<void>
  runMeasurement: () => Promise<void>
  clearHistory: () => Promise<void>
}

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  targetNode: 'speed.cloudflare.com',
  carrierFilter: 'all',
  selectedProvince: null,
  latestResult: null,
  historyList: [],
  schedulerConfig: null,
  qualityTiers: DEFAULT_QUALITY_TIERS,
  isMeasuring: false,
  isAdminLoggedIn: false,
  error: null,

  setCarrierFilter: (filter: CarrierType | 'all') => {
    set({ carrierFilter: filter })
  },

  setSelectedProvince: (province: string | null) => {
    set({ selectedProvince: province })
  },

  setIsAdminLoggedIn: (status: boolean) => {
    set({ isAdminLoggedIn: status })
  },

  setSchedulerConfig: (config: SchedulerConfig) => {
    set({
      schedulerConfig: config,
      targetNode: config.targetNode || get().targetNode,
    })
  },

  setQualityTiers: (tiers: NetworkQualityTier[]) => {
    set({ qualityTiers: tiers })
  },

  fetchLatest: async () => {
    try {
      const res = await fetch('/api/measure')
      if (res.ok) {
        const data = await res.json()
        if (data.latest) {
          set({
            latestResult: data.latest,
            targetNode: data.target || data.latest.target || get().targetNode,
            historyList: data.history || [],
            schedulerConfig: data.config || get().schedulerConfig,
            qualityTiers: data.qualityTiers || get().qualityTiers,
          })
        } else if (data.qualityTiers) {
          set({
            targetNode: data.target || get().targetNode,
            schedulerConfig: data.config || get().schedulerConfig,
            qualityTiers: data.qualityTiers,
          })
        }
      }
    } catch (e) {
      console.error('Failed to fetch initial data:', e)
    }
  },

  runMeasurement: async () => {
    set({ isMeasuring: true, error: null })

    try {
      const res = await fetch('/api/measure', { method: 'POST' })

      if (!res.ok) {
        throw new Error(t.common.measurementFailedHttp.replace('{status}', String(res.status)))
      }

      const data = await res.json()
      set({
        latestResult: data.latest,
        targetNode: data.target || data.latest.target,
        historyList: data.history || [],
        schedulerConfig: data.config || get().schedulerConfig,
        qualityTiers: data.qualityTiers || get().qualityTiers,
        isMeasuring: false,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t.common.measurementRequestError
      set({ isMeasuring: false, error: msg })
    }
  },

  clearHistory: async () => {
    try {
      await fetch('/api/measure', { method: 'DELETE' })
      set({ historyList: [] })
    } catch (e) {
      console.error('Failed to clear history:', e)
    }
  },
}))
