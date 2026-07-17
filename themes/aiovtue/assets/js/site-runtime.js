
import { registerPageCleanup } from './page-cleanup.js'

let siteRuntimeTimer = null
let siteRuntimeVisible = true
let siteRuntimeVisibilityBound = false
let onVisibilityChange = null

function parseRuntimeStart(since) {
  const trimmed = String(since || '').trim()
  if (!trimmed) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number)
    return new Date(year, month - 1, day, 0, 0, 0, 0)
  }
  const start = new Date(trimmed)
  return Number.isNaN(start.getTime()) ? null : start
}

export function initSiteRuntime() {
  const runtimeEl = document.getElementById('site-runtime')
  if (!runtimeEl) return

  const start = parseRuntimeStart(runtimeEl.dataset.since)
  if (!start) return

  const units = {
    days: runtimeEl.querySelector('[data-unit="days"]'),
    hours: runtimeEl.querySelector('[data-unit="hours"]'),
    minutes: runtimeEl.querySelector('[data-unit="minutes"]'),
    seconds: runtimeEl.querySelector('[data-unit="seconds"]'),
  }

  const tick = () => {
    let diffMs = Date.now() - start.getTime()
    if (diffMs < 0) diffMs = 0

    const days = Math.floor(diffMs / 86400000)
    diffMs -= days * 86400000
    const hours = Math.floor(diffMs / 3600000)
    diffMs -= hours * 3600000
    const minutes = Math.floor(diffMs / 60000)
    diffMs -= minutes * 60000
    const seconds = Math.floor(diffMs / 1000)

    if (units.days) units.days.textContent = String(days)
    if (units.hours) units.hours.textContent = String(hours)
    if (units.minutes) units.minutes.textContent = String(minutes)
    if (units.seconds) units.seconds.textContent = String(seconds)
  }

  const scheduleTick = (interval) => {
    if (siteRuntimeTimer) window.clearInterval(siteRuntimeTimer)
    siteRuntimeTimer = window.setInterval(tick, interval)
  }

  onVisibilityChange = () => {
    const hidden = document.hidden
    if (hidden === !siteRuntimeVisible) return
    siteRuntimeVisible = !hidden
    scheduleTick(hidden ? 60000 : 1000)
  }

  tick()
  scheduleTick(1000)

  if (!siteRuntimeVisibilityBound) {
    siteRuntimeVisibilityBound = true
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  registerPageCleanup(() => {
    if (siteRuntimeTimer) window.clearInterval(siteRuntimeTimer)
    siteRuntimeTimer = null
    if (siteRuntimeVisibilityBound && onVisibilityChange) {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      siteRuntimeVisibilityBound = false
      siteRuntimeVisible = true
    }
  })
}
