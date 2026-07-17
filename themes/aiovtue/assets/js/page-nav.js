import { requestPageCommentsMount } from './comments.js'
import { awaitPageLazyModules } from './lazy-modules.js'
import { hidePjaxLoader, showPjaxLoader } from './pjax-loader.js'

const DEFAULT_FADE_MS = 200
const DEFAULT_MOUNT_DELAY_MS = 120

const EXCLUDE_PATH_RE = [
  /^\/categories\/[^/]+\/?$/,
  /^\/tags\/[^/]+\/?$/,
]

function readPjaxConfig() {
  const meta = document.querySelector('meta[name="sakura-pjax"]')
  if (!meta || meta.content !== '1') return null
  const fade = Number.parseInt(meta.getAttribute('data-fade') || '', 10)
  const mountDelay = Number.parseInt(meta.getAttribute('data-mount-delay') || '', 10)
  return {
    enabled: true,
    fadeMs: Number.isFinite(fade) && fade >= 0 ? fade : DEFAULT_FADE_MS,
    mountDelayMs: Number.isFinite(mountDelay) && mountDelay >= 0 ? mountDelay : DEFAULT_MOUNT_DELAY_MS,
  }
}

function normalizePath(pathname) {
  const path = pathname || '/'
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1)
  return path
}

function isExcludedPath(pathname) {
  const path = normalizePath(pathname)
  return EXCLUDE_PATH_RE.some((re) => re.test(path))
}

function shouldHandleLink(anchor) {
  if (!anchor || anchor.tagName !== 'A' || !anchor.href) return false
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return false
  if (anchor.dataset.pjax === 'false') return false

  let url
  try {
    url = new URL(anchor.href, window.location.href)
  } catch {
    return false
  }

  if (url.origin !== window.location.origin) return false
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return false
  if (isExcludedPath(url.pathname)) return false

  return true
}

function syncHtmlClasses(docEl) {
  const root = document.documentElement
  root.classList.toggle('is-home', docEl.classList.contains('is-home'))
  root.classList.toggle('has-home-layout', docEl.classList.contains('has-home-layout'))
  root.classList.toggle('has-404-layout', docEl.classList.contains('has-404-layout'))
  ;[...root.classList]
    .filter((className) => className.startsWith('hero-style-'))
    .forEach((className) => root.classList.remove(className))
  ;[...docEl.classList]
    .filter((className) => className.startsWith('hero-style-'))
    .forEach((className) => root.classList.add(className))
  root.lang = 'zh-CN'
  root.setAttribute('translate', 'no')
  root.classList.add('notranslate')
  document.body?.setAttribute('translate', 'no')
  document.body?.classList.add('notranslate')
  window.__sakuraDismissTranslateUi?.()
}

function syncHeadMeta(doc) {
  doc.querySelectorAll('meta[name="sakura-moments-script"], meta[name="sakura-excalidraw-script"], meta[name="sakura-gallery-post-script"], meta[name="sakura-twikoo-env"], meta[name="sakura-waline-server"], meta[name="sakura-comment-provider"], meta[name="sakura-signature-script"]').forEach((meta) => {
    const name = meta.getAttribute('name')
    if (!name) return
    let current = document.querySelector(`meta[name="${name}"]`)
    if (!current) {
      current = document.createElement('meta')
      current.setAttribute('name', name)
      document.head.appendChild(current)
    }
    const content = meta.getAttribute('content')
    if (content) current.setAttribute('content', content)
    else current.removeAttribute('content')
  })
}

const PAGE_STYLE_SELECTOR = 'link[data-sakura-page-style], link[href*="katex/katex.min.css"], link[href*="@waline/client"]'

function appendHeadStyles(doc) {
  const nextLinks = [...doc.head.querySelectorAll(PAGE_STYLE_SELECTOR)]
  const currentHrefs = new Set(
    [...document.head.querySelectorAll(PAGE_STYLE_SELECTOR)].map((link) => link.getAttribute('href')),
  )
  nextLinks.forEach((link) => {
    const href = link.getAttribute('href')
    if (href && !currentHrefs.has(href)) {
      document.head.appendChild(link.cloneNode(true))
    }
  })
}

