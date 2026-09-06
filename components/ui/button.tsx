import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

// Fallback in case class-variance-authority is not installed or using custom helper
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "pill"
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm"
}

const buttonVariants = (variant: ButtonProps["variant"] = "default", size: ButtonProps["size"] = "default", className?: string) => {
  const base = "inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97]"

  let vClass = "bg-[#0066cc] text-white hover:bg-[#0071e3] shadow-sm dark:bg-[#2997ff] dark:text-black dark:hover:bg-[#47a6ff]"
  if (variant === "secondary") {
    vClass = "bg-neutral-100 text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
  } else if (variant === "outline") {
    vClass = "border border-neutral-300/80 bg-transparent text-neutral-800 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800/60"
  } else if (variant === "destructive") {
    vClass = "bg-[#ff3b30] text-white hover:bg-[#ff453a] shadow-sm"
  } else if (variant === "ghost") {
    vClass = "hover:bg-neutral-100/80 text-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800/80"
  } else if (variant === "link") {
    vClass = "text-[#0066cc] dark:text-[#2997ff] underline-offset-4 hover:underline p-0 h-auto"
  } else if (variant === "pill") {
    vClass = "bg-[#0066cc] text-white hover:bg-[#0071e3] rounded-full shadow-sm text-xs font-semibold"
  }

  let sClass = "h-9 px-4 py-2"
  if (size === "sm") sClass = "h-8 px-3 text-xs"
  if (size === "lg") sClass = "h-11 px-6 text-base"
  if (size === "icon") sClass = "h-9 w-9 p-0"
  if (size === "icon-sm") sClass = "h-7 w-7 p-0"

  return cn(base, vClass, sClass, className)
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={buttonVariants(variant, size, className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
