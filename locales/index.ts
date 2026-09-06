import { zhCN } from "./zh-CN"
import { enUS } from "./en-US"
import { jaJP } from "./ja-JP"
import { koKR } from "./ko-KR"

export type LocaleKey = "zh-CN" | "en-US" | "ja-JP" | "ko-KR"
export type LocaleMessages = typeof zhCN

export const locales: Record<LocaleKey, LocaleMessages> = {
  "zh-CN": zhCN,
  "en-US": enUS,
  "ja-JP": jaJP,
  "ko-KR": koKR,
}

export const defaultLocale: LocaleKey = "zh-CN"

let currentLocale: LocaleKey = defaultLocale

export function getCurrentLocale(): LocaleKey {
  return currentLocale
}

export function setGlobalLocale(locale: LocaleKey) {
  if (locales[locale]) {
    currentLocale = locale
  }
}

/**
 * Returns dictionary messages for given locale, defaults to current active locale.
 */
export function getMessages(locale: LocaleKey = currentLocale): LocaleMessages {
  return locales[locale] || locales[defaultLocale]
}

function createLocaleProxy<T extends object>(getDict: () => T): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      const dict = getDict()
      const val = (dict as any)?.[prop]
      if (val !== null && typeof val === "object" && !Array.isArray(val)) {
        return createLocaleProxy(() => val)
      }
      return val
    },
  })
}

/**
 * Dynamic global translation object that automatically points to the currently active language.
 */
export const t: LocaleMessages = createLocaleProxy(() => locales[currentLocale])

export { zhCN, enUS, jaJP, koKR }
