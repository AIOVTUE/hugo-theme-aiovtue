const DANMAKU_GAP = 14

function primeGalleryPostVideoThumb(video) {
  if (!video || video.dataset.thumbReady === '1') return
  video.dataset.thumbReady = '1'
  const seek = () => {
    try {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.min(0.15, video.duration * 0.05)
      }
    } catch (_) { /* ignore */ }
  }
  if (video.readyState >= 1) seek()
  else video.addEventListener('loadedmetadata', seek, { once: true })
}

function initGalleryPostVideoThumbs(root = document) {
  root.querySelectorAll('video.sakura-gallery-post-media__el, video.sakura-gallery-post-thumb__media').forEach(primeGalleryPostVideoThumb)
}

function galleryPostThumbsEnabled() {
  return window.matchMedia('(max-width: 768px)').matches
}

function createGalleryPostThumbController(viewer, onSelect) {
  const thumbsRoot = viewer.querySelector('.sakura-gallery-post-thumbs')
  const track = thumbsRoot?.querySelector('.sakura-gallery-post-thumbs__track')
  const thumbButtons = track ? [...track.querySelectorAll('.sakura-gallery-post-thumb')] : []

  if (!galleryPostThumbsEnabled() || !thumbsRoot || !track || thumbButtons.length <= 1) {
    return { update() {}, destroy() {} }
  }

  let thumbWidth = 0
  let thumbStep = 0
  let activeIndex = thumbButtons.findIndex((btn) => btn.classList.contains('is-active'))
  if (activeIndex < 0) activeIndex = 0

  const updateMetrics = () => {
    const thumb = thumbButtons[0]
    if (!thumb) return
    thumbWidth = thumb.offsetWidth
    const gapValue = Number.parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0')
    thumbStep = thumbWidth + (Number.isFinite(gapValue) ? gapValue : 0)
  }

  const updateTrack = () => {
    updateMetrics()
    if (!thumbWidth) return
    const offset = thumbsRoot.clientWidth / 2 - thumbWidth / 2 - activeIndex * thumbStep
    track.style.transform = `translateX(${offset}px)`
  }

  const update = (nextIndex) => {
    activeIndex = nextIndex
    thumbButtons.forEach((btn, i) => {
      const active = i === activeIndex
      btn.classList.toggle('is-active', active)
      btn.setAttribute('aria-selected', active ? 'true' : 'false')
    })
    updateTrack()
  }

  const onThumbClick = (event) => {
    const index = Number.parseInt(event.currentTarget.dataset.index || '', 10)
    if (Number.isFinite(index)) onSelect(index)
  }

  const onResize = () => updateTrack()

  thumbButtons.forEach((btn) => btn.addEventListener('click', onThumbClick))
  initGalleryPostVideoThumbs(thumbsRoot)
  window.addEventListener('resize', onResize)
  update(activeIndex)

  return {
    update,
    destroy() {
      thumbButtons.forEach((btn) => btn.removeEventListener('click', onThumbClick))
      window.removeEventListener('resize', onResize)
    },
  }
}

function collectGalleryPostItems(root = document) {
  const items = []
  root.querySelectorAll('.sakura-gallery-post-media[data-media-src]').forEach((el) => {
    if (el.dataset.lightboxBound === '1') return
    const src = el.dataset.mediaSrc
    if (!src) return
    const img = el.querySelector('img')
    items.push({
      el,
      src,
      type: el.dataset.mediaType === 'video' ? 'video' : 'image',
      poster: img?.src || '',
    })
  })
  return items
}

