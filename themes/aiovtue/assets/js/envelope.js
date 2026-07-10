
import { loadTwikooScript } from './comments.js'
import { registerPageCleanup } from './page-cleanup.js'
import { stripHtml } from './utils.js'

const ENVELOPE_DANMAKU_DESKTOP_MQ = '(min-width: 601px)'

function isEnvelopeDanmakuDesktop() {
  return window.matchMedia(ENVELOPE_DANMAKU_DESKTOP_MQ).matches
}

let envelopeDanmakuComments = null
let envelopeDanmakuRunning = false

function clearEnvelopeDanmakuBounds() {
  const danmaku = document.querySelector('.envelope-maincontent > .envelope-danmaku')
  if (!danmaku) return
  danmaku.style.top = ''
  danmaku.style.height = ''
  danmaku.querySelector('.envelope-danmaku__screen')?.replaceChildren()
  envelopeDanmakuRunning = false
}

let envelopeDanmakuMqBound = false

export function initEnvelope() {
  const envelope = document.getElementById('envelope-wrap')
  if (!envelope) return

  const scrollCloseTop = 80
  let scrollRaf = 0

  const isOpened = () => envelope.classList.contains('opened')
  const open = () => envelope.classList.add('opened')
  const close = () => envelope.classList.remove('opened')

  const getScrollTop = () => window.pageYOffset
    || document.documentElement.scrollTop
    || document.body.scrollTop
    || 0

  const isEnvelopeFullyVisible = () => {
    if (isOpened()) return false
    const rect = envelope.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return false
    return rect.top >= 0 && rect.bottom <= window.innerHeight + 1
  }

  const updateEnvelopeByScroll = () => {
    if (!isEnvelopeDanmakuDesktop()) return
    if (isEnvelopeFullyVisible()) {
      open()
      return
    }
    if (isOpened() && getScrollTop() <= scrollCloseTop) close()
  }

  const handleScroll = () => {
    if (scrollRaf) return
    scrollRaf = window.requestAnimationFrame(() => {
      scrollRaf = 0
      updateEnvelopeByScroll()
      syncEnvelopeDanmakuBounds()
    })
  }

  const handleResize = () => {
    handleScroll()
    syncEnvelopeDanmakuBounds()
  }

  const onEnvelopeClick = () => {
    if (!isEnvelopeDanmakuDesktop()) return
    if (!isOpened()) open()
  }

  envelope.addEventListener('click', onEnvelopeClick)
  envelope.addEventListener('transitionend', syncEnvelopeDanmakuBounds)
  window.addEventListener('scroll', handleScroll, { passive: true })
  window.addEventListener('resize', handleResize)

  updateEnvelopeByScroll()
  syncEnvelopeDanmakuBounds()

  registerPageCleanup(() => {
    envelope.removeEventListener('click', onEnvelopeClick)
    envelope.removeEventListener('transitionend', syncEnvelopeDanmakuBounds)
    window.removeEventListener('scroll', handleScroll)
    window.removeEventListener('resize', handleResize)
    clearEnvelopeDanmakuBounds()
    envelopeDanmakuComments = null
    envelopeDanmakuRunning = false
  })
}

function getEnvelopeDanmakuTrim() {
  const main = document.querySelector('.envelope-maincontent')
  if (!main) return 140
  const raw = getComputedStyle(main).getPropertyValue('--danmaku-open-bottom-trim').trim()
  const trim = Number.parseFloat(raw)
  return Number.isFinite(trim) && trim > 0 ? trim : 140
}

function getEnvelopeDanmakuTravelWidth(screen) {
  return screen?.clientWidth || document.documentElement.clientWidth
}

function syncEnvelopeDanmakuBounds() {
  if (!isEnvelopeDanmakuDesktop()) return

  const wrap = document.getElementById('envelope-wrap')
  const main = document.querySelector('.envelope-maincontent')
  const danmaku = document.querySelector('.envelope-maincontent > .envelope-danmaku')
  if (!wrap || !main || !danmaku) return

  const wrapRect = wrap.getBoundingClientRect()
  const mainRect = main.getBoundingClientRect()
  if (wrapRect.width === 0 || wrapRect.height === 0) return

  const top = Math.max(wrapRect.top, mainRect.top)
  let height = wrapRect.bottom - top

  if (wrap.classList.contains('opened')) {
    height = Math.max(0, height - getEnvelopeDanmakuTrim())
  }

  danmaku.style.top = `${top}px`
  danmaku.style.height = `${height}px`
  tryStartEnvelopeDanmaku()
}

function tryStartEnvelopeDanmaku() {
  if (!isEnvelopeDanmakuDesktop()) return
  if (envelopeDanmakuRunning) return
  if (!Array.isArray(envelopeDanmakuComments) || !envelopeDanmakuComments.length) return

  const screen = document.querySelector('.envelope-maincontent > .envelope-danmaku .envelope-danmaku__screen')
  if (!screen || screen.clientHeight < 24) return

  envelopeDanmakuRunning = true
  startEnvelopeDanmaku(screen, envelopeDanmakuComments)
}

