export const TWIKOO_COMMENT_PLACEHOLDER = '分享你的想法...'
export const WALINE_CLIENT_URL = 'https://unpkg.com/@waline/client@3.15.2/dist/waline.js'
export const TWIKOO_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/twikoo@1.7.12/dist/twikoo.all.min.js'

let twikooScriptPromise = null
let commentMountGeneration = 0
const walineInstances = new WeakMap()
const walinePaths = new WeakMap()
const walineRoots = new Set()
const walineEnhanceObservers = new WeakMap()
const WALINE_EXPAND_LABEL = '展开'
const WALINE_COLLAPSE_LABEL = '收起'
const WALINE_COLLAPSE_LINES = 5
let walineFetchHooked = false
const COMMENT_MOUNT_WAIT_MS = 4000
const twikooMountPromises = new Map()
const walineEnhanceTimers = new WeakMap()

function ensureWalineJsonRefPatch() {
  if (typeof window === 'undefined' || window.__sakuraWalineJsonRefPatch) return
  window.__sakuraWalineJsonRefPatch = true

  const nativeStringify = JSON.stringify
  JSON.stringify = function stringifyWithRefSupport(value, replacer, space) {
    if (value && typeof value === 'object' && value.__v_isRef === true) {
      return nativeStringify(value.value, replacer, space)
    }
    return nativeStringify(value, replacer, space)
  }
}

ensureWalineJsonRefPatch()

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function isCommentMountSurfaceVisible() {
  if (document.body.classList.contains('sakura-loading')) return false
  const content = document.getElementById('content')
  if (!content) return true
  if (content.classList.contains('is-pjax-leaving')) return false
  if (content.classList.contains('is-pjax-entering')) return false
  if (content.classList.contains('is-pjax-preparing')) return false
  return true
}

function waitForCommentMountSurface() {
  if (isCommentMountSurfaceVisible()) {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resolve)
      })
    })
  }

  return new Promise((resolve) => {
    let done = false
    const cleanup = () => {
      window.removeEventListener('sakura:page-content-visible', tryFinish)
      window.removeEventListener('load', tryFinish)
      clearTimeout(timer)
      observer.disconnect()
    }
    const finish = () => {
      if (done) return
      done = true
      cleanup()
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resolve)
      })
    }
    const tryFinish = () => {
      if (isCommentMountSurfaceVisible()) finish()
    }

    const observer = new MutationObserver(tryFinish)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    const content = document.getElementById('content')
    if (content) observer.observe(content, { attributes: true, attributeFilter: ['class'] })

    window.addEventListener('sakura:page-content-visible', tryFinish)
    window.addEventListener('load', tryFinish, { once: true })
    const timer = window.setTimeout(finish, COMMENT_MOUNT_WAIT_MS)
    tryFinish()
  })
}

function hasTwikooMarkup(root) {
  if (!root) return false
  return root.classList.contains('twikoo') || Boolean(root.querySelector('.twikoo'))
}

function hasWalineMarkup(root) {
  if (!root) return false
  return Boolean(root.querySelector('[data-waline], .waline, .wl-panel, .wl-count'))
}

export function normalizeCommentPath(path) {
  const raw = String(path || window.location.pathname || '/').trim()
  return raw.replace(/\/+$/, '') || '/'
}

function isWalineCommentSuccess(data) {
  if (!data || typeof data !== 'object') return false
  if (data.errno === 0) return true
  if (data.errmsg === 'success' || data.errMsg === 'success') return true
  if (data.data && (data.data.objectId || data.data.id)) return true
  return false
}

function syncWalineMetaPlaceholders(root) {
  if (!root) return
  root.querySelectorAll('.wl-header-item').forEach((item) => {
    const input = item.querySelector('input')
    const label = item.querySelector('label')
    if (!input || !label) return
    const text = label.textContent.trim()
    if (text) input.placeholder = text
  })
}

function isWalineContentLong(el) {
  const style = window.getComputedStyle(el)
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.7 || 24
  return el.scrollHeight > lineHeight * WALINE_COLLAPSE_LINES + 2
}

