
import { registerPageCleanup } from './page-cleanup.js'
import { cancelTypeWriter, typeWriter } from './typewriter.js'
import { getNavbarLayoutOffset } from './navbar.js'

const heroMedia = {
  urls: [],
  currentIndex: 0,
  transitioning: false,
  playerActive: false,
  resumeIndex: 0,
}

function parseHeroUrls() {
  const dataEl = document.getElementById('hero-urls-data')
  if (!dataEl) return []
  try {
    const raw = JSON.parse(dataEl.textContent || '[]')
    const urls = typeof raw === 'string' ? JSON.parse(raw) : raw
    return urls.map((u) => {
      if (/^https?:\/\//i.test(u)) return u
      try { return new URL(u, window.location.origin).href } catch (_) { return u }
    })
  } catch (_) {
    return []
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function waitTransition(el) {
  return new Promise((resolve) => {
    const done = () => resolve()
    el.addEventListener('transitionend', done, { once: true })
    setTimeout(done, 1100)
  })
}

async function waitHeroMediaReady(el) {
  if (!el) return
  if (el.tagName === 'VIDEO') {
    await new Promise((resolve) => {
      if (el.readyState >= 2) {
        resolve()
        return
      }
      el.addEventListener('loadeddata', () => resolve(), { once: true })
      el.addEventListener('error', () => resolve(), { once: true })
    })
    return
  }
  if (el.tagName === 'IMG') {
    await new Promise((resolve) => {
      if (el.complete && el.naturalWidth > 0) {
        resolve()
        return
      }
      el.addEventListener('load', () => resolve(), { once: true })
      el.addEventListener('error', () => resolve(), { once: true })
    })
    if (el.decode) {
      try { await el.decode() } catch (_) { /* ignore decode errors */ }
    }
  }
}

function resolveHeroUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  try { return new URL(url, window.location.origin).href } catch (_) { return url }
}

function buildHeroMediaItem(url, options = {}) {
  const { loop = true, muted = true, playerMode = false } = options
  const isVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url)
  let el
  if (isVideo) {
    el = document.createElement('video')
    el.className = 'sakura-hero-media-item sakura-hero__video'
    if (playerMode) el.classList.add('sakura-hero__video--player')
    el.src = url
    el.autoplay = true
    el.loop = loop
    el.muted = muted
    el.playsInline = true
    el.setAttribute('playsinline', '')
    el.setAttribute('webkit-playsinline', '')
    if (muted) el.setAttribute('muted', '')
    if (playerMode) {
      el.addEventListener('ended', () => { stopHeroPlayer() })
    }
  } else {
    el = document.createElement('img')
    el.className = 'sakura-hero-media-item sakura-hero-background-img'
    el.src = url
    el.alt = ''
    el.decoding = 'async'
    el.loading = 'eager'
    el.fetchPriority = 'high'
    el.addEventListener('error', () => el.classList.add('is-error'), { once: true })
  }
  el.setAttribute('aria-hidden', 'true')
  return el
}

function setHeroPlayerUi(active) {
  const hero = document.getElementById('hero')
  const navbar = document.getElementById('navbar')
  const mediaWrap = hero?.querySelector('.sakura-hero__media')
  const icon = document.getElementById('hero-player-icon')
  const fadeTargets = [
    hero?.querySelector('.sakura-hero__content'),
    hero?.querySelector('.sakura-hero__scroll'),
    hero?.querySelector('.sakura-hero__waves'),
  ].filter(Boolean)

  hero?.classList.toggle('is-player-active', active)
  mediaWrap?.classList.toggle('is-player-active', active)

  navbar?.classList.toggle('sakura-fade-out-up', active)
  navbar?.classList.toggle('sakura-fade-in-down', !active)

  fadeTargets.forEach((el) => {
    el.classList.toggle('sakura-fade-out-down', active)
    el.classList.toggle('sakura-fade-in-up', !active)
  })

  if (icon) {
    icon.src = active ? (icon.dataset.pauseSrc || icon.src) : (icon.dataset.playSrc || icon.src)
  }
  document.getElementById('hero-player-btn')?.setAttribute('aria-label', active ? '暂停视频' : '播放视频')
}

async function showHeroPlayerVideo(url) {
  const stage = document.getElementById('hero-media-stage')
  if (!stage || !url) return

  const item = buildHeroMediaItem(url, { loop: false, muted: false, playerMode: true })
  item.classList.add('is-current', 'hero-fade-enter-active', 'hero-fade-enter-from')
  stage.replaceChildren(item)
  await waitHeroMediaReady(item)

  await wait(20)
  item.classList.remove('hero-fade-enter-from')
  item.classList.add('hero-fade-enter-to')
  await wait(500)
  settleHeroMediaItem(item)

  try { await item.play() } catch (_) { /* ignore autoplay errors */ }
}

async function stopHeroPlayer() {
  if (!heroMedia.playerActive) return

  heroMedia.playerActive = false
  document.getElementById('hero-media-stage')?.querySelector('video')?.pause()
  setHeroPlayerUi(false)

  if (!heroMedia.urls.length) return

  heroMedia.transitioning = true
  try {
    await showInitialHeroMedia(heroMedia.urls[heroMedia.resumeIndex])
    heroMedia.currentIndex = heroMedia.resumeIndex
  } finally {
    heroMedia.transitioning = false
  }
}

async function startHeroPlayer() {
  const btn = document.getElementById('hero-player-btn')
  const playerUrl = resolveHeroUrl(btn?.dataset.playerUrl)
  if (!playerUrl || heroMedia.playerActive || heroMedia.transitioning) return

  heroMedia.playerActive = true
  heroMedia.resumeIndex = heroMedia.currentIndex
  setHeroPlayerUi(true)
  await showHeroPlayerVideo(playerUrl)
}

function toggleHeroPlayer() {
  if (heroMedia.playerActive) stopHeroPlayer()
  else startHeroPlayer()
}

function initHeroPlayer() {
  const btn = document.getElementById('hero-player-btn')
  if (!btn?.dataset.playerUrl) return
  btn.addEventListener('click', () => toggleHeroPlayer())
}

function settleHeroMediaItem(el) {
  el.classList.remove('hero-fade-enter-active', 'hero-fade-enter-from', 'hero-fade-enter-to')
  el.style.transform = ''
  el.style.opacity = ''
}

async function showInitialHeroMedia(url) {
  const stage = document.getElementById('hero-media-stage')
  if (!stage || !url) return

  const item = buildHeroMediaItem(url)
  item.classList.add('is-current', 'hero-fade-enter-active', 'hero-fade-enter-from')
  stage.replaceChildren(item)
  await waitHeroMediaReady(item)

  await wait(20)
  item.classList.remove('hero-fade-enter-from')
  item.classList.add('hero-fade-enter-to')
  await wait(500)
  settleHeroMediaItem(item)
}

async function slideHeroMedia(fromUrl, toUrl, direction) {
  const stage = document.getElementById('hero-media-stage')
  if (!stage || !fromUrl || !toUrl) return

  const outgoing = buildHeroMediaItem(fromUrl)
  const incoming = buildHeroMediaItem(toUrl)
  await waitHeroMediaReady(incoming)
  const track = document.createElement('div')
  track.className = 'sakura-hero-media-track'

  if (direction === 'next') {
    track.append(outgoing, incoming)
    track.style.transform = 'translateX(0)'
  } else {
    track.append(incoming, outgoing)
    track.style.transform = 'translateX(-50%)'
  }

  stage.replaceChildren(track)
  await wait(20)

  if (direction === 'next') {
    track.style.transform = 'translateX(-50%)'
  } else {
    track.style.transform = 'translateX(0)'
  }

  await waitTransition(track)

  incoming.classList.add('is-current')
  settleHeroMediaItem(incoming)
  stage.replaceChildren(incoming)
}

export function initHeroMedia() {
  const media = document.getElementById('hero-media')
  const urls = parseHeroUrls()
  if (!media || !urls.length) return
  if (media.dataset.mediaReady === '1') return
  media.dataset.mediaReady = '1'

  heroMedia.urls = urls
  const imageUrls = urls.filter((url) => !/\.(mp4|webm|ogg)(\?.*)?$/i.test(url))
  const initialPool = imageUrls.length ? imageUrls : urls
  heroMedia.currentIndex = urls.indexOf(initialPool[Math.floor(Math.random() * initialPool.length)])
  if (heroMedia.currentIndex < 0) heroMedia.currentIndex = 0

  const show = async (direction) => {
    if (heroMedia.transitioning || heroMedia.playerActive) return
    heroMedia.transitioning = true
    try {
      if (direction === 'fade') {
        await showInitialHeroMedia(urls[heroMedia.currentIndex])
        return
      }

      const targetIndex = direction === 'next'
        ? (heroMedia.currentIndex + 1) % urls.length
        : (heroMedia.currentIndex - 1 + urls.length) % urls.length

      await slideHeroMedia(urls[heroMedia.currentIndex], urls[targetIndex], direction)
      heroMedia.currentIndex = targetIndex
    } finally {
      heroMedia.transitioning = false
    }
  }

  show('fade')

  const len = urls.length
  const cur = heroMedia.currentIndex
  const adjacent = new Set([
    (cur + 1) % len,
    (cur - 1 + len) % len,
  ])

  const prefetchHeroImage = (url) => {
    if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) return
    const img = new Image()
    img.decoding = 'async'
    img.src = url
  }

  adjacent.forEach((index) => prefetchHeroImage(urls[index]))

  const prefetchRemainingHeroUrls = () => {
    urls.forEach((url, index) => {
      if (index === cur || adjacent.has(index)) return
      prefetchHeroImage(url)
    })
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(prefetchRemainingHeroUrls, { timeout: 8000 })
  } else {
    window.setTimeout(prefetchRemainingHeroUrls, 3000)
  }

  const prev = document.getElementById('hero-media-prev')
  const next = document.getElementById('hero-media-next')
  prev?.addEventListener('click', () => show('prev'))
  next?.addEventListener('click', () => show('next'))
  prev?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); prev.click() }
  })
  next?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next.click() }
  })

  initHeroPlayer()
}

