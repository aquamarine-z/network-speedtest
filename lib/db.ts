import { createClient } from '@libsql/client'
import fs from 'fs'
import path from 'path'
import { MeasurementResult, SingleProbeResult, HistoryRecord, MapTimeRange, ProvinceMapStat, MapAggregatedResponse, NetworkQualityTier, ProvinceDailyStat, DbStats, DbFileSizeInfo, AutoMergePolicy, MergeStatsResult, CarrierType, CarrierSummary } from './types'
export type { MapTimeRange, ProvinceMapStat, MapAggregatedResponse, NetworkQualityTier, ProvinceDailyStat, DbStats, DbFileSizeInfo, AutoMergePolicy, MergeStatsResult }
import { DEFAULT_QUALITY_TIERS } from './quality-tiers'
import { DEFAULT_GUARANTEED_HUB_CITIES, DEFAULT_ROTATION_CANDIDATES } from './city-metadata'

// 确保 data 目录存在
const dataDir = path.join(process.cwd(), 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = path.join(dataDir, 'speedtest.db')
export const db = createClient({
  url: `file:${dbPath.replace(/\\/g, '/')}`,
})

let isInitialized = false

export async function initDatabase() {
  if (isInitialized) return

  // 1. 配置表 (仅管理员可读写)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER
    )
  `)

  // 2. 测量汇总历史表 (保留 30 天内)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS measurement_logs (
      id TEXT PRIMARY KEY,
      target TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      date_day TEXT NOT NULL,
      date_month TEXT NOT NULL,
      date_year TEXT NOT NULL,
      overall_avg REAL NOT NULL,
      overall_loss REAL NOT NULL,
      min_latency REAL NOT NULL,
      max_latency REAL NOT NULL,
      successful_probes INTEGER NOT NULL,
      total_probes INTEGER NOT NULL,
      raw_json TEXT
    )
  `)

  // 3. 各地区探针明细表 (支持按省份与年月日极速查询，精简纯净指标，不存储冗余报文)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS probe_logs (
      id TEXT PRIMARY KEY,
      measurement_id TEXT NOT NULL,
      target TEXT NOT NULL,
      province TEXT NOT NULL,
      city TEXT NOT NULL,
      carrier TEXT NOT NULL,
      carrier_name TEXT NOT NULL,
      asn INTEGER,
      network TEXT,
      latency_avg REAL,
      latency_min REAL,
      latency_max REAL,
      loss REAL,
      status TEXT,
      timestamp INTEGER NOT NULL,
      date_day TEXT NOT NULL,
      date_month TEXT NOT NULL,
      date_year TEXT NOT NULL
    )
  `)

  // 动态数据迁移：永久移除 probe_logs.raw_output 报文字段并回收物理空间
  try {
    const probeCols = await db.execute("PRAGMA table_info(probe_logs)")
    const hasRawOutput = probeCols.rows.some((c: any) => c.name === "raw_output")
    if (hasRawOutput) {
      await db.execute("ALTER TABLE probe_logs DROP COLUMN raw_output")
      await db.execute("VACUUM")
    }
  } catch {
    try {
      await db.execute("UPDATE probe_logs SET raw_output = NULL WHERE raw_output IS NOT NULL")
      await db.execute("VACUUM")
    } catch {}
  }

  // 创建索引提升按地区和日期查询性能
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_probe_province ON probe_logs(province)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_probe_day ON probe_logs(date_day)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_probe_timestamp ON probe_logs(timestamp)`)
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_meas_timestamp ON measurement_logs(timestamp)`)

  // 写入默认配置（如果不存在）
  const defaultTarget = process.env.DEFAULT_TARGET_NODE || 'speed.cloudflare.com'
  await db.execute({
    sql: `INSERT OR IGNORE INTO config (key, value, updated_at) VALUES ('target_node', ?, ?)`,
    args: [defaultTarget, Date.now()],
  })
  await db.execute({
    sql: `INSERT OR IGNORE INTO config (key, value, updated_at) VALUES ('interval_seconds', '60', ?)`,
    args: [Date.now()],
  })
  await db.execute({
    sql: `INSERT OR IGNORE INTO config (key, value, updated_at) VALUES ('schedule_mode', 'aligned', ?)`,
    args: [Date.now()],
  })
  await db.execute({
    sql: `INSERT OR IGNORE INTO config (key, value, updated_at) VALUES ('ping_packets', '3', ?)`,
    args: [Date.now()],
  })
  await db.execute({
    sql: `INSERT OR IGNORE INTO config (key, value, updated_at) VALUES ('last_run_timestamp', ?, ?)`,
    args: [String(Date.now()), Date.now()],
  })
  await db.execute({
    sql: `INSERT OR IGNORE INTO config (key, value, updated_at) VALUES ('network_quality_tiers', ?, ?)`,
    args: [JSON.stringify(DEFAULT_QUALITY_TIERS), Date.now()],
  })
  await db.execute({
    sql: `INSERT OR IGNORE INTO config (key, value, updated_at) VALUES ('admin_password', ?, ?)`,
    args: [process.env.ADMIN_PASSWORD || 'admin123', Date.now()],
  })

  isInitialized = true
}

import { mapCityToProvince } from './provinces'
export { mapCityToProvince }

export interface SchedulerConfig {
  targetNode: string
  intervalSeconds: number
  scheduleMode: 'aligned' | 'interval'
  pingPackets: number
  lastRunTimestamp: number
  nextRunTimestamp: number
  activeProvider: 'globalping' | 'custom' | 'all'
  customApiUrl: string
  customApiToken: string
}

/**
 * 计算下一次自动巡检的时间戳
 */
export function calculateNextRunTimestamp(
  lastRunTimestamp: number,
  intervalSeconds: number,
  scheduleMode: 'aligned' | 'interval',
  now: number = Date.now()
): number {
  const intervalMs = Math.max(intervalSeconds, 5) * 1000

  if (scheduleMode === 'aligned') {
    // 整点/自然时钟对齐模式 (如 30 分钟: 00:00, 00:30, 01:00...)
    const currentSlotTime = Math.floor(now / intervalMs) * intervalMs
    // 检查当前整点槽位是否已经成功测速过（留出 3 秒容错缓冲区）
    if (lastRunTimestamp >= currentSlotTime - 3000) {
      // 当前槽位已经测过，目标为下一个自然整点时刻
      return currentSlotTime + intervalMs
    } else {
      // 当前槽位尚未测速，到期时间即为当前槽位起始时刻（diff <= 0，立即触发）
      return currentSlotTime
    }
  } else {
    // 滚动间隔模式：自上次成功运行时间起算整整一个周期
    return lastRunTimestamp + intervalMs
  }
}

/**
 * 获取完整调度与目标配置
 */
export async function getSchedulerConfig(): Promise<SchedulerConfig> {
  await initDatabase()
  const res = await db.execute(`SELECT key, value FROM config`)
  const map: Record<string, string> = {}
  for (const row of res.rows) {
    if (row.key && row.value !== null && row.value !== undefined) {
      map[String(row.key)] = String(row.value)
    }
  }

  const targetNode = map.target_node || process.env.DEFAULT_TARGET_NODE || 'speed.cloudflare.com'
  const intervalSeconds = Math.max(parseInt(map.interval_seconds || '60', 10) || 60, 5)
  const scheduleMode = (map.schedule_mode === 'interval' ? 'interval' : 'aligned') as 'aligned' | 'interval'
  const pingPackets = Math.min(Math.max(parseInt(map.ping_packets || '3', 10) || 3, 1), 10)
  const lastRunTimestamp = parseInt(map.last_run_timestamp || String(Date.now()), 10) || Date.now()
  const activeProvider = (map.active_provider === 'custom' || map.active_provider === 'all' ? map.active_provider : 'globalping') as 'globalping' | 'custom' | 'all'
  const customApiUrl = map.custom_api_url || process.env.CUSTOM_API_URL || ''
  const customApiToken = map.custom_api_token || process.env.CUSTOM_API_TOKEN || ''

  const nextRunTimestamp = calculateNextRunTimestamp(lastRunTimestamp, intervalSeconds, scheduleMode)

  return {
    targetNode,
    intervalSeconds,
    scheduleMode,
    pingPackets,
    lastRunTimestamp,
    nextRunTimestamp,
    activeProvider,
    customApiUrl,
    customApiToken,
  }
}

/**
 * 管理员更新调度与目标配置
 */
export async function setSchedulerConfig(partial: {
  targetNode?: string
  intervalSeconds?: number
  scheduleMode?: 'aligned' | 'interval'
  pingPackets?: number
  activeProvider?: 'globalping' | 'custom' | 'all'
  customApiUrl?: string
  customApiToken?: string
}): Promise<SchedulerConfig> {
  await initDatabase()
  const now = Date.now()

  if (partial.targetNode !== undefined) {
    const clean = partial.targetNode.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    await db.execute({
      sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('target_node', ?, ?)`,
      args: [clean, now],
    })
  }

  if (partial.intervalSeconds !== undefined) {
    const sec = Math.max(Math.floor(partial.intervalSeconds), 5)
    await db.execute({
      sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('interval_seconds', ?, ?)`,
      args: [String(sec), now],
    })
  }

  if (partial.scheduleMode !== undefined) {
    const mode = partial.scheduleMode === 'interval' ? 'interval' : 'aligned'
    await db.execute({
      sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('schedule_mode', ?, ?)`,
      args: [mode, now],
    })
  }

  if (partial.pingPackets !== undefined) {
    const packets = Math.min(Math.max(Math.floor(partial.pingPackets), 1), 10)
    await db.execute({
      sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('ping_packets', ?, ?)`,
      args: [String(packets), now],
    })
  }

  if (partial.activeProvider !== undefined) {
    const provider = partial.activeProvider === 'custom' || partial.activeProvider === 'all' ? partial.activeProvider : 'globalping'
    await db.execute({
      sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('active_provider', ?, ?)`,
      args: [provider, now],
    })
  }

  if (partial.customApiUrl !== undefined) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('custom_api_url', ?, ?)`,
      args: [partial.customApiUrl.trim(), now],
    })
  }

  if (partial.customApiToken !== undefined) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('custom_api_token', ?, ?)`,
      args: [partial.customApiToken.trim(), now],
    })
  }

  return getSchedulerConfig()
}

