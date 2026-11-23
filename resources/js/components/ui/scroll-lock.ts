import * as React from "react"

interface SavedLockState {
  htmlOverflow: string
  htmlOverscrollBehavior: string
  bodyOverflow: string
  bodyOverscrollBehavior: string
  bodyPaddingRight: string
  appInert: boolean
}

let activeLockCount = 0
let savedState: SavedLockState | null = null

function acquireBodyLock(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return

  activeLockCount += 1
  if (activeLockCount > 1) return

  const html = document.documentElement
  const body = document.body
  const appEl = document.getElementById("app")
  const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth)
  const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0

  savedState = {
    htmlOverflow: html.style.overflow,
    htmlOverscrollBehavior: html.style.overscrollBehavior,
    bodyOverflow: body.style.overflow,
    bodyOverscrollBehavior: body.style.overscrollBehavior,
    bodyPaddingRight: body.style.paddingRight,
    appInert: appEl ? appEl.inert : false,
  }

  // Lock scroll via overflow + overscroll-behavior instead of position:fixed so sticky layouts stay anchored.
  html.style.overflow = "hidden"
  html.style.overscrollBehavior = "none"
  body.style.overflow = "hidden"
  body.style.overscrollBehavior = "none"

  if (scrollbarWidth > 0 && computedPaddingRight === 0) {
    body.style.paddingRight = `${scrollbarWidth}px`
  }

  if (appEl) {
    appEl.inert = true
  }
}

function releaseBodyLock(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return
  if (activeLockCount === 0) return

  activeLockCount -= 1
  if (activeLockCount > 0 || !savedState) return

  const html = document.documentElement
  const body = document.body
  const appEl = document.getElementById("app")
  const prev = savedState
  savedState = null

  html.style.overflow = prev.htmlOverflow
  html.style.overscrollBehavior = prev.htmlOverscrollBehavior

  body.style.overflow = prev.bodyOverflow
  body.style.overscrollBehavior = prev.bodyOverscrollBehavior
  body.style.paddingRight = prev.bodyPaddingRight

  if (appEl) {
    appEl.inert = prev.appInert
  }
}

/**
 * Ref-counted scroll & background interactivity lock for open dialogs and sheets.
 */
export function useLockBodyScroll(locked = true): void {
  React.useEffect(() => {
    if (!locked) return
    acquireBodyLock()
    return () => {
      releaseBodyLock()
    }
  }, [locked])
}
