import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-2xl border border-neutral-300/80 bg-neutral-50 px-3.5 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:border-[#0066cc] focus-visible:ring-2 focus-visible:ring-[#0066cc]/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-100 dark:placeholder:text-neutral-500 dark:focus-visible:border-[#2997ff] dark:focus-visible:ring-[#2997ff]/20 transition-all duration-150",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