/**
 * 获取当前管理员密码（优先读取 SQLite 数据库，若无则读取环境变量或默认 admin123）
 */
export async function getAdminPassword(): Promise<string> {
  await initDatabase()
  const res = await db.execute(`SELECT value FROM config WHERE key = 'admin_password'`)
  if (res.rows.length > 0 && res.rows[0].value) {
    return String(res.rows[0].value)
  }
  return process.env.ADMIN_PASSWORD || 'admin123'
}

/**
 * 设置管理员新密码并持久化存储至 SQLite
 */
export async function setAdminPassword(newPassword: string): Promise<void> {
  await initDatabase()
  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('admin_password', ?, ?)`,
    args: [newPassword, Date.now()],
  })
}

/**
 * 严格清理超过 30 天（1个月）的数据
 */
export async function pruneExpiredData(): Promise<number> {
  await initDatabase()
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const cutoffTimestamp = Date.now() - THIRTY_DAYS_MS

  const r1 = await db.execute({
    sql: `DELETE FROM measurement_logs WHERE timestamp < ?`,
    args: [cutoffTimestamp],
  })

  const r2 = await db.execute({
    sql: `DELETE FROM probe_logs WHERE timestamp < ?`,
    args: [cutoffTimestamp],
  })

  return (r1.rowsAffected || 0) + (r2.rowsAffected || 0)
}

/**
 * 获取当前管理员配置的监控目标网址
 */
export async function getTargetNode(): Promise<string> {
  await initDatabase()
  const res = await db.execute(`SELECT value FROM config WHERE key = 'target_node'`)
  if (res.rows.length > 0 && res.rows[0].value) {
    return String(res.rows[0].value)
  }
  return process.env.DEFAULT_TARGET_NODE || 'speed.cloudflare.com'
}

/**
 * 管理员更新监控目标网址
 */
export async function setTargetNode(target: string): Promise<void> {
  await initDatabase()
  const clean = target.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('target_node', ?, ?)`,
    args: [clean, Date.now()],
  })
}

/**
 * 更新最后一次测速完成时间
 */
export async function updateLastRunTimestamp(ts: number = Date.now()): Promise<void> {
  await initDatabase()
  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('last_run_timestamp', ?, ?)`,
    args: [String(ts), ts],
  })
}

/**
 * 保存完整的测量结果并写入数据库（自动执行 30 天清理）
 */
export async function saveMeasurementToDb(result: MeasurementResult): Promise<void> {
  if (!result || !result.probes || result.probes.length === 0 || result.successfulProbes === 0) {
    return
  }
  await initDatabase()

  const dateObj = new Date(result.timestamp)
  const dateYear = String(dateObj.getFullYear())
  const dateMonth = `${dateYear}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
  const dateDay = `${dateMonth}-${String(dateObj.getDate()).padStart(2, '0')}`
  const createdAt = dateObj.toISOString()

  // 清理探测结果中的报文字段，杜绝在总表 raw_json 中存储冗余报文
  const cleanResult = {
    ...result,
    probes: result.probes.map(({ rawOutput, ...rest }) => rest),
  }

  // 1. 插入总表
  await db.execute({
    sql: `INSERT INTO measurement_logs (
      id, target, timestamp, created_at, date_day, date_month, date_year,
      overall_avg, overall_loss, min_latency, max_latency,
      successful_probes, total_probes, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      result.id,
      result.target,
      result.timestamp,
      createdAt,
      dateDay,
      dateMonth,
      dateYear,
      result.overallAvgLatency,
      result.overallLossRate,
      result.minLatency,
      result.maxLatency,
      result.successfulProbes,
      result.totalProbes,
      JSON.stringify(cleanResult),
    ],
  })

  // 2. 插入各探针明细（纯净指标，不持久化任何报文字段）
  for (const p of result.probes) {
    const province = mapCityToProvince(p.probe.city)
    const probeLogId = `${result.id}-${p.id}`
    await db.execute({
      sql: `INSERT INTO probe_logs (
        id, measurement_id, target, province, city, carrier, carrier_name,
        asn, network, latency_avg, latency_min, latency_max, loss,
        status, timestamp, date_day, date_month, date_year
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        probeLogId,
        result.id,
        result.target,
        province,
        p.probe.city,
        p.carrier,
        p.carrierName,
        p.probe.asn,
        p.probe.network,
        p.stats?.avg ?? null,
        p.stats?.min ?? null,
        p.stats?.max ?? null,
        p.stats?.loss ?? 0,
        p.status,
        result.timestamp,
        dateDay,
        dateMonth,
        dateYear,
      ],
    })
  }

  // 3. 自动执行 30 天自动清理
  await pruneExpiredData()
}

