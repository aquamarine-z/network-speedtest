import { NextRequest, NextResponse } from 'next/server'
import { getProvinceHistory, getProvinceDates, getProvinceDailyStats } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const province = searchParams.get('province')
  const date = searchParams.get('date') || undefined

  if (!province) {
    return NextResponse.json({ success: false, error: '缺少 province 参数' }, { status: 400 })
  }

  try {
    const dates = await getProvinceDates(province)
    const activeDate = date || (dates.length > 0 ? dates[0] : undefined)
    const [logs, dailyStats] = await Promise.all([
      getProvinceHistory(province, activeDate),
      getProvinceDailyStats(province, 30),
    ])

    return NextResponse.json({
      success: true,
      province,
      dates,
      selectedDate: activeDate || null,
      dailyStats,
      records: logs,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '获取历史数据异常'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