const HITOKOTO_CACHE_KEY = 'sakura-hitokoto'
const HITOKOTO_CACHE_TTL = 30 * 60 * 1000

async function fetchHitokotoText() {
  try {
    const cached = sessionStorage.getItem(HITOKOTO_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed?.text && Date.now() - (parsed.ts || 0) < HITOKOTO_CACHE_TTL) {
        return parsed.text
      }
    }
  } catch (_) { /* ignore cache errors */ }

  const res = await fetch('https://v1.hitokoto.cn/?encode=json', { cache: 'no-store' })
  if (!res.ok) throw new Error('hitokoto failed')
  const data = await res.json()
  if (!data?.hitokoto) throw new Error('hitokoto empty')

  try {
    sessionStorage.setItem(HITOKOTO_CACHE_KEY, JSON.stringify({ text: data.hitokoto, ts: Date.now() }))
  } catch (_) { /* ignore cache errors */ }

  return data.hitokoto
}

export async function initHeroHitokoto() {
  const el = document.getElementById('hero-hitokoto')
  if (!el) return

  registerPageCleanup(cancelTypeWriter)

  const fallback = el.dataset.fallback || ''
  const enableHitokoto = el.dataset.enableHitokoto !== 'false'
  const useTypewriter = el.dataset.typewriter !== 'false'
  const speed = Number(el.dataset.speed || 80)

  let text = fallback
  if (enableHitokoto) {
    try {
      text = await fetchHitokotoText()
    } catch (_) {
      text = fallback
    }
  }

  if (useTypewriter) {
    await typeWriter(el, text, speed)
  } else {
    el.textContent = text
  }
}

export function bindHeroScrollDown() {
  const btn = document.getElementById('hero-scroll-down')
  if (!btn || btn.dataset.bound === '1') return
  btn.dataset.bound = '1'
  btn.addEventListener('click', scrollPastHero)
}

export function scrollPastHero() {
  const hero = document.getElementById('hero')
  const target = document.getElementById('home-posts')
  if (!hero && !target) return

  const navHeight = getNavbarLayoutOffset()
  const top = target
    ? target.getBoundingClientRect().top + window.scrollY - navHeight
    : Math.max(0, hero.getBoundingClientRect().bottom + window.scrollY - navHeight)

  window.scrollTo({ top, behavior: 'smooth' })
}

export function cleanupHero() {
  stopHeroPlayer()
  heroMedia.transitioning = false
  heroMedia.playerActive = false
  heroMedia.currentIndex = 0
  heroMedia.urls = []
}
