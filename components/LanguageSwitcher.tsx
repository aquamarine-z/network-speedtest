"use client"

import * as React from "react"
import { useLocale } from "@/components/Providers"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Languages, Check, ChevronDown } from "lucide-react"
import { LocaleKey } from "@/locales"

interface LanguageOption {
  key: LocaleKey
  name: string
  nativeName: string
  shortName: string
  flag: string
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    key: "zh-CN",
    name: "Chinese",
    nativeName: "简体中文",
    shortName: "中文",
    flag: "🇨🇳",
  },
  {
    key: "en-US",
    name: "English",
    nativeName: "English",
    shortName: "EN",
    flag: "🇺🇸",
  },
  {
    key: "ja-JP",
    name: "Japanese",
    nativeName: "日本語",
    shortName: "日本語",
    flag: "🇯🇵",
  },
  {
    key: "ko-KR",
    name: "Korean",
    nativeName: "한국어",
    shortName: "한국어",
    flag: "🇰🇷",
  },
]

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  const [open, setOpen] = React.useState(false)

  const currentOption = LANGUAGE_OPTIONS.find((o) => o.key === locale) || LANGUAGE_OPTIONS[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Switch language / 切换语言"
          className={`inline-flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-medium rounded-full px-2.5 py-1 sm:px-3 sm:py-1.5 border border-neutral-200/80 bg-white/80 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/80 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-all cursor-pointer shadow-2xs whitespace-nowrap shrink-0 ${
            className || ""
          }`}
        >
          <Languages className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#0066cc] dark:text-[#2997ff] shrink-0" />
          <span className="sm:hidden">{currentOption.shortName}</span>
          <span className="hidden sm:inline">{currentOption.nativeName}</span>
          <ChevronDown
            className={`h-2.5 w-2.5 sm:h-3 sm:w-3 text-neutral-400 dark:text-neutral-500 transition-transform duration-200 shrink-0 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-44 p-1 rounded-2xl border border-black/[0.08] bg-white/95 backdrop-blur-xl shadow-xl dark:border-white/[0.1] dark:bg-[#1c1c1e]/95 z-50"
      >
        <div className="flex flex-col gap-0.5">
          {LANGUAGE_OPTIONS.map((item) => {
            const isSelected = item.key === locale
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setLocale(item.key)
                  setOpen(false)
                }}
                className={`flex items-center justify-between px-3 py-2 text-xs rounded-xl font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/15 dark:text-[#2997ff] font-semibold"
                    : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm leading-none">{item.flag}</span>
                  <span>{item.nativeName}</span>
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-[#0066cc] dark:text-[#2997ff]" />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