/**
 * 获取最新一次测量结果
 */
export async function getLatestMeasurementFromDb(): Promise<MeasurementResult | null> {
  await initDatabase()
  const res = await db.execute(`
    SELECT raw_json FROM measurement_logs ORDER BY timestamp DESC LIMIT 1
  `)
  if (res.rows.length > 0 && res.rows[0].raw_json) {
    try {
      return JSON.parse(String(res.rows[0].raw_json)) as MeasurementResult
    } catch {
      return null
    }
  }
  return null
}

export interface ProvinceHistoryResult {
  records: any[]
  isYesterday: boolean
  timeWindowLabel: string
}

/**
 * 获取某个省份的历史记录，默认获取近 24 小时内数据，若无数据则自动回退取昨天数据
 */
export async function getProvinceHistory(province: string, dateDay?: string): Promise<ProvinceHistoryResult> {
  await initDatabase()
  const cleanProv = province.replace(/(省|市|自治区|特别行政区)/, '')

  // 如果明确指定了某一特定日期（保留兼容性）
  if (dateDay && dateDay !== '24h' && dateDay !== 'today') {
    const res = await db.execute({
      sql: `SELECT * FROM probe_logs WHERE (province = ? OR province LIKE ?) AND date_day = ? ORDER BY timestamp DESC LIMIT 200`,
      args: [province, `%${cleanProv}%`, dateDay],
    })
    return {
      records: res.rows,
      isYesterday: false,
      timeWindowLabel: dateDay,
    }
  }

  const now = Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000
  const last24hStart = now - oneDayMs

  // 1. 优先获取近 24 小时内的数据
  const res24h = await db.execute({
    sql: `SELECT * FROM probe_logs WHERE (province = ? OR province LIKE ?) AND timestamp >= ? ORDER BY timestamp DESC LIMIT 200`,
    args: [province, `%${cleanProv}%`, last24hStart],
  })

  if (res24h.rows && res24h.rows.length > 0) {
    return {
      records: res24h.rows,
      isYesterday: false,
      timeWindowLabel: '近 24 小时',
    }
  }

  // 2. 如果近 24 小时内无数据，回退取昨天的数据
  const yesterdayObj = new Date(now - oneDayMs)
  const yYear = yesterdayObj.getFullYear()
  const yMonth = String(yesterdayObj.getMonth() + 1).padStart(2, '0')
  const yDay = String(yesterdayObj.getDate()).padStart(2, '0')
  const yesterdayStr = `${yYear}-${yMonth}-${yDay}`

  const resYesterday = await db.execute({
    sql: `SELECT * FROM probe_logs WHERE (province = ? OR province LIKE ?) AND (date_day = ? OR (timestamp >= ? AND timestamp < ?)) ORDER BY timestamp DESC LIMIT 200`,
    args: [province, `%${cleanProv}%`, yesterdayStr, now - 2 * oneDayMs, last24hStart],
  })

  if (resYesterday.rows && resYesterday.rows.length > 0) {
    return {
      records: resYesterday.rows,
      isYesterday: true,
      timeWindowLabel: `昨日数据 (${yesterdayStr})`,
    }
  }

  // 3. 兜底：如果昨天也没有数据，取该省份最近存在的最新一批记录
  const resFallback = await db.execute({
    sql: `SELECT * FROM probe_logs WHERE (province = ? OR province LIKE ?) ORDER BY timestamp DESC LIMIT 100`,
    args: [province, `%${cleanProv}%`],
  })

  const latestDateDay = resFallback.rows.length > 0 ? String(resFallback.rows[0].date_day || '') : ''

  return {
    records: resFallback.rows,
    isYesterday: true,
    timeWindowLabel: latestDateDay ? `历史数据 (${latestDateDay})` : '暂无数据',
  }
}

/**
 * 获取数据库中某个省份存在记录的年月日列表（用于前端日期选择器）
 */
export async function getProvinceDates(province: string): Promise<string[]> {
  await initDatabase()
  const res = await db.execute({
    sql: `
      SELECT DISTINCT date_day FROM probe_logs 
      WHERE (province = ? OR province LIKE ?)
      ORDER BY date_day DESC LIMIT 30
    `,
    args: [province, `%${province.replace(/(省|市|自治区|特别行政区)/, '')}%`],
  })
  return res.rows.map((r) => String(r.date_day))
}

/**
 * 获取某个省份在连续 N 天内的日均聚合时延数据（用于 7日平均 / 30日平均走势图）
 * 严格返回指定数量的连续日历日序列，确保 7日刚好 7 个点，30日刚好 30 个点
 */
export async function getProvinceDailyStats(province: string, days: number = 30): Promise<ProvinceDailyStat[]> {
  await initDatabase()
  const cleanProv = province.replace(/(省|市|自治区|特别行政区)/, '')

  // 1. 查询数据库中该省份实际有的每日均值数据（按日期倒序最多获取 days 天）
  const res = await db.execute({
    sql: `
      SELECT 
        date_day,
        AVG(latency_avg) as avg_lat,
        AVG(loss) as avg_loss,
        MIN(CASE WHEN latency_min IS NOT NULL AND latency_min > 0 THEN latency_min ELSE latency_avg END) as min_lat,
        MAX(CASE WHEN latency_max IS NOT NULL AND latency_max > 0 THEN latency_max ELSE latency_avg END) as max_lat,
        COUNT(*) as cnt
      FROM probe_logs
      WHERE (province = ? OR province LIKE ?) AND latency_avg > 0
      GROUP BY date_day
      ORDER BY date_day DESC
      LIMIT ?
    `,
    args: [province, `%${cleanProv}%`, days],
  })

  // 2. 仅保留真实存在的历史天数，不满 7 天或 30 天绝不伪造，按时间正序排列（左旧右新）
  const result: ProvinceDailyStat[] = []
  for (const row of res.rows) {
    const date = String(row.date_day)
    const parts = date.split('-')
    const displayDate = parts.length === 3 ? `${parts[1]}/${parts[2]}` : date
    const avgLatency = row.avg_lat !== null ? Math.round(Number(row.avg_lat) * 10) / 10 : 0
    const avgLoss = row.avg_loss !== null ? Math.round(Number(row.avg_loss) * 10) / 10 : 0
    const minLatency = row.min_lat !== null ? Math.round(Number(row.min_lat) * 10) / 10 : avgLatency
    const maxLatency = row.max_lat !== null ? Math.round(Number(row.max_lat) * 10) / 10 : avgLatency
    const count = Number(row.cnt) || 0

    result.push({
      date,
      displayDate,
      avgLatency,
      avgLoss,
      minLatency,
      maxLatency,
      count,
    })
  }

  // 翻转为时间升序（最旧在左，最新在右）
  return result.reverse()
}