function removeStaleHeadStyles(doc) {
  const nextHrefs = new Set(
    [...doc.head.querySelectorAll(PAGE_STYLE_SELECTOR)].map((link) => link.getAttribute('href')),
  )
  document.head.querySelectorAll(PAGE_STYLE_SELECTOR).forEach((link) => {
    if (!nextHrefs.has(link.getAttribute('href'))) link.remove()
  })
}

function waitForStylesheet(link) {
  if (link.sheet) return Promise.resolve()
  return new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true })
    link.addEventListener('error', resolve, { once: true })
  })
}

async function waitForLayoutSettle(mountDelayMs = DEFAULT_MOUNT_DELAY_MS) {
  await new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve)
    })
  })
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (mountDelayMs > 0) await wait(mountDelayMs)
}

async function waitForPageStyles(doc) {
  const nextHrefs = [...doc.head.querySelectorAll(PAGE_STYLE_SELECTOR)]
    .map((link) => link.getAttribute('href'))
    .filter(Boolean)
  if (!nextHrefs.length) return

  const links = nextHrefs
    .map((href) => [...document.head.querySelectorAll(PAGE_STYLE_SELECTOR)].find(
      (link) => link.getAttribute('href') === href,
    ))
    .filter(Boolean)

  await Promise.all(links.map(waitForStylesheet))
  await new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
  })
}

