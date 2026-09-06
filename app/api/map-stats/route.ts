import { NextRequest, NextResponse } from 'next/server'
import { getMapAggregatedStats, MapTimeRange } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const range = (searchParams.get('range') || '7d') as MapTimeRange
    const validRanges: MapTimeRange[] = ['7d', '30d', 'today', 'latest']
    const safeRange: MapTimeRange = validRanges.includes(range) ? range : '7d'

    const data = await getMapAggregatedStats(safeRange)
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error fetching map stats:', error)
    const message = error instanceof Error ? error.message : '获取地图统计失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