function bindEnvelopeDanmakuBounds() {
  const danmaku = document.querySelector('.envelope-maincontent > .envelope-danmaku')
  if (!danmaku) return

  const sync = () => syncEnvelopeDanmakuBounds()
  sync()

  const wrap = document.getElementById('envelope-wrap')
  wrap?.addEventListener('transitionend', sync)

  let resizeObserver = null
  if (wrap && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(sync)
    resizeObserver.observe(wrap)
  }

  registerPageCleanup(() => {
    wrap?.removeEventListener('transitionend', sync)
    resizeObserver?.disconnect()
  })
}

function bindEnvelopeDanmakuViewport() {
  if (envelopeDanmakuMqBound) return
  envelopeDanmakuMqBound = true

  window.matchMedia(ENVELOPE_DANMAKU_DESKTOP_MQ).addEventListener('change', (event) => {
    if (event.matches) initEnvelopeDanmaku()
    else clearEnvelopeDanmakuBounds()
  })
}

async function waitForTwikooApi() {
  try {
    const twikoo = await loadTwikooScript()
    return twikoo?.getRecentComments ? twikoo : null
  } catch {
    return null
  }
}

function flattenTwikooComments(items) {
  const out = []
  const walk = (list) => {
    list.forEach((item) => {
      out.push(item)
      if (Array.isArray(item.replies) && item.replies.length) walk(item.replies)
    })
  }
  walk(items)
  return out
}

async function fetchTwikooDanmakuComments(path) {
  const envId = (
    document.querySelector('meta[name="sakura-twikoo-env"]')?.content
    || String(window.SAKURA_TWIKOO_ENV || '')
  ).replace(/^["']|["']$/g, '').trim()
  if (!envId) return []

  const twikoo = await waitForTwikooApi()
  if (twikoo?.getRecentComments) {
    try {
      const res = await twikoo.getRecentComments({
        envId,
        urls: [path],
        pageSize: 50,
        includeReply: true,
      })
      if (Array.isArray(res) && res.length) return res
    } catch (err) {
      console.warn('[envelope-danmaku]', err)
    }
  }

  if (!envId.startsWith('http')) return []

  try {
    const res = await fetch(envId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'COMMENT_GET', url: path, sort: 'newest' }),
    })
    const data = await res.json()
    if (Array.isArray(data?.data) && data.data.length) return flattenTwikooComments(data.data)
  } catch (err) {
    console.warn('[envelope-danmaku]', err)
  }

  return []
}

function flattenWalineComments(items) {
  const out = []
  const walk = (list) => {
    if (!Array.isArray(list)) return
    list.forEach((item) => {
      out.push(item)
      if (Array.isArray(item.children) && item.children.length) walk(item.children)
    })
  }
  walk(items)
  return out
}

function getWalineDanmakuText(item) {
  const fromOrig = String(item?.orig || '').trim()
  if (fromOrig) return fromOrig

  const html = String(item?.comment || '')
  const text = stripHtml(html).trim()
  if (text) return text

  const tmp = document.createElement('div')
  tmp.innerHTML = html
  const emojiAlt = tmp.querySelector('img[alt]')?.getAttribute('alt')?.trim()
  return emojiAlt || ''
}