/**
 * 格式化字节数大小为可读字符串 (B, KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

/**
 * 获取 SQLite 数据库文件及相关日志在磁盘上的实际大小
 */
export function getDatabaseFileSize(): DbFileSizeInfo {
  let mainBytes = 0
  let walBytes = 0
  let shmBytes = 0

  try {
    if (fs.existsSync(dbPath)) {
      mainBytes = fs.statSync(dbPath).size
    }
    const walPath = `${dbPath}-wal`
    if (fs.existsSync(walPath)) {
      walBytes = fs.statSync(walPath).size
    }
    const shmPath = `${dbPath}-shm`
    if (fs.existsSync(shmPath)) {
      shmBytes = fs.statSync(shmPath).size
    }
  } catch (e) {
    console.error('Failed to read db file size:', e)
  }

  const totalBytes = mainBytes + walBytes + shmBytes
  return {
    totalBytes,
    formattedSize: formatBytes(totalBytes),
    mainBytes,
    walBytes,
    shmBytes,
  }
}

/**
 * 获取数据库统计指标（数据量统计与物理磁盘空间）
 */
export async function getDbStats(): Promise<DbStats> {
  await initDatabase()
  const measCount = await db.execute(`SELECT COUNT(*) as count FROM measurement_logs`)
  const probeCount = await db.execute(`SELECT COUNT(*) as count FROM probe_logs`)
  const configCount = await db.execute(`SELECT COUNT(*) as count FROM config`)
  const oldest = await db.execute(`SELECT MIN(timestamp) as min_ts FROM measurement_logs`)
  const newest = await db.execute(`SELECT MAX(timestamp) as max_ts FROM measurement_logs`)

  // 今日新增巡检与探针数据
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayMeas = await db.execute({
    sql: `SELECT COUNT(*) as count FROM measurement_logs WHERE date_day = ?`,
    args: [todayStr],
  })
  const todayProbes = await db.execute({
    sql: `SELECT COUNT(*) as count FROM probe_logs WHERE date_day = ?`,
    args: [todayStr],
  })

  const target = await getTargetNode()
  const fileSize = getDatabaseFileSize()

  return {
    targetNode: target,
    totalMeasurements: Number(measCount.rows[0].count),
    totalProbeRecords: Number(probeCount.rows[0].count),
    totalConfigs: Number(configCount.rows[0].count),
    todayMeasurements: Number(todayMeas.rows[0].count),
    todayProbeRecords: Number(todayProbes.rows[0].count),
    oldestTimestamp: oldest.rows[0].min_ts ? Number(oldest.rows[0].min_ts) : null,
    latestTimestamp: newest.rows[0].max_ts ? Number(newest.rows[0].max_ts) : null,
    fileSize,
    retentionDaysLimit: 30,
  }
}

/**
 * 批量删除指定时间戳以前的旧数据，并立即执行 VACUUM 释放物理磁盘空间
 */
export async function deleteDataBefore(cutoffTimestamp: number): Promise<{
  deletedMeasurements: number
  deletedProbes: number
  totalDeleted: number
  freedBytes: number
  newStats: DbStats
}> {
  await initDatabase()
  const beforeSize = getDatabaseFileSize().totalBytes

  const r1 = await db.execute({
    sql: `DELETE FROM measurement_logs WHERE timestamp < ?`,
    args: [cutoffTimestamp],
  })

  const r2 = await db.execute({
    sql: `DELETE FROM probe_logs WHERE timestamp < ?`,
    args: [cutoffTimestamp],
  })

  const deletedMeasurements = r1.rowsAffected || 0
  const deletedProbes = r2.rowsAffected || 0

  try {
    await db.execute(`VACUUM`)
  } catch (e) {
    console.error('Failed to VACUUM:', e)
  }

  const afterSize = getDatabaseFileSize().totalBytes
  const freedBytes = Math.max(0, beforeSize - afterSize)
  const newStats = await getDbStats()

  return {
    deletedMeasurements,
    deletedProbes,
    totalDeleted: deletedMeasurements + deletedProbes,
    freedBytes,
    newStats,
  }
}

/**
 * 手动对数据库执行 VACUUM 碎片整理与物理空间回收
 */
export async function vacuumDatabase(): Promise<{ freedBytes: number; newStats: DbStats }> {
  await initDatabase()
  const beforeSize = getDatabaseFileSize().totalBytes
  try {
    await db.execute(`VACUUM`)
  } catch (e) {
    console.error('Failed to VACUUM:', e)
  }
  const afterSize = getDatabaseFileSize().totalBytes
  const freedBytes = Math.max(0, beforeSize - afterSize)
  const newStats = await getDbStats()
  return { freedBytes, newStats }
}

/**
 * 获取最近巡检历史记录（用于走势图表）
 */
export async function getRecentHistory(limit: number = 30): Promise<HistoryRecord[]> {
  await initDatabase()
  const res = await db.execute({
    sql: `SELECT id, target, timestamp, overall_avg, overall_loss, min_latency, max_latency, successful_probes as probesCount, raw_json FROM measurement_logs WHERE successful_probes > 0 ORDER BY timestamp DESC LIMIT ?`,
    args: [limit],
  })

  return res.rows.map((r) => {
    let telecomAvg = 0
    let unicomAvg = 0
    let mobileAvg = 0
    let eduAvg = 0
    let minLatency = r.min_latency !== null && r.min_latency !== undefined ? Number(r.min_latency) : undefined
    let maxLatency = r.max_latency !== null && r.max_latency !== undefined ? Number(r.max_latency) : undefined

    try {
      if (r.raw_json) {
        const parsed = JSON.parse(String(r.raw_json))
        telecomAvg = parsed.carriers?.telecom?.avgLatency || 0
        unicomAvg = parsed.carriers?.unicom?.avgLatency || 0
        mobileAvg = parsed.carriers?.mobile?.avgLatency || 0
        eduAvg = parsed.carriers?.edu?.avgLatency || 0
        if (minLatency === undefined && parsed.minLatency !== undefined) {
          minLatency = parsed.minLatency
        }
        if (maxLatency === undefined && parsed.maxLatency !== undefined) {
          maxLatency = parsed.maxLatency
        }
      }
    } catch {}

    return {
      id: String(r.id),
      target: String(r.target),
      timestamp: Number(r.timestamp),
      overallAvgLatency: Number(r.overall_avg),
      overallLossRate: Number(r.overall_loss),
      minLatency,
      maxLatency,
      telecomAvg,
      unicomAvg,
      mobileAvg,
      eduAvg: eduAvg > 0 ? eduAvg : undefined,
      probesCount: Number(r.probesCount || 0),
    }
  })
}

/**
 * 清空历史记录
 */
export async function clearAllHistory(): Promise<void> {
  await initDatabase()
  await db.execute(`DELETE FROM measurement_logs`)
  await db.execute(`DELETE FROM probe_logs`)
}

