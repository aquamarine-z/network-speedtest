import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { t } from "@/locales"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) {
    return `${s} ${t.common.units.seconds}`
  }
  const months = Math.floor(s / 2592000)
  const days = Math.floor((s % 2592000) / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const remainingSecs = s % 60

  const parts: string[] = []
  if (months > 0) parts.push(`${months} ${t.common.units.months}`)
  if (days > 0) parts.push(`${days}${t.common.units.days}`)
  if (hours > 0) parts.push(`${hours}${t.common.units.hours}`)
  if (minutes > 0) parts.push(`${minutes}${t.common.units.minutes}`)
  if (remainingSecs > 0 && months === 0 && days === 0 && hours === 0) parts.push(`${remainingSecs}${t.common.units.seconds}`)

  return parts.join(' ') || `${s} ${t.common.units.seconds}`
}