function markSkipLoader() {
  try {
    sessionStorage.setItem('sakura-skip-loader', '1')
  } catch {
    /* ignore */
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebar-overlay')
  if (!sidebar?.classList.contains('is-open')) return
  sidebar.classList.remove('is-open')
  overlay?.classList.remove('is-open')
  sidebar.setAttribute('aria-hidden', 'true')
  const menuBtn = document.getElementById('sidebar-toggle')
  menuBtn?.classList.remove('mobile-btn-open')
  menuBtn?.setAttribute('aria-expanded', 'false')
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

const HOME_LIST_SCROLL_KEY = 'sakura-home-list-scroll'
const HOME_PAGINATE_FLAG_KEY = 'sakura-home-paginate-target'

function normalizeUrlForCompare(href) {
  try {
    const url = new URL(href, window.location.href)
    const path = url.pathname.endsWith('/') && url.pathname.length > 1
      ? url.pathname.slice(0, -1)
      : url.pathname
    return `${path}${url.search}${url.hash}`
  } catch {
    return ''
  }
}

function markHomePaginationIntent(href) {
  const key = normalizeUrlForCompare(href)
  if (!key) return
  try {
    sessionStorage.setItem(HOME_PAGINATE_FLAG_KEY, key)
  } catch {
    /* ignore */
  }
}

export function consumeHomePaginationIntent(href) {
  const key = normalizeUrlForCompare(href)
  if (!key) return false
  try {
    const stored = sessionStorage.getItem(HOME_PAGINATE_FLAG_KEY)
    if (!stored || stored !== key) return false
    sessionStorage.removeItem(HOME_PAGINATE_FLAG_KEY)
    return true
  } catch {
    return false
  }
}

export function isHomeListPath(href) {
  try {
    const path = normalizePath(new URL(href, window.location.href).pathname)
    return path === '/' || /^\/page\/\d+$/.test(path)
  } catch {
    return false
  }
}

function getHomeListScrollStorageKey(href) {
  const normalized = normalizeUrlForCompare(href)
  if (!normalized) return ''
  try {
    const url = new URL(href, window.location.href)
    return `${url.pathname.endsWith('/') && url.pathname.length > 1 ? url.pathname.slice(0, -1) : url.pathname}${url.search}`
  } catch {
    return ''
  }
}

function readHomeListScrollCache() {
  try {
    return JSON.parse(sessionStorage.getItem(HOME_LIST_SCROLL_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeHomeListScrollCache(cache) {
  try {
    sessionStorage.setItem(HOME_LIST_SCROLL_KEY, JSON.stringify(cache))
  } catch {
    /* ignore */
  }
}

function normalizeHomeListScrollEntry(entry) {
  if (typeof entry === 'number' && Number.isFinite(entry) && entry >= 0) {
    return { y: entry, timelineItems: 0, cardsItems: 0 }
  }
  if (!entry || typeof entry !== 'object') return null
  const y = entry.y
  if (typeof y !== 'number' || !Number.isFinite(y) || y < 0) return null
  const timelineItems = Number.parseInt(entry.timelineItems, 10)
  const cardsItems = Number.parseInt(entry.cardsItems, 10)
  return {
    y,
    timelineItems: Number.isFinite(timelineItems) && timelineItems > 0 ? timelineItems : 0,
    cardsItems: Number.isFinite(cardsItems) && cardsItems > 0 ? cardsItems : 0,
  }
}

export function saveHomeListScroll(href = window.location.href, extra = {}) {
  if (!isHomeListPath(href)) return
  const key = getHomeListScrollStorageKey(href)
  if (!key) return
  const cache = readHomeListScrollCache()
  cache[key] = {
    y: window.scrollY,
    timelineItems: Number.parseInt(extra.timelineItems, 10) || 0,
    cardsItems: Number.parseInt(extra.cardsItems, 10) || 0,
  }
  writeHomeListScrollCache(cache)
}

export function readHomeListScrollMeta(href) {
  if (!isHomeListPath(href)) return null
  const key = getHomeListScrollStorageKey(href)
  if (!key) return null
  return normalizeHomeListScrollEntry(readHomeListScrollCache()[key])
}

export function readHomeListScroll(href) {
  return readHomeListScrollMeta(href)?.y ?? null
}

export function pickHomeListScroll(href, historyScrollY = null) {
  const cached = readHomeListScrollMeta(href)
  const historyY = typeof historyScrollY === 'number' && Number.isFinite(historyScrollY) && historyScrollY >= 0
    ? historyScrollY
    : null

  if (cached && cached.y > 0) {
    if (historyY != null && historyY > cached.y) {
      return { y: historyY, timelineItems: cached.timelineItems, cardsItems: cached.cardsItems }
    }
    return cached
  }

  if (historyY != null && historyY > 0) {
    return { y: historyY, timelineItems: cached?.timelineItems ?? 0, cardsItems: cached?.cardsItems ?? 0 }
  }

  if (cached) return cached
  if (historyY != null) return { y: historyY, timelineItems: 0, cardsItems: 0 }
  return null
}

function persistCurrentScrollState(collectHomeListScrollExtra) {
  if (isHomeListPath(window.location.href)) {
    const extra = collectHomeListScrollExtra?.() ?? {}
    saveHomeListScroll(window.location.href, extra)
  }
  const state = { ...(history.state || {}), pjax: true, scrollY: window.scrollY }
  history.replaceState(state, '', window.location.href)
}

export function applyTargetScroll(scrollY) {
  const y = typeof scrollY === 'number' && scrollY >= 0 ? scrollY : 0
  window.scrollTo(0, y)
  document.documentElement.scrollTop = y
  document.body.scrollTop = y
}

function resetScroll() {
  applyTargetScroll(0)
}

function scheduleScrollAfterLayout(applyScroll) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const result = applyScroll()
      if (result instanceof Promise) {
        result.catch(() => {})
      }
    })
  })
}

async function runMountScroll(applyScroll) {
  const result = applyScroll()
  if (result instanceof Promise) await result
}

function fadeContent(contentEl, fadeMs, phase) {
  if (!contentEl || fadeMs <= 0) {
    contentEl?.classList.remove('is-pjax-leaving', 'is-pjax-entering', 'is-pjax-preparing')
    return Promise.resolve()
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    contentEl.classList.remove('is-pjax-leaving', 'is-pjax-entering', 'is-pjax-preparing')
    return Promise.resolve()
  }

  if (phase === 'leave') {
    contentEl.classList.remove('is-pjax-entering', 'is-pjax-preparing')
    contentEl.classList.add('is-pjax-leaving')
    return wait(fadeMs)
  }

  contentEl.classList.remove('is-pjax-leaving', 'is-pjax-preparing')
  contentEl.classList.add('is-pjax-entering')
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      contentEl.classList.remove('is-pjax-entering')
      window.setTimeout(resolve, fadeMs)
    })
  })
}

let activeNavigate = null
let pjaxContentMounting = false

export function isPjaxContentMounting() {
  return pjaxContentMounting
}

export function navigateToUrl(url, options) {
  if (activeNavigate) {
    activeNavigate(url, options)
    return
  }
  markSkipLoader()
  window.location.assign(url)
}