/**
 * 获取当前轮询周期已使用的城市列表
 */
export async function getRotationUsedCities(): Promise<string[]> {
  await initDatabase()
  const res = await db.execute({
    sql: `SELECT value FROM config WHERE key = 'rotation_used_cities'`,
    args: [],
  })
  if (res.rows.length > 0 && res.rows[0].value) {
    try {
      const parsed = JSON.parse(String(res.rows[0].value))
      if (Array.isArray(parsed)) {
        return parsed.map(String)
      }
    } catch {}
  }
  return []
}

/**
 * 保存当前轮询周期已使用的城市列表
 */
export async function saveRotationUsedCities(cities: string[]): Promise<void> {
  await initDatabase()
  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('rotation_used_cities', ?, ?)`,
    args: [JSON.stringify(cities), Date.now()],
  })
}

export interface CityDispatchConfig {
  guaranteedHubs: string[]
  rotatingCandidates: string[]
  rotationBatchSize: number
  usedCitiesInCycle: string[]
  enableGeneralPool: boolean
}

/**
 * 获取城市调度策略配置（保底城市、轮换候选池、批次大小与当前周期使用状态）
 */
export async function getCityDispatchConfig(): Promise<CityDispatchConfig> {
  await initDatabase()
  const res = await db.execute(`
    SELECT key, value FROM config 
    WHERE key IN ('guaranteed_hubs', 'rotating_candidates', 'rotation_batch_size', 'rotation_used_cities', 'enable_general_pool')
  `)
  const map: Record<string, string> = {}
  for (const row of res.rows) {
    if (row.key && row.value !== null) {
      map[String(row.key)] = String(row.value)
    }
  }

  let guaranteedHubs = DEFAULT_GUARANTEED_HUB_CITIES
  if (map.guaranteed_hubs) {
    try {
      const parsed = JSON.parse(map.guaranteed_hubs)
      if (Array.isArray(parsed) && parsed.length > 0) guaranteedHubs = parsed.map(String)
    } catch {}
  }

  let rotatingCandidates = DEFAULT_ROTATION_CANDIDATES
  if (map.rotating_candidates) {
    try {
      const parsed = JSON.parse(map.rotating_candidates)
      if (Array.isArray(parsed)) rotatingCandidates = parsed.map(String)
    } catch {}
  }

  const rotationBatchSize = Math.max(parseInt(map.rotation_batch_size || '16', 10) || 16, 1)

  let usedCitiesInCycle: string[] = []
  if (map.rotation_used_cities) {
    try {
      const parsed = JSON.parse(map.rotation_used_cities)
      if (Array.isArray(parsed)) usedCitiesInCycle = parsed.map(String)
    } catch {}
  }

  const enableGeneralPool = map.enable_general_pool === 'true'

  return {
    guaranteedHubs,
    rotatingCandidates,
    rotationBatchSize,
    usedCitiesInCycle,
    enableGeneralPool,
  }
}

/**
 * 保存城市调度策略配置
 */
export async function setCityDispatchConfig(config: {
  guaranteedHubs?: string[]
  rotatingCandidates?: string[]
  rotationBatchSize?: number
  enableGeneralPool?: boolean
}): Promise<void> {
  await initDatabase()
  const now = Date.now()

  if (config.guaranteedHubs !== undefined) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('guaranteed_hubs', ?, ?)`,
      args: [JSON.stringify(config.guaranteedHubs), now],
    })
  }

  if (config.rotatingCandidates !== undefined) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('rotating_candidates', ?, ?)`,
      args: [JSON.stringify(config.rotatingCandidates), now],
    })
  }

  if (config.rotationBatchSize !== undefined) {
    const size = Math.max(Math.floor(config.rotationBatchSize), 1)
    await db.execute({
      sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('rotation_batch_size', ?, ?)`,
      args: [String(size), now],
    })
  }

  if (config.enableGeneralPool !== undefined) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('enable_general_pool', ?, ?)`,
      args: [config.enableGeneralPool ? 'true' : 'false', now],
    })
  }
}

/**
 * 重置当前轮换周期（清空已选记忆，让下一次从全新轮换开始）
 */
export async function resetRotationCycle(): Promise<void> {
  await initDatabase()
  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('rotation_used_cities', '[]', ?)`,
    args: [Date.now()],
  })
}

/**
 * 恢复城市调度策略为官方推荐默认配置
 */
