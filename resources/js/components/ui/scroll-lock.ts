import * as React from "react"

interface SavedLockState {
  scrollY: number
  htmlOverflow: string
  htmlOverscrollBehavior: string
  bodyPosition: string
  bodyTop: string
  bodyLeft: string
  bodyRight: string
  bodyWidth: string
  bodyOverflow: string
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
  const scrollY = window.scrollY || window.pageYOffset || 0
  const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth)
  const computedPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0

  savedState = {
    scrollY,
    htmlOverflow: html.style.overflow,
    htmlOverscrollBehavior: html.style.overscrollBehavior,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    bodyOverflow: body.style.overflow,
    bodyPaddingRight: body.style.paddingRight,
    appInert: appEl ? appEl.inert : false,
  }

  html.style.overflow = "hidden"
  html.style.overscrollBehavior = "none"

  body.style.position = "fixed"
  body.style.top = scrollY > 0 ? `-${scrollY}px` : "0px"
  body.style.left = "0"
  body.style.right = "0"
  body.style.width = "100%"
  body.style.overflow = "hidden"

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

  body.style.position = prev.bodyPosition
  body.style.top = prev.bodyTop
  body.style.left = prev.bodyLeft
  body.style.right = prev.bodyRight
  body.style.width = prev.bodyWidth
  body.style.overflow = prev.bodyOverflow
  body.style.paddingRight = prev.bodyPaddingRight

  if (appEl) {
    appEl.inert = prev.appInert
  }

  const prevScrollBehavior = html.style.scrollBehavior
  html.style.scrollBehavior = "auto"
  window.scrollTo(0, prev.scrollY)
  html.style.scrollBehavior = prevScrollBehavior
}

/**
 * Ref-counted scroll & background interactivity lock for open dialogs and sheets.
 * Uses fixed body positioning + html overflow lock to prevent iOS Safari background rubber-banding.
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