async function fetchWalineDanmakuComments(path) {
  const serverURL = (
    document.querySelector('meta[name="sakura-waline-server"]')?.content
    || String(window.SAKURA_WALINE_SERVER || '')
  ).replace(/^["']|["']$/g, '').trim()
  if (!serverURL) return []

  const base = serverURL.replace(/\/+$/, '')
  const normalizedPath = String(path || window.location.pathname || '/').replace(/\/+$/, '') || '/'
  const query = new URLSearchParams({
    path: normalizedPath,
    pageSize: '50',
    page: '1',
    lang: 'zh-CN',
    sortBy: 'latest',
  })

  try {
    const res = await fetch(`${base}/api/comment?${query.toString()}`)
    const payload = await res.json()
    const list = payload?.data?.data
    if (!Array.isArray(list)) return []
    return flattenWalineComments(list).map((item) => ({
      nick: item.nick,
      avatar: item.avatar,
      commentText: getWalineDanmakuText(item),
    })).filter((item) => item.commentText)
  } catch (err) {
    console.warn('[envelope-danmaku]', err)
    return []
  }
}

const ENVELOPE_DANMAKU_GAP = 14

function buildEnvelopeDanmakuElement(comment) {
  const text = stripHtml(comment.commentText || comment.comment || '').trim()
  if (!text) return null

  const nick = comment.nick || '访客'
  const displayText = text.length > 42 ? `${text.slice(0, 42)}…` : text
  const item = document.createElement('div')
  item.className = 'envelope-danmaku__item'

  if (comment.avatar) {
    const img = document.createElement('img')
    img.src = comment.avatar
    img.alt = ''
    img.loading = 'lazy'
    img.decoding = 'async'
    item.appendChild(img)
  }

  const body = document.createElement('span')
  body.className = 'envelope-danmaku__body'
  body.textContent = `${nick}: ${displayText}`
  item.appendChild(body)

  return item
}

function getEnvelopeDanmakuLaneDelay(last, newWidth, newSpeed, containerWidth) {
  if (!last) return 0

  const nowSec = performance.now() / 1000
  const elapsed = nowSec - last.startSec
  const lastRight = last.startX + last.width + last.speed * elapsed

  if (lastRight >= containerWidth) return 0

  let delay = 0
  if (lastRight + ENVELOPE_DANMAKU_GAP > -newWidth) {
    delay = (lastRight + ENVELOPE_DANMAKU_GAP + newWidth) / last.speed
  }

  const lastRightAtSpawn = last.startX + last.width + last.speed * (elapsed + delay)
  if (newSpeed > last.speed && lastRightAtSpawn < containerWidth) {
    const exitTime = Math.max(0, (containerWidth - lastRightAtSpawn) / last.speed)
    const minSep = (newSpeed - last.speed) * exitTime + ENVELOPE_DANMAKU_GAP
    const neededRight = -newWidth - minSep
    if (lastRightAtSpawn > neededRight) {
      delay += (lastRightAtSpawn - neededRight) / last.speed
    }
  }

  return delay
}

function spawnEnvelopeDanmakuItem(screen, item, lane, laneCount, speed, onFinish) {
  screen.appendChild(item)

  const laneHeight = screen.clientHeight / laneCount
  item.style.top = `${lane * laneHeight + Math.max(0, (laneHeight - 24) / 2)}px`

  const containerWidth = getEnvelopeDanmakuTravelWidth(screen)
  const itemWidth = item.offsetWidth
  const duration = ((containerWidth + itemWidth) / speed) * 1000

  item.style.transform = `translateX(${-itemWidth}px)`
  item.animate([
    { transform: `translateX(${-itemWidth}px)` },
    { transform: `translateX(${containerWidth}px)` },
  ], { duration, easing: 'linear', fill: 'forwards' }).onfinish = () => {
    item.remove()
    onFinish?.()
  }

  return {
    duration,
    track: {
      startSec: performance.now() / 1000,
      startX: -itemWidth,
      width: itemWidth,
      speed,
    },
  }
}

function measureEnvelopeDanmakuItem(screen, comment) {
  const item = buildEnvelopeDanmakuElement(comment)
  if (!item) return null

  item.style.visibility = 'hidden'
  item.style.pointerEvents = 'none'
  screen.appendChild(item)
  const width = item.offsetWidth
  screen.removeChild(item)
  return width
}

function startEnvelopeDanmaku(screen, comments) {
  const usable = comments.filter((comment) => stripHtml(comment.commentText || comment.comment || '').trim())
  if (!usable.length || screen.clientHeight < 24) return

  const laneCount = Math.min(5, Math.max(1, Math.floor(screen.clientHeight / 28)))
  const lanes = Array(laneCount).fill(null)
  let cursor = 0

  const nextComment = () => {
    const comment = usable[cursor % usable.length]
    cursor += 1
    return comment
  }

  const scheduleLane = (lane) => {
    if (!screen.isConnected) return

    const comment = nextComment()
    const itemWidth = measureEnvelopeDanmakuItem(screen, comment)
    if (!itemWidth) {
      scheduleLane(lane)
      return
    }

    const speed = 55 + Math.random() * 35
    const containerWidth = getEnvelopeDanmakuTravelWidth(screen)
    const delaySec = getEnvelopeDanmakuLaneDelay(lanes[lane], itemWidth, speed, containerWidth)

    window.setTimeout(() => {
      if (!screen.isConnected) return
      const freshItem = buildEnvelopeDanmakuElement(comment)
      if (!freshItem) {
        scheduleLane(lane)
        return
      }

      let activeTrack = null
      const { track } = spawnEnvelopeDanmakuItem(screen, freshItem, lane, laneCount, speed, () => {
        if (lanes[lane] === activeTrack) lanes[lane] = null
      })
      activeTrack = track
      lanes[lane] = track
      scheduleLane(lane)
    }, Math.max(0, delaySec * 1000))
  }

  for (let lane = 0; lane < laneCount; lane += 1) {
    window.setTimeout(() => scheduleLane(lane), lane * 320)
  }
}

export async function initEnvelopeDanmaku() {
  bindEnvelopeDanmakuViewport()

  if (!isEnvelopeDanmakuDesktop()) return

  const screen = document.querySelector('.envelope-maincontent > .envelope-danmaku .envelope-danmaku__screen')
  if (!screen) return

  bindEnvelopeDanmakuBounds()
  syncEnvelopeDanmakuBounds()

  if (envelopeDanmakuComments === null) {
    const path = window.location.pathname
    const provider = document.querySelector('.sakura-comment')?.dataset.commentProvider || 'waline'

    let comments = []
    try {
      comments = provider === 'twikoo'
        ? await fetchTwikooDanmakuComments(path)
        : await fetchWalineDanmakuComments(path)
    } catch (err) {
      console.warn('[envelope-danmaku]', err)
    }
    envelopeDanmakuComments = comments
  }

  syncEnvelopeDanmakuBounds()
  if (!envelopeDanmakuComments.length) return
  tryStartEnvelopeDanmaku()
}