export async function resetCityDispatchToDefaults(): Promise<void> {
  await initDatabase()
  const now = Date.now()
  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('guaranteed_hubs', ?, ?)`,
    args: [JSON.stringify(DEFAULT_GUARANTEED_HUB_CITIES), now],
  })
  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('rotating_candidates', ?, ?)`,
    args: [JSON.stringify(DEFAULT_ROTATION_CANDIDATES), now],
  })
  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('rotation_batch_size', '16', ?)`,
    args: [now],
  })
  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('rotation_used_cities', '[]', ?)`,
    args: [now],
  })
  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('enable_general_pool', 'false', ?)`,
    args: [now],
  })
}

/**
 * 获取大屏地图聚合统计数据（支持 7日平均 / 30日平均 / 当日平均 / 上一次快照）
 */
export async function getMapAggregatedStats(range: MapTimeRange = '7d'): Promise<MapAggregatedResponse> {
  await initDatabase()

  let sql = ''
  const args: (string | number)[] = []

  if (range === 'latest') {
    const latestMeas = await db.execute(`SELECT id FROM measurement_logs ORDER BY timestamp DESC LIMIT 1`)
    if (latestMeas.rows.length === 0 || !latestMeas.rows[0].id) {
      return { range, totalProbes: 0, provinces: {} }
    }
    const latestId = String(latestMeas.rows[0].id)
    sql = `
      SELECT 
        province,
        carrier,
        COUNT(*) as cnt,
        AVG(latency_avg) as avg_lat,
        MIN(CASE WHEN latency_min IS NOT NULL THEN latency_min ELSE latency_avg END) as min_lat,
        MAX(CASE WHEN latency_max IS NOT NULL THEN latency_max ELSE latency_avg END) as max_lat,
        AVG(loss) as avg_loss,
        MAX(timestamp) as last_ts
      FROM probe_logs
      WHERE measurement_id = ?
      GROUP BY province, carrier
    `
    args.push(latestId)
  } else {
    let cutoff = 0
    if (range === 'today') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      cutoff = today.getTime()
    } else if (range === '30d') {
      cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    } else {
      // 默认 7d
      cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    }

    sql = `
      SELECT 
        province,
        carrier,
        COUNT(*) as cnt,
        AVG(latency_avg) as avg_lat,
        MIN(CASE WHEN latency_min IS NOT NULL THEN latency_min ELSE latency_avg END) as min_lat,
        MAX(CASE WHEN latency_max IS NOT NULL THEN latency_max ELSE latency_avg END) as max_lat,
        AVG(loss) as avg_loss,
        MAX(timestamp) as last_ts
      FROM probe_logs
      WHERE timestamp >= ?
      GROUP BY province, carrier
    `
    args.push(cutoff)
  }

  const res = await db.execute({ sql, args })
  const provinces: Record<string, ProvinceMapStat> = {}
  let totalProbes = 0

  for (const row of res.rows) {
    const prov = String(row.province || '')
    if (!prov || prov === '其他') continue

    const carrier = String(row.carrier || 'other')
    const cnt = Number(row.cnt) || 0
    const avgLat = row.avg_lat !== null ? Number(row.avg_lat) : 0
    const minLat = row.min_lat !== null ? Number(row.min_lat) : avgLat
    const maxLat = row.max_lat !== null ? Number(row.max_lat) : avgLat
    const avgLoss = row.avg_loss !== null ? Number(row.avg_loss) : 0
    const lastTs = Number(row.last_ts) || 0

    if (!provinces[prov]) {
      provinces[prov] = {
        province: prov,
        count: 0,
        avgLat: 0,
        minLat: 999999,
        maxLat: 0,
        loss: 0,
        lastTimestamp: 0,
        carriers: {},
      }
    }

    const p = provinces[prov]
    const newCount = p.count + cnt
    p.avgLat = Math.round(((p.avgLat * p.count) + (avgLat * cnt)) / newCount * 10) / 10
    p.loss = Math.round(((p.loss * p.count) + (avgLoss * cnt)) / newCount * 10) / 10
    p.minLat = Math.min(p.minLat, Math.round(minLat * 10) / 10)
    p.maxLat = Math.max(p.maxLat, Math.round(maxLat * 10) / 10)
    p.lastTimestamp = Math.max(p.lastTimestamp, lastTs)
    p.count = newCount

    p.carriers[carrier] = {
      count: cnt,
      avgLat: Math.round(avgLat * 10) / 10,
      loss: Math.round(avgLoss * 10) / 10,
    }

    totalProbes += cnt
  }

  // 清理 minLat 初始哨兵值
  for (const p of Object.values(provinces)) {
    if (p.minLat === 999999) p.minLat = p.avgLat
  }

  return {
    range,
    totalProbes,
    provinces,
  }
}

/**
 * 获取全局网络质量档位配置（若数据库未配置则回退官方默认）
 */
export async function getQualityTiers(): Promise<NetworkQualityTier[]> {
  await initDatabase()
  const res = await db.execute(`SELECT value FROM config WHERE key = 'network_quality_tiers'`)
  if (res.rows.length > 0 && res.rows[0].value) {
    try {
      const parsed = JSON.parse(String(res.rows[0].value))
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as NetworkQualityTier[]
      }
    } catch {}
  }
  return DEFAULT_QUALITY_TIERS
}

/**
 * 保存全局网络质量档位配置
 */
export async function setQualityTiers(tiers: NetworkQualityTier[]): Promise<void> {
  await initDatabase()
  if (!Array.isArray(tiers) || tiers.length === 0) return
  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('network_quality_tiers', ?, ?)`,
    args: [JSON.stringify(tiers), Date.now()],
  })
}

/**
 * 恢复网络质量档位为官方推荐默认标准
 */
export async function resetQualityTiersToDefault(): Promise<void> {
  await initDatabase()
  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('network_quality_tiers', ?, ?)`,
    args: [JSON.stringify(DEFAULT_QUALITY_TIERS), Date.now()],
  })
}

/**
 * 获取每日历史数据自动合并与降采样策略
 */
export async function getAutoMergePolicy(): Promise<AutoMergePolicy> {
  await initDatabase()
  const res = await db.execute(`SELECT value FROM config WHERE key = 'auto_merge_policy'`)
  if (res.rows.length > 0 && res.rows[0].value) {
    try {
      const parsed = JSON.parse(String(res.rows[0].value))
      return {
        enabled: Boolean(parsed.enabled),
        daysAgo: Math.max(1, Number(parsed.daysAgo) || 7),
        pointsPerDay: Math.max(1, Math.min(144, Number(parsed.pointsPerDay) || 24)),
        lastRunTimestamp: parsed.lastRunTimestamp ? Number(parsed.lastRunTimestamp) : undefined,
      }
    } catch {}
  }
  return {
    enabled: false,
    daysAgo: 7,
    pointsPerDay: 24,
  }
}

/**
 * 保存每日历史数据自动合并与降采样策略
 */
export async function setAutoMergePolicy(policy: Partial<AutoMergePolicy>): Promise<AutoMergePolicy> {
  await initDatabase()
  const current = await getAutoMergePolicy()
  const updated: AutoMergePolicy = {
    enabled: policy.enabled !== undefined ? Boolean(policy.enabled) : current.enabled,
    daysAgo: policy.daysAgo !== undefined ? Math.max(1, Number(policy.daysAgo)) : current.daysAgo,
    pointsPerDay: policy.pointsPerDay !== undefined ? Math.max(1, Math.min(144, Number(policy.pointsPerDay))) : current.pointsPerDay,
    lastRunTimestamp: policy.lastRunTimestamp !== undefined ? Number(policy.lastRunTimestamp) : current.lastRunTimestamp,
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO config (key, value, updated_at) VALUES ('auto_merge_policy', ?, ?)`,
    args: [JSON.stringify(updated), Date.now()],
  })

  return updated
}

export interface MergeHistoryOptions {
  dateDay?: string
  startDate?: string
  endDate?: string
  pointsPerDay?: number
}

/**
 * 将指定某日或某日期范围内的历史数据按 N 个等分时间点进行均值合并降采样
 * 并对 SQLite 数据库执行 VACUUM 释放物理磁盘空间
 */