export function initPageNav({ mountPage, unmountPage, resolveScrollAfterMount, collectHomeListScrollExtra, onNavigateComplete }) {
  const config = readPjaxConfig()
  if (!config?.enabled) return

  const { fadeMs, mountDelayMs } = config
  let navigating = false
  let pendingNavigate = null

  const resolveMountScroll = (targetUrl, { scrollTop = true, scrollY = 0 } = {}) => {
    const custom = resolveScrollAfterMount?.(targetUrl, { scrollTop, scrollY })
    if (typeof custom === 'function') return custom
    if (scrollTop) return resetScroll
    return () => applyTargetScroll(scrollY)
  }

  const navigate = async (url, { push = true, scrollTop = true, scrollY = 0 } = {}) => {
    if (navigating) {
      pendingNavigate = { url, options: { push, scrollTop, scrollY } }
      return
    }

    const contentEl = document.getElementById('content')
    if (!contentEl) {
      markSkipLoader()
      window.location.assign(url)
      return
    }

    navigating = true
    showPjaxLoader()
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })

    try {
      markSkipLoader()
      closeMobileSidebar()
      document.dispatchEvent(new Event('sakura:close-search'))
      if (push) {
        persistCurrentScrollState(collectHomeListScrollExtra)
      }
      await fadeContent(contentEl, fadeMs, 'leave')

      const res = await fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'text/html' },
      })
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`)

      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const nextContent = doc.querySelector('#content')
      if (!nextContent) throw new Error('missing #content')

      unmountPage()
      contentEl.innerHTML = nextContent.innerHTML
      contentEl.classList.remove('is-pjax-leaving', 'is-pjax-entering')
      contentEl.classList.add('is-pjax-preparing')

      const title = doc.querySelector('title')?.textContent
      if (title) document.title = title

      syncHtmlClasses(doc.documentElement)
      syncHeadMeta(doc)
      appendHeadStyles(doc)
      await waitForPageStyles(doc)
      removeStaleHeadStyles(doc)

      if (push) {
        history.pushState({ pjax: true, scrollY: 0 }, '', url)
      }

      pjaxContentMounting = true
      window.__sakuraPjaxMounting = true
      mountPage()
      await awaitPageLazyModules()
      await waitForLayoutSettle(mountDelayMs)

      contentEl.classList.remove('is-pjax-preparing')

      const applyMountScroll = resolveMountScroll(url, { scrollTop, scrollY })
      await runMountScroll(applyMountScroll)
      scheduleScrollAfterLayout(applyMountScroll)

      await fadeContent(contentEl, fadeMs, 'enter')
      pjaxContentMounting = false
      window.__sakuraPjaxMounting = false
      window.dispatchEvent(new Event('sakura:page-content-visible'))
      void requestPageCommentsMount()
      await runMountScroll(applyMountScroll)
      scheduleScrollAfterLayout(() => {
        runMountScroll(applyMountScroll).then(() => onNavigateComplete?.())
      })
      window.dispatchEvent(new Event('scroll'))
    } catch {
      markSkipLoader()
      window.location.assign(url)
    } finally {
      hidePjaxLoader()
      pjaxContentMounting = false
      window.__sakuraPjaxMounting = false
      navigating = false
      const queued = pendingNavigate
      pendingNavigate = null
      if (queued) navigate(queued.url, queued.options)
    }
  }

  activeNavigate = navigate

  document.addEventListener('click', (event) => {
    const paginateLink = event.target.closest('a.page-number[href*="home-post-list"]')
    if (paginateLink?.href) markHomePaginationIntent(paginateLink.href)
  }, true)

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented) return
    if (event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const anchor = event.target.closest('a')
    if (!shouldHandleLink(anchor)) return

    event.preventDefault()
    navigate(anchor.href)
  }, true)

  window.addEventListener('popstate', (event) => {
    if (!event.state?.pjax) {
      window.location.reload()
      return
    }
    const picked = pickHomeListScroll(
      window.location.href,
      typeof event.state.scrollY === 'number' ? event.state.scrollY : null,
    )
    const targetScrollY = picked?.y ?? 0
    navigate(window.location.href, { push: false, scrollTop: false, scrollY: targetScrollY })
  })

  history.replaceState({ pjax: true, scrollY: window.scrollY }, '', window.location.href)

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a')
    if (!anchor || !shouldHandleLink(anchor)) return
    markSkipLoader()
  }, true)
}
