import type { Metadata } from "next"
import { Providers } from "@/components/Providers"
import { t } from "@/locales"
import "./globals.css"

export const metadata: Metadata = {
  title: t.meta.title,
  description: t.meta.description,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className="h-full">
      <body className="min-h-full flex flex-col bg-[#f5f5f7] text-[#1d1d1f] dark:bg-black dark:text-[#f5f5f7] antialiased transition-colors duration-200">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