function setWalineContentCollapsed(el) {
  el.classList.add('expand')
  el.dataset.expand = WALINE_EXPAND_LABEL
  el.dataset.sakuraExpandState = 'collapsed'
  const toggle = el.nextElementSibling
  if (toggle?.classList?.contains('wl-content-toggle')) toggle.remove()
}

function ensureWalineCollapseToggle(el) {
  const existing = el.nextElementSibling
  if (existing?.classList?.contains('wl-content-toggle')) return existing

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'wl-content-toggle'
  btn.textContent = WALINE_COLLAPSE_LABEL
  btn.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    setWalineContentCollapsed(el)
  })
  el.insertAdjacentElement('afterend', btn)
  return btn
}

function setWalineContentExpanded(el) {
  el.classList.remove('expand')
  delete el.dataset.expand
  el.dataset.sakuraExpandState = 'expanded'
  ensureWalineCollapseToggle(el)
}

function applyWalineContentExpand(root) {
  if (!root) return
  root.querySelectorAll('.wl-card .wl-content').forEach((el) => {
    if (el.dataset.sakuraExpandState === 'expanded') {
      ensureWalineCollapseToggle(el)
      return
    }
    if (el.dataset.sakuraExpandState === 'collapsed' || el.classList.contains('expand')) return
    if (!isWalineContentLong(el)) return

    el.dataset.sakuraExpandable = '1'
    setWalineContentCollapsed(el)
  })
}

function enhanceWalineRoot(root) {
  if (!root?.isConnected) return
  syncWalineMetaPlaceholders(root)
  applyWalineContentExpand(root)
}

function scheduleWalineEnhance(root, delay = 0) {
  const run = () => enhanceWalineRoot(root)
  if (delay <= 0) {
    run()
    return
  }
  const prev = walineEnhanceTimers.get(root)
  if (prev) clearTimeout(prev)
  walineEnhanceTimers.set(root, window.setTimeout(() => {
    walineEnhanceTimers.delete(root)
    run()
  }, delay))
}

function bindWalineEnhancements(root) {
  if (!root || root.dataset.sakuraWalineEnhance === '1') return
  root.dataset.sakuraWalineEnhance = '1'

  root.addEventListener('click', (event) => {
    if (event.target.closest('.wl-content-toggle, .wl-admin-actions, .wl-comment-status, .wl-comment-actions, .wl-emoji-popup, .wl-gif-popup, .wl-actions')) return
    const content = event.target.closest('.wl-card .wl-content.expand')
    if (!content || !root.contains(content)) return
    if (event.target.closest('a')) return
    setWalineContentExpanded(content)
  })

  const observer = new MutationObserver((records) => {
    const shouldEnhance = records.some((record) => {
      if (record.type !== 'childList') return false
      const target = record.target
      if (!(target instanceof Element)) return false
      return target.closest('.wl-cards, .wl-header, .wl-comment, .wl-panel') != null
        || record.addedNodes.length > 0
    })
    if (shouldEnhance) scheduleWalineEnhance(root, 120)
  })
  observer.observe(root, { childList: true, subtree: true })
  walineEnhanceObservers.set(root, observer)
  scheduleWalineEnhance(root, 0)
}

function refreshWalineInstances() {
  walineRoots.forEach((root) => {
    if (!root.isConnected) {
      destroyWalineRoot(root)
      return
    }
    const instance = walineInstances.get(root)
    const path = walinePaths.get(root)
    if (!instance?.update || !path) return
    window.setTimeout(() => {
      try {
        instance.update({ path })
        scheduleWalineEnhance(root, 350)
      } catch (_) {
        /* ignore */
      }
    }, 300)
  })
}

function isWalineCommentPost(reqUrl, method) {
  if (method !== 'POST') return false
  const serverURL = getWalineServerURL()
  if (!serverURL) return false
  const base = serverURL.replace(/\/+$/, '')
  const apiBase = `${base}/api/`
  if (!reqUrl.startsWith(apiBase)) return false
  return /\/api\/comment(?:\?|$)/.test(reqUrl)
}

