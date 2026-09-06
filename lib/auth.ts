import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { getAdminPassword } from './db'

const ADMIN_SECRET = process.env.ADMIN_SECRET || 'pulse-admin-secret-key-salt-2026'

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const configuredPassword = await getAdminPassword()
  return password === configuredPassword
}

export function createAdminToken(): string {
  const payload = `admin:${Date.now()}`
  const signature = crypto.createHmac('sha256', ADMIN_SECRET).update(payload).digest('hex')
  return Buffer.from(`${payload}:${signature}`).toString('base64')
}

export function verifyAdminToken(token?: string | null): boolean {
  if (!token) return false

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const [user, tsStr, signature] = decoded.split(':')
    if (user !== 'admin' || !tsStr || !signature) return false

    const ts = parseInt(tsStr, 10)
    // Token 有效期 7 天
    if (Date.now() - ts > 7 * 24 * 3600 * 1000) return false

    const expectedSignature = crypto
      .createHmac('sha256', ADMIN_SECRET)
      .update(`${user}:${tsStr}`)
      .digest('hex')

    return signature === expectedSignature
  } catch {
    return false
  }
}

export function checkAdminAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    if (verifyAdminToken(token)) return true
  }

  const cookieToken = req.cookies.get('admin_token')?.value
  if (verifyAdminToken(cookieToken)) return true

  return false
}