export async function mergeHistoryData(options: MergeHistoryOptions): Promise<MergeStatsResult> {
  await initDatabase()

  // 1. 收集需要处理的日期列表 (YYYY-MM-DD)
  let targetDays: string[] = []

  if (options.dateDay && options.dateDay.trim()) {
    targetDays = [options.dateDay.trim()]
  } else if (options.startDate && options.endDate) {
    const sStr = options.startDate.trim()
    const eStr = options.endDate.trim()
    const sDate = new Date(`${sStr}T00:00:00`)
    const eDate = new Date(`${eStr}T00:00:00`)
    if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || sDate.getTime() > eDate.getTime()) {
      throw new Error('无效的日期范围，开始日期不能大于结束日期')
    }
    const daysSet = new Set<string>()
    const cur = new Date(sDate.getTime())
    while (cur.getTime() <= eDate.getTime()) {
      const dStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
      daysSet.add(dStr)
      cur.setDate(cur.getDate() + 1)
    }
    targetDays = Array.from(daysSet).sort()
  } else {
    // 默认获取数据库中所有的测量日期
    const distinctRes = await db.execute(`SELECT DISTINCT date_day FROM measurement_logs ORDER BY date_day ASC`)
    targetDays = distinctRes.rows.map(r => String(r.date_day))
  }

  if (targetDays.length === 0) {
    const currentStats = await getDbStats()
    return {
      processedDays: 0,
      reducedMeasurements: 0,
      reducedProbes: 0,
      beforeMeasurements: currentStats.totalMeasurements,
      beforeProbes: currentStats.totalProbeRecords,
      afterMeasurements: currentStats.totalMeasurements,
      afterProbes: currentStats.totalProbeRecords,
      freedBytes: 0,
      newStats: currentStats,
      message: '未找到符合条件的日期数据需要合并',
    }
  }

  const beforeStats = await getDbStats()
  const beforeMeasurements = beforeStats.totalMeasurements
  const beforeProbes = beforeStats.totalProbeRecords
  const beforeBytes = beforeStats.fileSize.totalBytes

  const pointsPerDay = Math.max(1, Math.min(144, options.pointsPerDay || 24))
  const dayDuration = 24 * 60 * 60 * 1000
  const bucketMs = dayDuration / pointsPerDay

  let actualProcessedDays = 0

  for (const dayStr of targetDays) {
    const parts = dayStr.split('-').map(Number)
    if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) continue

    const dayStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0).getTime()
    const dateMonth = `${parts[0]}-${String(parts[1]).padStart(2, '0')}`
    const dateYear = String(parts[0])

    let dayHadMerge = false

    for (let k = 0; k < pointsPerDay; k++) {
      const tStart = dayStart + k * bucketMs
      const tEnd = dayStart + (k + 1) * bucketMs

      // 查询该时间桶内的测量记录
      const measRes = await db.execute({
        sql: `SELECT * FROM measurement_logs WHERE timestamp >= ? AND timestamp < ? ORDER BY timestamp ASC`,
        args: [tStart, tEnd],
      })

      // 若桶内只有 0 或 1 条记录，说明已在 1 个点范围内，无需合并
      if (measRes.rows.length <= 1) {
        continue
      }

      dayHadMerge = true
      const rows = measRes.rows
      const n = rows.length
      const midTs = Math.round(tStart + bucketMs / 2)
      const target = String(rows[0].target || 'speed.cloudflare.com')

      const overallAvg = Math.round((rows.reduce((sum, r) => sum + Number(r.overall_avg || 0), 0) / n) * 10) / 10
      const overallLoss = Math.round((rows.reduce((sum, r) => sum + Number(r.overall_loss || 0), 0) / n) * 10) / 10
      const minLat = Math.min(...rows.map(r => (r.min_latency !== null && r.min_latency !== undefined ? Number(r.min_latency) : 999999)))
      const maxLat = Math.max(...rows.map(r => (r.max_latency !== null && r.max_latency !== undefined ? Number(r.max_latency) : 0)))
      const successfulProbes = Math.round(rows.reduce((sum, r) => sum + Number(r.successful_probes || 0), 0) / n)
      const totalProbes = Math.round(rows.reduce((sum, r) => sum + Number(r.total_probes || 0), 0) / n)
      const newMeasId = `rollup-${dayStr}-b${k}-${midTs}`

      // 查询并聚合桶内的探针明细（按省份、城市、运营商分组计算均值与极值）
      const probeRes = await db.execute({
        sql: `
          SELECT 
            province,
            city,
            carrier,
            carrier_name,
            asn,
            network,
            AVG(latency_avg) as avg_lat,
            MIN(CASE WHEN latency_min IS NOT NULL AND latency_min > 0 THEN latency_min ELSE latency_avg END) as min_lat,
            MAX(CASE WHEN latency_max IS NOT NULL AND latency_max > 0 THEN latency_max ELSE latency_avg END) as max_lat,
            AVG(loss) as avg_loss,
            COUNT(*) as sample_count
          FROM probe_logs
          WHERE timestamp >= ? AND timestamp < ?
          GROUP BY province, city, carrier
        `,
        args: [tStart, tEnd],
      })

      // 构建 carriers 汇总及 syntheticProbes 用于 raw_json
      const carrierMap: Record<string, { probeCount: number; sumLat: number; sumLoss: number; minLat: number; maxLat: number; name: string }> = {}
      const syntheticProbes: SingleProbeResult[] = []

      for (const p of probeRes.rows) {
        const c = (String(p.carrier || 'other')) as CarrierType
        const cName = String(p.carrier_name || c)
        const avgLat = p.avg_lat !== null ? Math.round(Number(p.avg_lat) * 10) / 10 : 0
        const pMin = p.min_lat !== null ? Math.round(Number(p.min_lat) * 10) / 10 : avgLat
        const pMax = p.max_lat !== null ? Math.round(Number(p.max_lat) * 10) / 10 : avgLat
        const loss = p.avg_loss !== null ? Math.round(Number(p.avg_loss) * 10) / 10 : 0
        const prov = String(p.province || '')
        const city = String(p.city || '')

        if (!carrierMap[c]) {
          carrierMap[c] = { probeCount: 0, sumLat: 0, sumLoss: 0, minLat: 999999, maxLat: 0, name: cName }
        }
        carrierMap[c].probeCount += 1
        carrierMap[c].sumLat += avgLat
        carrierMap[c].sumLoss += loss
        carrierMap[c].minLat = Math.min(carrierMap[c].minLat, pMin)
        carrierMap[c].maxLat = Math.max(carrierMap[c].maxLat, pMax)

        syntheticProbes.push({
          id: `probe-${c}-${prov}-${city}`,
          probe: {
            city,
            region: prov,
            country: 'CN',
            asn: Number(p.asn || 0),
            network: String(p.network || ''),
            latitude: 0,
            longitude: 0,
          },
          carrier: c,
          carrierName: cName,
          stats: {
            avg: avgLat,
            min: pMin,
            max: pMax,
            loss,
            totalPackets: 3,
            rcvPackets: loss >= 100 ? 0 : 3,
          },
          status: 'finished',
        })
      }

      const carriers: Record<CarrierType, CarrierSummary> = {
        telecom: { carrier: 'telecom', name: '中国电信', probeCount: 0, avgLatency: 0, avgLoss: 0, minLatency: 0, maxLatency: 0 },
        unicom: { carrier: 'unicom', name: '中国联通', probeCount: 0, avgLatency: 0, avgLoss: 0, minLatency: 0, maxLatency: 0 },
        mobile: { carrier: 'mobile', name: '中国移动', probeCount: 0, avgLatency: 0, avgLoss: 0, minLatency: 0, maxLatency: 0 },
        edu: { carrier: 'edu', name: '教育网', probeCount: 0, avgLatency: 0, avgLoss: 0, minLatency: 0, maxLatency: 0 },
        other: { carrier: 'other', name: '其他', probeCount: 0, avgLatency: 0, avgLoss: 0, minLatency: 0, maxLatency: 0 },
      }

      for (const [key, cStat] of Object.entries(carrierMap)) {
        if (carriers[key as CarrierType]) {
          carriers[key as CarrierType] = {
            carrier: key as CarrierType,
            name: cStat.name,
            probeCount: cStat.probeCount,
            avgLatency: cStat.probeCount > 0 ? Math.round((cStat.sumLat / cStat.probeCount) * 10) / 10 : 0,
            avgLoss: cStat.probeCount > 0 ? Math.round((cStat.sumLoss / cStat.probeCount) * 10) / 10 : 0,
            minLatency: cStat.minLat < 999999 ? cStat.minLat : 0,
            maxLatency: cStat.maxLat,
          }
        }
      }

      const rawJson = JSON.stringify({
        id: newMeasId,
        target,
        timestamp: midTs,
        formattedTime: new Date(midTs).toLocaleString('zh-CN'),
        overallAvgLatency: overallAvg,
        overallLossRate: overallLoss,
        minLatency: minLat < 999999 ? minLat : overallAvg,
        maxLatency: maxLat,
        totalProbes,
        successfulProbes,
        carriers,
        probes: syntheticProbes,
      })

      // 4. 原子化批量执行：删除原密集行并写入单条合并数据
      const batchStmts: { sql: string; args: any[] }[] = [
        {
          sql: `DELETE FROM measurement_logs WHERE timestamp >= ? AND timestamp < ?`,
          args: [tStart, tEnd],
        },
        {
          sql: `DELETE FROM probe_logs WHERE timestamp >= ? AND timestamp < ?`,
          args: [tStart, tEnd],
        },
        {
          sql: `INSERT INTO measurement_logs (
            id, target, timestamp, created_at, date_day, date_month, date_year,
            overall_avg, overall_loss, min_latency, max_latency,
            successful_probes, total_probes, raw_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            newMeasId,
            target,
            midTs,
            new Date(midTs).toISOString(),
            dayStr,
            dateMonth,
            dateYear,
            overallAvg,
            overallLoss,
            minLat < 999999 ? minLat : overallAvg,
            maxLat,
            successfulProbes,
            totalProbes,
            rawJson,
          ],
        },
      ]

      for (const p of probeRes.rows) {
        const c = String(p.carrier || 'other')
        const prov = String(p.province || '')
        const city = String(p.city || '')
        const probeLogId = `${newMeasId}-${c}-${prov}-${city}`.replace(/\s+/g, '')
        const avgLat = p.avg_lat !== null ? Math.round(Number(p.avg_lat) * 10) / 10 : null
        const pMin = p.min_lat !== null ? Math.round(Number(p.min_lat) * 10) / 10 : avgLat
        const pMax = p.max_lat !== null ? Math.round(Number(p.max_lat) * 10) / 10 : avgLat
        const loss = p.avg_loss !== null ? Math.round(Number(p.avg_loss) * 10) / 10 : 0

        batchStmts.push({
          sql: `INSERT INTO probe_logs (
            id, measurement_id, target, province, city, carrier, carrier_name,
            asn, network, latency_avg, latency_min, latency_max, loss,
            status, timestamp, date_day, date_month, date_year
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            probeLogId,
            newMeasId,
            target,
            prov,
            city,
            c,
            String(p.carrier_name || c),
            p.asn ? Number(p.asn) : null,
            p.network ? String(p.network) : null,
            avgLat,
            pMin,
            pMax,
            loss,
            'finished',
            midTs,
            dayStr,
            dateMonth,
            dateYear,
          ],
        })
      }

      await db.batch(batchStmts, 'write')
    }

    if (dayHadMerge) {
      actualProcessedDays += 1
    }
  }

  // 执行 VACUUM 释放物理磁盘空间
  try {
    await db.execute(`VACUUM`)
  } catch (e) {
    console.error('Failed to VACUUM after merge:', e)
  }

  const afterStats = await getDbStats()
  const afterMeasurements = afterStats.totalMeasurements
  const afterProbes = afterStats.totalProbeRecords
  const afterBytes = afterStats.fileSize.totalBytes
  const reducedMeasurements = Math.max(0, beforeMeasurements - afterMeasurements)
  const reducedProbes = Math.max(0, beforeProbes - afterProbes)
  const freedBytes = Math.max(0, beforeBytes - afterBytes)

  const freedMsg = freedBytes > 0 ? `，释放约 ${formatBytes(freedBytes)} 物理空间` : ''
  const message = actualProcessedDays > 0
    ? `合并降采样完成！共优化 ${actualProcessedDays} 天数据，缩减 ${reducedMeasurements} 轮测量及 ${reducedProbes} 条探针记录${freedMsg}`
    : `所选日期的历史数据已达到指定精细度（每天 ≤ ${pointsPerDay} 个等分点），无需重复合并`

  return {
    processedDays: actualProcessedDays,
    reducedMeasurements,
    reducedProbes,
    beforeMeasurements,
    beforeProbes,
    afterMeasurements,
    afterProbes,
    freedBytes,
    newStats: afterStats,
    message,
  }
}