function ensureWalineFetchRefreshHook() {
  if (walineFetchHooked || typeof window === 'undefined') return
  if (!getWalineServerURL()) return
  walineFetchHooked = true

  const nativeFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const response = await nativeFetch(...args)
    try {
      const init = args[1] || {}
      const method = String(init.method || 'GET').toUpperCase()
      const reqUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
      if (!isWalineCommentPost(reqUrl, method)) return response

      response.clone().json().then((data) => {
        if (isWalineCommentSuccess(data)) refreshWalineInstances()
      }).catch(() => {
        /* ignore non-json responses */
      })
    } catch (_) {
      /* ignore hook errors */
    }
    return response
  }
}

function destroyWalineRoot(root) {
  if (!root) return
  const timer = walineEnhanceTimers.get(root)
  if (timer) {
    clearTimeout(timer)
    walineEnhanceTimers.delete(root)
  }
  const observer = walineEnhanceObservers.get(root)
  if (observer) {
    observer.disconnect()
    walineEnhanceObservers.delete(root)
  }
  delete root.dataset.sakuraWalineEnhance
  const instance = walineInstances.get(root)
  if (instance?.destroy) {
    try {
      instance.destroy()
    } catch (_) {
      /* ignore */
    }
  }
  walineInstances.delete(root)
  walinePaths.delete(root)
  walineRoots.delete(root)
}

export function loadTwikooScript() {
  if (window.twikoo?.init) return Promise.resolve(window.twikoo)
  if (twikooScriptPromise) return twikooScriptPromise

  twikooScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TWIKOO_SCRIPT_URL}"]`)
    if (existing) {
      if (window.twikoo?.init) {
        resolve(window.twikoo)
        return
      }
      existing.addEventListener('load', () => resolve(window.twikoo), { once: true })
      existing.addEventListener('error', () => reject(new Error('twikoo load failed')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = TWIKOO_SCRIPT_URL
    script.defer = true
    script.onload = () => resolve(window.twikoo)
    script.onerror = () => reject(new Error('twikoo load failed'))
    document.body.appendChild(script)
  })

  return twikooScriptPromise
}

