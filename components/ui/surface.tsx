"use client"

import * as React from "react"
import NiceModal, { useModal } from "@ebay/nice-modal-react"
import { AlertCircle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { t } from "@/locales"

type ContentElement = HTMLDivElement | null

type SurfaceContextValue = {
  close: () => Promise<void>
  modal: boolean
  setContentElement: (element: ContentElement) => void
}

const SurfaceContext = React.createContext<SurfaceContextValue | null>(null)

type SurfaceRootCompatibilityProps = {
  onOpenChangeComplete?: (open: boolean) => void
}

function useNonModalPageAccess(
  contentElement: ContentElement,
  enabled: boolean
) {
  React.useEffect(() => {
    if (!contentElement || !enabled) return

    const ownerDocument = contentElement.ownerDocument
    const revealPage = () => {
      ownerDocument
        .querySelectorAll<HTMLElement>(
          '[data-aria-hidden="true"][aria-hidden="true"]'
        )
        .forEach((element) => {
          if (
            element.contains(contentElement) ||
            contentElement.contains(element)
          ) {
            return
          }

          element.removeAttribute("aria-hidden")
        })
    }

    revealPage()
    const observer = new MutationObserver(revealPage)
    observer.observe(ownerDocument.body, {
      attributeFilter: ["aria-hidden", "data-aria-hidden"],
      attributes: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [contentElement, enabled])
}

function hideNonModalOverlay(
  contentElement: HTMLDivElement,
  portalSlot: string,
  overlaySlot: string
) {
  const portalElement = contentElement.closest(`[data-slot="${portalSlot}"]`)
  let overlayElement = portalElement?.querySelector<HTMLElement>(
    `:scope > [data-slot="${overlaySlot}"]`
  )

  let siblingElement = contentElement.previousElementSibling
  while (!overlayElement && siblingElement) {
    if (
      siblingElement instanceof HTMLElement &&
      siblingElement.dataset.slot === overlaySlot
    ) {
      overlayElement = siblingElement
      break
    }

    siblingElement = siblingElement.previousElementSibling
  }

  if (overlayElement) overlayElement.hidden = true
}

function useSurfaceContentRef(
  componentName: string,
  portalSlot: string,
  overlaySlot: string,
  ref: React.Ref<HTMLDivElement> | undefined
) {
  const context = React.useContext(SurfaceContext)

  const setContentRef = React.useCallback(
    (element: ContentElement) => {
      context?.setContentElement(element)

      if (element && context?.modal === false) {
        hideNonModalOverlay(element, portalSlot, overlaySlot)
      }

      if (typeof ref === "function") {
        ref(element)
      } else if (ref && "current" in ref) {
        ;(ref as React.MutableRefObject<HTMLDivElement | null>).current = element
      }
    },
    [context, overlaySlot, portalSlot, ref]
  )

  if (!context) {
    throw new Error(`${componentName} must be rendered inside a Surface.`)
  }

  return { context, setContentRef }
}

function useSurfaceLifecycle<T>(
  modal: ReturnType<typeof useModal>,
  resolveResult: (result: T | null | undefined) => void
) {
  const modalRef = React.useRef(modal)
  const contentRef = React.useRef<ContentElement>(null)
  const resultRef = React.useRef<T | undefined>(undefined)
  const closePromiseRef = React.useRef<Promise<void> | null>(null)
  const removedRef = React.useRef(false)
  const [closing, setClosing] = React.useState(false)
  const [contentElement, setContentElementState] =
    React.useState<ContentElement>(null)

  modalRef.current = modal

  const setContentElement = React.useCallback((element: ContentElement) => {
    contentRef.current = element
    setContentElementState(element)
  }, [])

  const finishClose = React.useCallback(() => {
    if (removedRef.current) return

    removedRef.current = true
    const currentModal = modalRef.current
    resolveResult(resultRef.current)
    currentModal.resolveHide()
    currentModal.remove()
  }, [resolveResult])

  const close = React.useCallback((result?: T): Promise<void> => {
    if (closePromiseRef.current) return closePromiseRef.current

    resultRef.current = result
    setClosing(true)
    closePromiseRef.current = Promise.resolve(modalRef.current.hide()).then(
      () => undefined
    )

    return closePromiseRef.current
  }, [])

  const finishWhenAnimationsComplete = React.useCallback(() => {
    const hasRunningAnimation = (
      contentRef.current?.getAnimations() ?? []
    ).some(
      (animation) =>
        animation.playState === "running" &&
        animation.playbackRate !== 0 &&
        animation.effect?.getComputedTiming().iterations !== Infinity
    )

    if (hasRunningAnimation) return false

    finishClose()
    return true
  }, [finishClose])

  const handleOpenChangeComplete = React.useCallback(
    (open: boolean) => {
      if (!open) finishWhenAnimationsComplete()
    },
    [finishWhenAnimationsComplete]
  )

  React.useEffect(() => {
    if (!closing || modal.visible) return

    let active = true
    let frame = 0

    const waitForAnimations = () => {
      if (finishWhenAnimationsComplete()) return

      if (active) frame = window.requestAnimationFrame(waitForAnimations)
    }

    frame = window.requestAnimationFrame(waitForAnimations)

    return () => {
      active = false
      window.cancelAnimationFrame(frame)
    }
  }, [closing, finishWhenAnimationsComplete, modal.visible])

  return {
    close,
    contentElement,
    handleOpenChangeComplete,
    setContentElement,
  }
}

export type SurfaceDialogContentProps = Omit<
  React.ComponentProps<typeof DialogContent>,
  "showCloseButton"
> & {
  closeButtonLabel?: string
  showCloseButton?: boolean
}

const SurfaceDialogContent = React.forwardRef<HTMLDivElement, SurfaceDialogContentProps>(
  ({ className, children, closeButtonLabel = "Close", showCloseButton = true, ...props }, ref) => {
    const { context, setContentRef } = useSurfaceContentRef(
      "SurfaceDialogContent",
      "dialog-portal",
      "dialog-overlay",
      ref
    )

    return (
      <DialogContent
        ref={setContentRef}
        showCloseButton={false}
        className={cn("sm:max-w-lg", className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-4 right-4 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
            aria-label={closeButtonLabel}
            onClick={() => void context.close()}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </DialogContent>
    )
  }
)
SurfaceDialogContent.displayName = "SurfaceDialogContent"

export type CustomDialogOptions = {
  modal?: boolean
  dismissible?: boolean
}

export type DialogOptions = CustomDialogOptions & {
  showCloseButton?: boolean
  closeButtonLabel?: string
  title?: React.ReactNode
  titleIcon?: React.ReactNode
  showTitleIcon?: boolean
}

export type AlertDialogOptions = DialogOptions & {
  message?: React.ReactNode
  closeButtonContent?: React.ReactNode
}

export type ConfirmDialogOptions = DialogOptions & {
  message?: React.ReactNode
  confirmButtonContent?: React.ReactNode
  cancelButtonContent?: React.ReactNode
}

export type PromptDialogOptions = DialogOptions & {
  message?: React.ReactNode
  inputLabel?: string
  defaultValue?: string
  placeholder?: string
  confirmButtonContent?: React.ReactNode
  cancelButtonContent?: React.ReactNode
}

type CustomDialogSurfaceProps<T> = {
  content: (close: (result?: T) => Promise<void>) => React.ReactNode
  options: CustomDialogOptions
  resolveResult: (result: T | null | undefined) => void
}

function custom<T = unknown>(
  content: (close: (result?: T) => Promise<void>) => React.ReactNode,
  options: CustomDialogOptions = {}
): Promise<T | null> {
  const CustomSurfaceModal = NiceModal.create<CustomDialogSurfaceProps<T>>(
    ({ content: renderContent, options: modalOptions, resolveResult }) => {
      const modal = useModal()
      const {
        close,
        contentElement,
        handleOpenChangeComplete,
        setContentElement,
      } = useSurfaceLifecycle<T>(modal, resolveResult)
      const isModal = modalOptions.modal ?? true
      const isDismissible = modalOptions.dismissible ?? isModal

      useNonModalPageAccess(contentElement, !isModal)

      React.useEffect(() => {
        if (!modal.visible || isDismissible || !isModal) return

        if (!contentElement) return

        const ownerDocument = contentElement.ownerDocument
        const handleKeyDown = (event: KeyboardEvent) => {
          if (
            event.key !== "Escape" ||
            !contentElement.contains(event.target as Node)
          ) {
            return
          }

          event.preventDefault()
          event.stopPropagation()
          void close()
        }

        ownerDocument.addEventListener("keydown", handleKeyDown, true)
        return () =>
          ownerDocument.removeEventListener("keydown", handleKeyDown, true)
      }, [
        close,
        isDismissible,
        contentElement,
        isModal,
        modal.visible,
      ])

      const contextValue = React.useMemo<SurfaceContextValue>(
        () => ({
          close: () => close(),
          modal: isModal,
          setContentElement,
        }),
        [close, isModal, setContentElement]
      )
      const compatibilityProps: SurfaceRootCompatibilityProps = {
        onOpenChangeComplete: handleOpenChangeComplete,
      }

      return (
        <SurfaceContext.Provider value={contextValue}>
          <Dialog
            {...compatibilityProps}
            modal={isModal}
            open={modal.visible}
            onOpenChange={(open) => {
              if (
                open ||
                !modal.visible ||
                !isModal ||
                !isDismissible
              ) {
                return
              }

              void close()
            }}
          >
            {renderContent(close)}
          </Dialog>
        </SurfaceContext.Provider>
      )
    }
  )

  return new Promise<T | null>((resolveResult) => {
    void NiceModal.show(CustomSurfaceModal, {
      content,
      options,
      resolveResult: (result) => resolveResult(result ?? null),
    })
  })
}

function titleIcon(options: DialogOptions) {
  if (!(options.showTitleIcon ?? true)) return null

  return (
    <span className="contents" aria-hidden="true">
      {options.titleIcon ?? <AlertCircle className="size-5 text-[#0066cc] dark:text-[#2997ff]" />}
    </span>
  )
}

export const dialog = {
  custom,

  async alert(options: AlertDialogOptions = {}): Promise<void> {
    await custom<null>(
      (close) => (
        <SurfaceDialogContent
          role="alertdialog"
          closeButtonLabel={options.closeButtonLabel}
          showCloseButton={options.showCloseButton ?? true}
        >
          <DialogHeader>
            <DialogTitle className="flex flex-row items-center gap-2">
              {titleIcon(options)}
              {options.title ?? t.common.dialog.notice}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <DialogDescription className="text-center text-neutral-600 dark:text-neutral-300">
              {options.message}
            </DialogDescription>
            <Button
              type="button"
              className="w-full max-w-xs"
              onClick={() => void close(null)}
            >
              {options.closeButtonContent ?? t.common.dialog.gotIt}
            </Button>
          </div>
        </SurfaceDialogContent>
      ),
      {
        modal: options.modal,
        dismissible: options.dismissible ?? false,
      }
    )
  },

  async confirm(options: ConfirmDialogOptions = {}): Promise<boolean | null> {
    return await custom<boolean>(
      (close) => (
        <SurfaceDialogContent
          role="alertdialog"
          closeButtonLabel={options.closeButtonLabel}
          showCloseButton={options.showCloseButton ?? true}
        >
          <DialogHeader>
            <DialogTitle className="flex flex-row items-center gap-2">
              {titleIcon(options)}
              {options.title ?? t.common.dialog.confirmTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <DialogDescription className="text-neutral-600 dark:text-neutral-300">
              {options.message}
            </DialogDescription>
            <div className="flex flex-row justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void close(false)}
              >
                {options.cancelButtonContent ?? t.common.buttons.cancel}
              </Button>
              <Button
                type="button"
                onClick={() => void close(true)}
              >
                {options.confirmButtonContent ?? t.common.buttons.confirm}
              </Button>
            </div>
          </div>
        </SurfaceDialogContent>
      ),
      {
        modal: options.modal,
        dismissible: options.dismissible ?? true,
      }
    )
  },

  async prompt(options: PromptDialogOptions = {}): Promise<string | null> {
    return await custom<string | null>(
      (close) => (
        <SurfaceDialogContent
          closeButtonLabel={options.closeButtonLabel}
          showCloseButton={options.showCloseButton ?? true}
        >
          <form
            className="contents"
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              const value = formData.get("surface-prompt-value")
              void close(typeof value === "string" ? value : "")
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex flex-row items-center gap-2">
                {titleIcon(options)}
                {options.title ?? t.common.dialog.inputTitle}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              {options.message && (
                <DialogDescription className="text-neutral-600 dark:text-neutral-300">
                  {options.message}
                </DialogDescription>
              )}
              <Input
                name="surface-prompt-value"
                aria-label={options.inputLabel ?? t.common.dialog.inputValue}
                defaultValue={options.defaultValue}
                placeholder={options.placeholder}
                autoFocus
              />
              <div className="flex flex-row justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void close(null)}
                >
                  {options.cancelButtonContent ?? t.common.buttons.cancel}
                </Button>
                <Button type="submit">
                  {options.confirmButtonContent ?? t.common.buttons.save}
                </Button>
              </div>
            </div>
          </form>
        </SurfaceDialogContent>
      ),
      options
    )
  },
}

export { SurfaceDialogContent }
