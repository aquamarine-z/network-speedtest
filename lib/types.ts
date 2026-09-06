export type CarrierType = 'telecom' | 'unicom' | 'mobile' | 'edu' | 'other'

export interface ProbeLocation {
  city: string
  region: string
  country: string
  asn: number
  network: string
  latitude: number
  longitude: number
}

export interface ProbePingStats {
  min: number
  avg: number
  max: number
  loss: number
  totalPackets: number
  rcvPackets: number
}

export interface SingleProbeResult {
  id: string
  probe: ProbeLocation
  carrier: CarrierType
  carrierName: string
  stats: ProbePingStats | null
  status: 'finished' | 'failed' | 'in-progress'
  rawOutput?: string
  error?: string
}

export interface CarrierSummary {
  carrier: CarrierType
  name: string
  probeCount: number
  avgLatency: number
  avgLoss: number
  minLatency: number
  maxLatency: number
}

export interface MeasurementResult {
  id: string
  target: string
  timestamp: number
  formattedTime: string
  overallAvgLatency: number
  overallLossRate: number
  minLatency: number
  maxLatency: number
  totalProbes: number
  successfulProbes: number
  carriers: Record<CarrierType, CarrierSummary>
  probes: SingleProbeResult[]
}

export interface HistoryRecord {
  id: string
  target: string
  timestamp: number
  overallAvgLatency: number
  overallLossRate: number
  telecomAvg: number
  unicomAvg: number
  mobileAvg: number
  eduAvg?: number
  minLatency?: number
  maxLatency?: number
  probesCount: number
}

export interface SchedulerConfig {
  targetNode: string
  intervalSeconds: number
  scheduleMode: 'aligned' | 'interval'
  pingPackets: number
  lastRunTimestamp: number
  nextRunTimestamp: number
}

export type MapTimeRange = '7d' | '30d' | 'today' | 'latest'

export interface ProvinceMapStat {
  province: string
  count: number
  avgLat: number
  minLat: number
  maxLat: number
  loss: number
  lastTimestamp: number
  carriers: {
    telecom?: { count: number; avgLat: number; loss: number }
    unicom?: { count: number; avgLat: number; loss: number }
    mobile?: { count: number; avgLat: number; loss: number }
    other?: { count: number; avgLat: number; loss: number }
    [key: string]: { count: number; avgLat: number; loss: number } | undefined
  }
}

export interface MapAggregatedResponse {
  range: MapTimeRange
  totalProbes: number
  provinces: Record<string, ProvinceMapStat>
}

export interface ProvinceDailyStat {
  date: string
  displayDate: string
  avgLatency: number
  avgLoss: number
  minLatency: number
  maxLatency: number
  count: number
}

export interface DbFileSizeInfo {
  totalBytes: number
  formattedSize: string
  mainBytes: number
  walBytes: number
  shmBytes: number
}

export interface DbStats {
  targetNode: string
  totalMeasurements: number
  totalProbeRecords: number
  totalConfigs: number
  todayMeasurements: number
  todayProbeRecords: number
  oldestTimestamp: number | null
  latestTimestamp: number | null
  fileSize: DbFileSizeInfo
  retentionDaysLimit: number
}

export interface AutoMergePolicy {
  enabled: boolean
  daysAgo: number
  pointsPerDay: number
  lastRunTimestamp?: number
}

export interface MergeStatsResult {
  processedDays: number
  reducedMeasurements: number
  reducedProbes: number
  beforeMeasurements: number
  beforeProbes: number
  afterMeasurements: number
  afterProbes: number
  freedBytes: number
  newStats: DbStats
  message: string
}

export type { QualityColor, NetworkQualityTier, QualityColorTheme } from './quality-tiers'