function readMeta(name) {
  return (
    document.querySelector(`meta[name="${name}"]`)?.content
    || ''
  ).replace(/^["']|["']$/g, '').trim()
}

export function getCommentProvider() {
  return (
    document.getElementById('page-comment-section')?.dataset.commentProvider
    || readMeta('sakura-comment-provider')
    || 'twikoo'
  )
}

export function getTwikooEnvId() {
  return readMeta('sakura-twikoo-env') || String(window.SAKURA_TWIKOO_ENV || '').trim()
}

export function getWalineServerURL() {
  return readMeta('sakura-waline-server') || String(window.SAKURA_WALINE_SERVER || '').trim()
}

export function commentLoadingHtml(padding = '20px') {
  return `<p class="sakura-comment-loading" style="text-align:center;color:#888;padding:${padding};">加载中…</p>`
}

export function commentErrorHtml(message, padding = '20px') {
  return `<p class="sakura-comment-error" style="text-align:center;color:#888;padding:${padding};">${message}</p>`
}

export async function waitForTwikooInit() {
  try {
    await loadTwikooScript()
    return window.twikoo?.init ? window.twikoo : null
  } catch (_) {
    return null
  }
}

function commentRootSelector(root) {
  if (!root?.id) return null
  return `#${CSS.escape(root.id)}`
}

let pageCommentOptions = null
let inflightPageCommentMount = null
let pageCommentVisibleListenerBound = false

function bindPageCommentVisibleListener() {
  if (pageCommentVisibleListenerBound) return
  pageCommentVisibleListenerBound = true
  window.addEventListener('sakura:page-content-visible', () => {
    requestPageCommentsMount()
  })
}

export function requestPageCommentsMount() {
  if (!pageCommentOptions) return Promise.resolve()
  if (inflightPageCommentMount) return inflightPageCommentMount

  inflightPageCommentMount = mountPageCommentsNow(pageCommentOptions).finally(() => {
    inflightPageCommentMount = null
  })
  return inflightPageCommentMount
}

export function resetCommentRoot(root) {
  if (!root) return
  destroyWalineRoot(root)
  delete root.dataset.sakuraCommentMounted
  delete root.dataset.sakuraCommentPath
  root.replaceChildren()
}

export function cleanupPageComments() {
  inflightPageCommentMount = null
  twikooMountPromises.clear()
  commentMountGeneration += 1
  resetCommentRoot(document.getElementById('tcomment'))
  resetCommentRoot(document.getElementById('waline'))
  document.querySelectorAll('.moment-comment-root').forEach(resetCommentRoot)
  document.querySelectorAll('.moment-comment-panel').forEach((panel) => {
    delete panel.dataset.loaded
    panel.hidden = true
  })
  document.querySelectorAll('.moment-comment-toggle').forEach((toggle) => {
    toggle.classList.remove('is-active')
    toggle.setAttribute('aria-expanded', 'false')
  })
}

export async function mountTwikoo(root, { path, placeholder = TWIKOO_COMMENT_PLACEHOLDER, onReady } = {}) {
  const selector = commentRootSelector(root)
  if (!selector) {
    console.warn('[comments] twikoo root missing id')
    return false
  }
  if (!root.isConnected) return false

  const resolvedPath = normalizeCommentPath(path)
  if (root.dataset.sakuraCommentMounted === '1' && root.dataset.sakuraCommentPath === resolvedPath) {
    onReady?.()
    return true
  }
  if (hasTwikooMarkup(root) && root.dataset.sakuraCommentPath === resolvedPath) {
    root.dataset.sakuraCommentMounted = '1'
    onReady?.()
    return true
  }

  delete root.dataset.sakuraCommentMounted
  delete root.dataset.sakuraCommentPath

  const inflightKey = root.id || selector
  if (twikooMountPromises.has(inflightKey)) {
    return twikooMountPromises.get(inflightKey)
  }

  const generation = commentMountGeneration
  const envId = getTwikooEnvId()
  if (!envId) {
    root.innerHTML = commentErrorHtml('Twikoo 评论尚未配置，请在 hugo.toml 的 <code>params.twikoo.envId</code> 中填写环境 ID。')
    return false
  }

  root.innerHTML = commentLoadingHtml(root.classList.contains('moment-comment-root') ? '16px 0' : '20px')

  const promise = (async () => {
    try {
      const twikoo = await waitForTwikooInit()
      if (generation !== commentMountGeneration || !root.isConnected) return false
      if (!twikoo?.init) {
        root.innerHTML = commentErrorHtml('评论组件加载失败，请检查网络或 Twikoo CDN 是否可访问。')
        return false
      }

      await twikoo.init({
        envId,
        el: selector,
        path: resolvedPath,
        lang: 'zh-CN',
        placeholder,
      })
      if (generation !== commentMountGeneration || !root.isConnected) return false

      root.dataset.sakuraCommentMounted = '1'
      root.dataset.sakuraCommentPath = resolvedPath
      onReady?.()
      window.dispatchEvent(new CustomEvent('sakura:twikoo-mounted'))
      return true
    } catch (error) {
      if (generation !== commentMountGeneration || !root.isConnected) return false
      console.error('[twikoo]', error)
      root.innerHTML = commentErrorHtml('评论加载失败，请稍后刷新重试。')
      return false
    }
  })().finally(() => {
    twikooMountPromises.delete(inflightKey)
  })

  twikooMountPromises.set(inflightKey, promise)
  return promise
}

export async function mountWaline(root, { path, placeholder = TWIKOO_COMMENT_PLACEHOLDER } = {}) {
  const selector = commentRootSelector(root)
  if (!selector) {
    console.warn('[comments] waline root missing id')
    return false
  }
  if (!root.isConnected) return false

  const resolvedPath = normalizeCommentPath(path)
  if (root.dataset.sakuraCommentMounted === '1' && root.dataset.sakuraCommentPath === resolvedPath) {
    bindWalineEnhancements(root)
    scheduleWalineEnhance(root, 100)
    return true
  }
  if (hasWalineMarkup(root) && root.dataset.sakuraCommentPath === resolvedPath) {
    root.dataset.sakuraCommentMounted = '1'
    bindWalineEnhancements(root)
    scheduleWalineEnhance(root, 100)
    return true
  }

  delete root.dataset.sakuraCommentMounted
  delete root.dataset.sakuraCommentPath

  const generation = commentMountGeneration
  const serverURL = getWalineServerURL()
  if (!serverURL) {
    root.innerHTML = commentErrorHtml('Waline 评论尚未配置，请在 hugo.toml 的 <code>params.waline.serverURL</code> 中填写服务端地址。')
    return false
  }

  root.innerHTML = commentLoadingHtml(root.classList.contains('moment-comment-root') ? '16px 0' : '20px')

  try {
    ensureWalineFetchRefreshHook()
    const { init } = await import(WALINE_CLIENT_URL)
    if (generation !== commentMountGeneration || !root.isConnected) return false
    const resolvedPath = normalizeCommentPath(path)
    const instance = init({
      el: selector,
      serverURL,
      path: resolvedPath,
      lang: 'zh-CN',
      placeholder,
      dark: 'html.dark',
      emoji: true,
    })
    if (generation !== commentMountGeneration || !root.isConnected) {
      if (instance?.destroy) {
        try { instance.destroy() } catch (_) { /* ignore */ }
      }
      return false
    }
    if (!instance) {
      root.innerHTML = commentErrorHtml('评论组件初始化失败。')
      return false
    }
    walineInstances.set(root, instance)
    walinePaths.set(root, resolvedPath)
    walineRoots.add(root)
    root.dataset.sakuraCommentMounted = '1'
    root.dataset.sakuraCommentPath = resolvedPath
    bindWalineEnhancements(root)
    scheduleWalineEnhance(root, 100)
    scheduleWalineEnhance(root, 600)
    return true
  } catch (error) {
    if (generation !== commentMountGeneration || !root.isConnected) return false
    console.error('[waline]', error)
    root.innerHTML = commentErrorHtml('评论加载失败，请检查网络或 Waline 服务端是否可访问。')
    return false
  }
}

export async function mountCommentRoot(root, { provider, path, placeholder, onReady } = {}) {
  if (!root) return false
  const resolvedProvider = provider || getCommentProvider()
  const resolvedPath = normalizeCommentPath(path)
  if (resolvedProvider === 'twikoo') {
    return mountTwikoo(root, { path: resolvedPath, placeholder, onReady })
  }
  return mountWaline(root, { path: resolvedPath, placeholder })
}

async function mountPageCommentsNow({ onTwikooReady } = {}) {
  await waitForCommentMountSurface()

  const section = document.getElementById('page-comment-section')
  if (!section) return

  const provider = section.dataset.commentProvider || getCommentProvider()
  const path = normalizeCommentPath(window.location.pathname)

  if (provider === 'twikoo') {
    const root = document.getElementById('tcomment')
    if (!root) return
    await mountTwikoo(root, {
      path,
      placeholder: TWIKOO_COMMENT_PLACEHOLDER,
      onReady: onTwikooReady,
    })
    return
  }

  const root = document.getElementById('waline')
  if (!root) return
  await mountWaline(root, {
    path,
    placeholder: root.dataset.placeholder || TWIKOO_COMMENT_PLACEHOLDER,
  })
}

export function initPageComments(options = {}) {
  pageCommentOptions = options

  if (window.__sakuraPjaxMounting) return
  if (document.body.classList.contains('sakura-loading')) return
  if (document.getElementById('page-comment-section') && isCommentMountSurfaceVisible()) {
    requestPageCommentsMount()
  }
}

bindPageCommentVisibleListener()

export async function mountMomentCommentPanel(panel) {
  const root = panel.querySelector('.moment-comment-root')
  if (!root) return false

  const provider = panel.dataset.commentProvider || getCommentProvider()
  const path = panel.dataset.commentPath || window.location.pathname
  const placeholder = root.dataset.placeholder || TWIKOO_COMMENT_PLACEHOLDER

  return mountCommentRoot(root, { provider, path, placeholder })
}
