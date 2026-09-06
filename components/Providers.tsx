"use client"

import * as React from "react"
import NiceModal from "@ebay/nice-modal-react"
import { LocaleKey, LocaleMessages, defaultLocale, getMessages, setGlobalLocale } from "@/locales"

interface ThemeContextType {
  theme: "light" | "dark"
  toggleTheme: () => void
  setTheme: (t: "light" | "dark") => void
}

const ThemeContext = React.createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
  setTheme: () => {},
})

export function useTheme() {
  return React.useContext(ThemeContext)
}

interface LocaleContextType {
  locale: LocaleKey
  setLocale: (l: LocaleKey) => void
  t: LocaleMessages
}

const LocaleContext = React.createContext<LocaleContextType>({
  locale: defaultLocale,
  setLocale: () => {},
  t: getMessages(defaultLocale),
})

export function useLocale() {
  return React.useContext(LocaleContext)
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<"light" | "dark">("light")
  const [locale, setLocaleState] = React.useState<LocaleKey>(defaultLocale)

  React.useEffect(() => {
    // Theme 初始化
    const savedTheme = localStorage.getItem("app-theme") as "light" | "dark" | null
    if (savedTheme) {
      setThemeState(savedTheme)
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      const initial = prefersDark ? "dark" : "light"
      setThemeState(initial)
      if (initial === "dark") {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
    }

    // 语言 Locale 初始化与缓存恢复
    const savedLocale = localStorage.getItem("app-locale") as LocaleKey | null
    const validLocales: LocaleKey[] = ["zh-CN", "en-US", "ja-JP", "ko-KR"]
    if (savedLocale && validLocales.includes(savedLocale)) {
      setLocaleState(savedLocale)
      setGlobalLocale(savedLocale)
      document.documentElement.lang = savedLocale
    } else {
      const navLang = (typeof navigator !== "undefined" ? navigator.language : "")?.toLowerCase() || ""
      let detected: LocaleKey = "en-US"
      if (navLang.startsWith("zh")) {
        detected = "zh-CN"
      } else if (navLang.startsWith("ja")) {
        detected = "ja-JP"
      } else if (navLang.startsWith("ko")) {
        detected = "ko-KR"
      }
      setLocaleState(detected)
      setGlobalLocale(detected)
      document.documentElement.lang = detected
    }
  }, [])

  const setTheme = React.useCallback((newTheme: "light" | "dark") => {
    setThemeState(newTheme)
    localStorage.setItem("app-theme", newTheme)
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [])

  const toggleTheme = React.useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [theme, setTheme])

  const setLocale = React.useCallback((newLocale: LocaleKey) => {
    setLocaleState(newLocale)
    setGlobalLocale(newLocale)
    localStorage.setItem("app-locale", newLocale)
    document.documentElement.lang = newLocale
  }, [])

  const currentMessages = React.useMemo(() => getMessages(locale), [locale])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      <LocaleContext.Provider value={{ locale, setLocale, t: currentMessages }}>
        <NiceModal.Provider>
          {children}
        </NiceModal.Provider>
      </LocaleContext.Provider>
    </ThemeContext.Provider>
  )
}
