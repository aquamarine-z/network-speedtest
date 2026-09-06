"use client"

import Link from "next/link"
import { useNetworkStore } from "@/store/useNetworkStore"
import { useTheme } from "@/components/Providers"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { Button } from "@/components/ui/button"
import { Activity, Sun, Moon, Shield } from "lucide-react"
import { t } from "@/locales"

export function Navbar() {
  const { latestResult } = useNetworkStore()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-black/[0.06] bg-white/70 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#1c1c1e]/75 transition-colors duration-200">
      <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff]">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <span className="text-sm sm:text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 whitespace-nowrap block">
              {t.nav.brand}
            </span>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 hidden sm:block">
              {t.nav.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {latestResult?.formattedTime && (
            <span className="text-xs text-neutral-400 dark:text-neutral-500 hidden lg:inline-block">
              {t.nav.updatedAt} {latestResult.formattedTime}
            </span>
          )}

          <LanguageSwitcher />

          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-1.5 text-xs font-medium rounded-full p-1.5 sm:px-3.5 sm:py-1.5 border border-neutral-200/80 bg-white/80 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/80 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-colors shrink-0"
            title={t.nav.adminPortalTooltip}
          >
            <Shield className="h-3.5 w-3.5 text-[#0066cc] dark:text-[#2997ff] shrink-0" />
            <span className="hidden sm:inline">{t.nav.adminPortal}</span>
          </Link>

          <Button
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 shrink-0"
            aria-label={t.nav.toggleTheme}
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            ) : (
              <Moon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