function isGalleryPostVideoCenterClick(button, event) {
  const icon = button.querySelector('.sakura-gallery-post-media__play svg')
  const play = button.querySelector('.sakura-gallery-post-media__play')
  const target = icon || play
  if (!target) {
    const rect = button.getBoundingClientRect()
    const ratio = 0.34
    const zoneW = rect.width * ratio
    const zoneH = rect.height * ratio
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return (
      Math.abs(event.clientX - cx) <= zoneW / 2 &&
      Math.abs(event.clientY - cy) <= zoneH / 2
    )
  }

  const rect = target.getBoundingClientRect()
  const pad = Math.max(16, Math.min(rect.width, rect.height) * 0.35)
  return (
    event.clientX >= rect.left - pad &&
    event.clientX <= rect.right + pad &&
    event.clientY >= rect.top - pad &&
    event.clientY <= rect.bottom + pad
  )
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function extractDanmakuLines(sourceEl) {
  if (!sourceEl) return []
  const lines = []

  sourceEl.querySelectorAll('p, li').forEach((el) => {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim()
    if (text) lines.push(text)
  })

  if (!lines.length) {
    const text = (sourceEl.textContent || '').replace(/\s+/g, ' ').trim()
    if (text) lines.push(text)
  }

  return lines
}

function buildDanmakuItem(text) {
  const item = document.createElement('div')
  item.className = 'sakura-gallery-post-danmaku__item'
  item.textContent = text
  return item
}

function getDanmakuLaneDelay(last, newWidth, newSpeed, containerWidth) {
  if (!last) return 0

  const nowSec = performance.now() / 1000
  const elapsed = nowSec - last.startSec
  const lastRight = last.startX + last.width + last.speed * elapsed

  if (lastRight >= containerWidth) return 0

  let delay = 0
  if (lastRight + DANMAKU_GAP > -newWidth) {
    delay = (lastRight + DANMAKU_GAP + newWidth) / last.speed
  }

  return delay
}

function spawnDanmakuItem(screen, item, lane, laneCount, speed, onFinish) {
  screen.appendChild(item)

  const laneHeight = screen.clientHeight / laneCount
  const itemHeight = item.offsetHeight
  item.style.top = `${lane * laneHeight + Math.max(0, (laneHeight - itemHeight) / 2)}px`

  const containerWidth = screen.clientWidth
  const itemWidth = item.scrollWidth || item.offsetWidth
  const duration = ((containerWidth + itemWidth) / speed) * 1000

  item.style.transform = `translateX(${-itemWidth}px)`
  const animation = item.animate([
    { transform: `translateX(${-itemWidth}px)` },
    { transform: `translateX(${containerWidth}px)` },
  ], { duration, easing: 'linear', fill: 'forwards' })

  animation.onfinish = () => {
    item.remove()
    onFinish?.()
  }

  return {
    animation,
    track: {
      startSec: performance.now() / 1000,
      startX: -itemWidth,
      width: itemWidth,
      speed,
    },
  }
}

function measureDanmakuItem(screen, text) {
  const item = buildDanmakuItem(text)
  item.style.visibility = 'hidden'
  item.style.pointerEvents = 'none'
  item.style.position = 'absolute'
  item.style.left = '0'
  item.style.top = '0'
  screen.appendChild(item)
  const width = item.scrollWidth || item.offsetWidth
  screen.removeChild(item)
  return width
}

function createSlideDanmakuController(slide) {
  const root = slide.querySelector('.sakura-gallery-post-danmaku')
  const screen = root?.querySelector('.sakura-gallery-post-danmaku__screen')
  const source = root?.querySelector('.sakura-gallery-post-danmaku__source')
  if (!root || !screen || !source) {
    return { start() {}, stop() {} }
  }

  const lines = extractDanmakuLines(source)
  let running = false
  let timers = []
  let animations = []
  let laneCount = 0
  let laneTracks = []
  let laneLines = []
  let laneNextIndex = []

  const clearAll = () => {
    timers.forEach((id) => window.clearTimeout(id))
    timers = []
    animations.forEach((animation) => {
      try { animation.cancel() } catch (_) { /* ignore */ }
    })
    animations = []
    screen.replaceChildren()
  }

  const stop = () => {
    running = false
    clearAll()
    laneCount = 0
    laneTracks = []
    laneLines = []
    laneNextIndex = []
  }

  const playLane = (laneIndex) => {
    if (!running || !screen.isConnected || slide.hidden) return

    const texts = laneLines[laneIndex]
    if (!texts?.length) return

    const text = texts[laneNextIndex[laneIndex] % texts.length]
    laneNextIndex[laneIndex] += 1

    const itemWidth = measureDanmakuItem(screen, text)
    if (!itemWidth) {
      laneNextIndex[laneIndex] -= 1
      const retry = window.setTimeout(() => playLane(laneIndex), 240)
      timers.push(retry)
      return
    }

    const speed = 52 + Math.random() * 38
    const delaySec = getDanmakuLaneDelay(laneTracks[laneIndex], itemWidth, speed, screen.clientWidth)
    const delayMs = Math.max(0, delaySec * 1000)

    const timer = window.setTimeout(() => {
      if (!running || !screen.isConnected || slide.hidden) return

      const item = buildDanmakuItem(text)
      let activeTrack = null
      const { animation, track } = spawnDanmakuItem(screen, item, laneIndex, laneCount, speed, () => {
        if (laneTracks[laneIndex] === activeTrack) laneTracks[laneIndex] = null
        playLane(laneIndex)
      })
      animations.push(animation)
      activeTrack = track
      laneTracks[laneIndex] = track
    }, delayMs)

    timers.push(timer)
  }

  const start = () => {
    stop()
    if (prefersReducedMotion() || !lines.length || screen.clientHeight < 28) return

    running = true
    laneCount = Math.min(lines.length, Math.min(4, Math.max(1, Math.floor(screen.clientHeight / 32))))
    laneTracks = Array.from({ length: laneCount }, () => null)
    laneLines = Array.from({ length: laneCount }, () => [])
    laneNextIndex = Array.from({ length: laneCount }, () => 0)
    lines.forEach((text, index) => {
      laneLines[index % laneCount].push(text)
    })

    for (let lane = 0; lane < laneCount; lane += 1) {
      const timer = window.setTimeout(() => playLane(lane), lane * 320)
      timers.push(timer)
    }
  }

  return { start, stop }
}

function resetGalleryPostVideo(video, button) {
  if (!video) return
  video.pause()
  video.controls = false
  video.muted = true
  button?.classList.remove('is-playing')
  primeGalleryPostVideoThumb(video)
}

function bindGalleryPostInlineVideos(viewer) {
  const buttons = [...viewer.querySelectorAll('.sakura-gallery-post-media[data-media-type="video"]')]
  const cleanups = []

  const pauseAll = () => {
    buttons.forEach((button) => {
      resetGalleryPostVideo(button.querySelector('video.sakura-gallery-post-media__el'), button)
    })
  }

  buttons.forEach((button) => {
    const video = button.querySelector('video.sakura-gallery-post-media__el')
    if (!video) return

    const onClick = (event) => {
      if (!isGalleryPostVideoCenterClick(button, event)) {
        pauseAll()
        return
      }

      event.preventDefault()
      event.stopImmediatePropagation()

      if (!video.paused && !video.ended) {
        video.pause()
        return
      }

      pauseAll()
      video.muted = false
      video.controls = true
      button.classList.add('is-playing')
      void video.play().catch(() => {
        button.classList.remove('is-playing')
        video.controls = false
        video.muted = true
      })
    }

    const onEnded = () => resetGalleryPostVideo(video, button)

    button.addEventListener('click', onClick, true)
    video.addEventListener('ended', onEnded)
    cleanups.push(() => {
      button.removeEventListener('click', onClick, true)
      video.removeEventListener('ended', onEnded)
      resetGalleryPostVideo(video, button)
    })
  })

  return {
    pauseAll,
    destroy() {
      cleanups.forEach((cleanup) => cleanup())
    },
  }
}

function mountGalleryPost(registerPageCleanup) {
  const viewer = document.querySelector('.sakura-gallery-post-viewer')
  if (!viewer || viewer.dataset.galleryMounted === '1') return

  const slides = [...viewer.querySelectorAll('.sakura-gallery-post-slide')]
  if (!slides.length) return

  viewer.dataset.galleryMounted = '1'

  initGalleryPostVideoThumbs(viewer)

  const controllers = new Map(slides.map((slide) => [slide, createSlideDanmakuController(slide)]))

  const prevBtn = viewer.querySelector('.sakura-gallery-post-nav--prev')
  const nextBtn = viewer.querySelector('.sakura-gallery-post-nav--next')
  const currentEl = viewer.querySelector('.sakura-gallery-post-counter__current')
  const total = slides.length
  let index = slides.findIndex((slide) => slide.classList.contains('is-active'))
  if (index < 0) index = 0

  const stopAllDanmaku = () => {
    controllers.forEach((controller) => controller.stop())
  }

  const startActiveDanmaku = () => {
    stopAllDanmaku()
    const active = slides[index]
    controllers.get(active)?.start()
  }

  const frame = slides[0]?.querySelector('.sakura-gallery-post-frame')
  let resizeObserver = null
  if (frame && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => startActiveDanmaku())
    resizeObserver.observe(frame)
  }

  const updateNavState = () => {
    if (prevBtn) prevBtn.disabled = total <= 1
    if (nextBtn) nextBtn.disabled = total <= 1
  }

  let thumbController = null
  const videoController = bindGalleryPostInlineVideos(viewer)

  const showSlide = (nextIndex) => {
    videoController.pauseAll()
    index = (nextIndex + total) % total
    slides.forEach((slide, i) => {
      const active = i === index
      slide.classList.toggle('is-active', active)
      slide.hidden = !active
    })
    if (currentEl) currentEl.textContent = String(index + 1)
    updateNavState()
    thumbController?.update(index)
    startActiveDanmaku()
  }

  thumbController = createGalleryPostThumbController(viewer, showSlide)

  const onPrev = () => showSlide(index - 1)
  const onNext = () => showSlide(index + 1)

  const isEditableTarget = (target) => {
    if (!target || !(target instanceof Element)) return false
    const tag = target.tagName
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (tag === 'INPUT') {
      const type = (target.type || '').toLowerCase()
      return type !== 'button' && type !== 'submit' && type !== 'checkbox' && type !== 'radio'
    }
    if (target.isContentEditable) return true
    return Boolean(target.closest('[contenteditable="true"]'))
  }

  const onKeydown = (event) => {
    if (total <= 1) return
    if (isEditableTarget(event.target) || isEditableTarget(document.activeElement)) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      onPrev()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      onNext()
    }
  }

  let touchStartX = 0
  let touchStartY = 0

  const onTouchStart = (event) => {
    const touch = event.changedTouches?.[0]
    if (!touch) return
    touchStartX = touch.clientX
    touchStartY = touch.clientY
  }

  const onTouchEnd = (event) => {
    if (total <= 1) return
    const touch = event.changedTouches?.[0]
    if (!touch) return
    const deltaX = touch.clientX - touchStartX
    const deltaY = touch.clientY - touchStartY
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY)) return
    if (deltaX > 0) onPrev()
    else onNext()
  }

  const onMotionChange = () => startActiveDanmaku()
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  prevBtn?.addEventListener('click', onPrev)
  nextBtn?.addEventListener('click', onNext)
  document.addEventListener('keydown', onKeydown)
  viewer.addEventListener('touchstart', onTouchStart, { passive: true })
  viewer.addEventListener('touchend', onTouchEnd, { passive: true })
  window.addEventListener('resize', startActiveDanmaku)
  motionQuery.addEventListener?.('change', onMotionChange)

  showSlide(index)

  if (typeof window.__sakuraAppendGalleryPostLightbox === 'function') {
    window.__sakuraAppendGalleryPostLightbox(viewer)
  }

  registerPageCleanup(() => {
    prevBtn?.removeEventListener('click', onPrev)
    nextBtn?.removeEventListener('click', onNext)
    document.removeEventListener('keydown', onKeydown)
    viewer.removeEventListener('touchstart', onTouchStart)
    viewer.removeEventListener('touchend', onTouchEnd)
    window.removeEventListener('resize', startActiveDanmaku)
    motionQuery.removeEventListener?.('change', onMotionChange)
    resizeObserver?.disconnect()
    thumbController?.destroy()
    videoController.destroy()
    stopAllDanmaku()
    delete viewer.dataset.galleryMounted
  })
}

function mountGalleryPostFeatures(registerPageCleanup) {
  mountGalleryPost(registerPageCleanup)
}

window.__sakuraMountGalleryPost = mountGalleryPostFeatures
window.__sakuraCollectGalleryPostItems = collectGalleryPostItems
