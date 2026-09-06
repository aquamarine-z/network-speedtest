import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminPassword, createAdminToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()
    const isValid = await verifyAdminPassword(password)
    if (!password || !isValid) {
      return NextResponse.json({ success: false, error: '管理员密码错误' }, { status: 401 })
    }

    const token = createAdminToken()
    const res = NextResponse.json({ success: true, message: '登录成功', token })
    res.cookies.set('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    })
    return res
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '登录处理失败'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

export async function DELETE() {
  const res = NextResponse.json({ success: true, message: '已退出登录' })
  res.cookies.delete('admin_token')
  return res
}
