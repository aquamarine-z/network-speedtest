import { CarrierType } from './types'
import { t } from '@/locales'

/**
 * 规范化运营商标识：支持英文代号、中文名称及常见关键字
 */
export function normalizeCarrierType(carrier: CarrierType | string): CarrierType {
  const c = (carrier || '').toLowerCase().trim()
  if (c === 'telecom' || c.includes('telecom') || c.includes('电信') || c.includes('chinanet') || c.includes('ctc')) {
    return 'telecom'
  }
  if (c === 'unicom' || c.includes('unicom') || c.includes('联通') || c.includes('cnc') || c.includes('cuc')) {
    return 'unicom'
  }
  if (c === 'mobile' || c.includes('mobile') || c.includes('移动') || c.includes('cmnet') || c.includes('cmcc') || c.includes('cmiot')) {
    return 'mobile'
  }
  if (c === 'edu' || c.includes('edu') || c.includes('教育') || c.includes('cernet') || c.includes('cstnet')) {
    return 'edu'
  }
  return 'other'
}

/**
 * 运营商识别：基于 ASN 与网络运营商名称识别主要电信运营商
 */
export function identifyCarrier(asn: number, network: string): { carrier: CarrierType; name: string } {
  const netLower = (network || '').toLowerCase()

  // 电信识别
  const telecomAsns = [4134, 4809, 23724, 133118, 134764, 134760, 134761, 134762, 134763]
  if (telecomAsns.includes(asn) || netLower.includes('telecom') || netLower.includes('chinanet') || netLower.includes('ctc')) {
    return { carrier: 'telecom', name: t.carrier.telecom }
  }

  // 联通识别
  const unicomAsns = [4837, 9929, 10099, 17621, 17622, 17623, 17816]
  if (unicomAsns.includes(asn) || netLower.includes('unicom') || netLower.includes('cncgroup') || netLower.includes('cuc')) {
    return { carrier: 'unicom', name: t.carrier.unicom }
  }

  // 移动识别
  const mobileAsns = [9808, 58453, 56040, 56041, 56042, 56044, 24400, 56046]
  if (mobileAsns.includes(asn) || netLower.includes('mobile') || netLower.includes('cmnet') || netLower.includes('cmiot')) {
    return { carrier: 'mobile', name: t.carrier.mobile }
  }

  // 教育科研网
  const eduAsns = [4538, 24355, 24363, 7497]
  if (eduAsns.includes(asn) || netLower.includes('cernet') || netLower.includes('cstnet') || netLower.includes('edu')) {
    return { carrier: 'edu', name: t.carrier.edu }
  }

  return { carrier: 'other', name: t.carrier.other }
}

export interface CarrierTheme {
  dotClass: string
  badgeClass: string
  color: string
  hex: string
  textLight: string
  textDark: string
}

/**
 * 获取运营商对应的视觉主题配色与徽章样式 (全局统一：电信蓝、联通紫、移动青、教育靛蓝)
 */
export function getCarrierTheme(carrier: CarrierType | string): CarrierTheme {
  const norm = normalizeCarrierType(carrier)
  switch (norm) {
    case 'telecom':
      return {
        dotClass: 'bg-blue-500 dark:bg-blue-400',
        badgeClass: 'bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400',
        color: '#2563eb',
        hex: '#2563eb',
        textLight: '#1d4ed8',
        textDark: '#93c5fd',
      }
    case 'unicom':
      return {
        dotClass: 'bg-purple-500 dark:bg-purple-400',
        badgeClass: 'bg-purple-500/10 text-purple-600 dark:bg-purple-400/15 dark:text-purple-400',
        color: '#9333ea',
        hex: '#9333ea',
        textLight: '#7e22ce',
        textDark: '#d8b4fe',
      }
    case 'mobile':
      return {
        dotClass: 'bg-cyan-500 dark:bg-cyan-400',
        badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-400',
        color: '#06b6d4',
        hex: '#06b6d4',
        textLight: '#0e7490',
        textDark: '#67e8f9',
      }
    case 'edu':
      return {
        dotClass: 'bg-indigo-500 dark:bg-indigo-400',
        badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/15 dark:text-indigo-400',
        color: '#6366f1',
        hex: '#6366f1',
        textLight: '#4338ca',
        textDark: '#a5b4fc',
      }
    case 'other':
    default:
      return {
        dotClass: 'bg-neutral-500 dark:bg-neutral-400',
        badgeClass: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400',
        color: '#71717a',
        hex: '#71717a',
        textLight: '#52525b',
        textDark: '#a1a1aa',
      }
  }
}