/**
 * 执行每日自动历史数据合并降采样策略
 */
export async function executeAutoMergePolicy(): Promise<MergeStatsResult> {
  await initDatabase()
  const policy = await getAutoMergePolicy()
  if (!policy.enabled) {
    const stats = await getDbStats()
    return {
      processedDays: 0,
      reducedMeasurements: 0,
      reducedProbes: 0,
      beforeMeasurements: stats.totalMeasurements,
      beforeProbes: stats.totalProbeRecords,
      afterMeasurements: stats.totalMeasurements,
      afterProbes: stats.totalProbeRecords,
      freedBytes: 0,
      newStats: stats,
      message: '自动合并策略当前未启用',
    }
  }

  const cutoffTs = Date.now() - policy.daysAgo * 24 * 60 * 60 * 1000
  const cutoffDate = new Date(cutoffTs)
  const cutoffDayStr = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, '0')}-${String(cutoffDate.getDate()).padStart(2, '0')}`

  // 扫描早于或等于 cutoffDayStr 且测量轮次大于 pointsPerDay 的日期
  const datesRes = await db.execute({
    sql: `
      SELECT date_day, COUNT(*) as cnt 
      FROM measurement_logs 
      WHERE date_day <= ? 
      GROUP BY date_day 
      HAVING cnt > ?
      ORDER BY date_day ASC
    `,
    args: [cutoffDayStr, policy.pointsPerDay],
  })

  const eligibleDays = datesRes.rows.map(r => String(r.date_day))

  if (eligibleDays.length === 0) {
    // 检查是否有未合并且有密集探针记录的日期
    const oldDaysRes = await db.execute({
      sql: `
        SELECT DISTINCT date_day 
        FROM measurement_logs 
        WHERE date_day <= ? AND id NOT LIKE 'rollup-%'
        ORDER BY date_day ASC
      `,
      args: [cutoffDayStr],
    })
    for (const r of oldDaysRes.rows) {
      const d = String(r.date_day)
      if (!eligibleDays.includes(d)) eligibleDays.push(d)
    }
  }

  if (eligibleDays.length === 0) {
    await setAutoMergePolicy({ lastRunTimestamp: Date.now() })
    const stats = await getDbStats()
    return {
      processedDays: 0,
      reducedMeasurements: 0,
      reducedProbes: 0,
      beforeMeasurements: stats.totalMeasurements,
      beforeProbes: stats.totalProbeRecords,
      afterMeasurements: stats.totalMeasurements,
      afterProbes: stats.totalProbeRecords,
      freedBytes: 0,
      newStats: stats,
      message: `${cutoffDayStr} 之前的历史数据已处于最佳降采样合并状态，无需重复处理`,
    }
  }

  const result = await mergeHistoryData({
    startDate: eligibleDays[0],
    endDate: eligibleDays[eligibleDays.length - 1],
    pointsPerDay: policy.pointsPerDay,
  })

  await setAutoMergePolicy({ lastRunTimestamp: Date.now() })
  return result
}





