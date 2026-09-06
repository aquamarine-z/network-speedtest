"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { KeyRound, Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react"
import { t } from "@/locales"

interface ChangePasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (message: string) => void
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  onSuccess,
}: ChangePasswordDialogProps) {
  const [oldPassword, setOldPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showOld, setShowOld] = React.useState(false)
  const [showNew, setShowNew] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setOldPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setErrorMsg(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!oldPassword.trim()) {
      setErrorMsg(t.password.errOldEmpty)
      return
    }

    if (!newPassword.trim()) {
      setErrorMsg(t.password.errNewEmpty)
      return
    }

    if (newPassword.trim().length < 6) {
      setErrorMsg(t.password.errLength)
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(t.password.errMismatch)
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          oldPassword: oldPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      })

      const data = await res.json()
      if (data.success) {
        onOpenChange(false)
        if (onSuccess) {
          onSuccess(data.message || t.password.successMsg)
        }
      } else {
        setErrorMsg(data.error || t.password.errNetwork)
      }
    } catch {
      setErrorMsg(t.password.errNetwork)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl p-6 apple-card-shadow">
        <DialogHeader className="border-b border-black/[0.05] pb-3 dark:border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#0066cc]/10 text-[#0066cc] dark:bg-[#2997ff]/20 dark:text-[#2997ff]">
              <KeyRound className="h-4.5 w-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                {t.password.dialogTitle}
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-400">
                {t.password.dialogDesc}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-2xl bg-rose-500/10 border border-rose-500/20 px-3.5 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-400 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              {t.password.currentPassword}
            </label>
            <div className="relative">
              <Input
                type={showOld ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder={t.password.currentPasswordPlaceholder}
                autoFocus
                className="rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              {t.password.newPassword}
            </label>
            <div className="relative">
              <Input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.password.newPasswordPlaceholder}
                className="rounded-xl pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              {t.password.confirmPassword}
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t.password.confirmPasswordPlaceholder}
              className="rounded-xl"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-black/[0.05] dark:border-white/[0.06]">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full text-xs h-9 px-4 border-neutral-200 dark:border-neutral-700"
            >
              {t.common.buttons.cancel}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-full text-xs h-9 px-5 bg-[#0066cc] hover:bg-[#0055b3] text-white dark:bg-[#2997ff] dark:hover:bg-[#147ce5] dark:text-black font-semibold shadow-sm"
            >
              {loading ? t.password.submitting : t.password.submitBtn}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
