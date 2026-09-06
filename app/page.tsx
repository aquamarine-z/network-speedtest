"use client"

import * as React from "react"
import { useNetworkStore } from "@/store/useNetworkStore"
import { Navbar } from "@/components/Navbar"
import { NetworkHeroOverview } from "@/components/NetworkHeroOverview"
import { RealChinaMap } from "@/components/RealChinaMap"
import { LatencyTrendChart } from "@/components/LatencyTrendChart"
import { RegionHistoryPopover } from "@/components/RegionHistoryPopover"
import { t } from "@/locales"

export default function Home() {
  const { fetchLatest } = useNetworkStore()

  React.useEffect(() => {
    fetchLatest()
  }, [fetchLatest])

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f7] text-[#1d1d1f] dark:bg-black dark:text-[#f5f5f7] transition-colors duration-200">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <section aria-label={t.hero.title}>
          <NetworkHeroOverview />
        </section>

        <section aria-label={t.map.title}>
          <RealChinaMap />
        </section>

        <section aria-label={t.trend.title}>
          <LatencyTrendChart />
        </section>
      </main>

      <RegionHistoryPopover />

      <footer className="border-t border-black/[0.06] bg-white/40 py-6 dark:border-white/[0.08] dark:bg-black/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center text-xs text-neutral-400 dark:text-neutral-500">
          <p className="flex flex-wrap items-center justify-center gap-2">
            <span>{t.footer.copyright}</span>
            <span className="hidden sm:inline">·</span>
            <span>{t.footer.poweredBy}</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
