
import { applyTargetScroll, readHomeListScrollMeta, isPjaxContentMounting } from './page-nav.js'
import { registerPageCleanup } from './page-cleanup.js'
import { escapeHtml, parseJsonData, formatRelativeTime, shuffleArray } from './utils.js'
import { initLazyImages } from './lazy-images.js'
import { getNavbarLayoutOffset } from './navbar.js'

const MOBILE_CARDS_MQ = '(max-width: 768px)'

function initHomeMobileListTimes(root) {
  const roots = root
    ? [root]
    : [...document.querySelectorAll('.is-mobile-cards-list')]
  roots.forEach((scope) => {
    scope.querySelectorAll('.sakura-post-card .sakura-post-date time[datetime]').forEach((timeEl) => {
      const absolute = timeEl.textContent.trim()
      const isDateOnly = timeEl.hasAttribute('data-date-only')
      const formatted = formatRelativeTime(timeEl.getAttribute('datetime'), absolute, isDateOnly)
      timeEl.textContent = formatted
      if (formatted !== absolute) {
        timeEl.title = `编辑于${absolute}`
      } else {
        timeEl.removeAttribute('title')
      }
    })
  })
}

function syncHomeMobileListPins() {
  const mobile = window.matchMedia(MOBILE_CARDS_MQ).matches
  document.querySelectorAll('.is-mobile-cards-list .sakura-post-card > .sakura-post-pin').forEach((pin) => {
    const icon = pin.querySelector('iconify-icon')
    if (mobile) {
      pin.classList.add('is-pin-flip')
      icon?.setAttribute('flip', 'horizontal')
    } else {
      pin.classList.remove('is-pin-flip')
      icon?.removeAttribute('flip')
    }
  })
}

let homeMobileListPinsBound = false

export function refreshMobileCardsListPage() {
  initHomeMobileListTimes()
  syncHomeMobileListPins()
}

function initHomeMobileListPins() {
  refreshMobileCardsListPage()
  if (homeMobileListPinsBound) return
  homeMobileListPinsBound = true
  window.addEventListener('resize', syncHomeMobileListPins, { passive: true })
  registerPageCleanup(() => {
    window.removeEventListener('resize', syncHomeMobileListPins)
    homeMobileListPinsBound = false
  })
}

let homePostListRevealObserver = null
let homeTimelineLoader = null
let homeCardsLoader = null
let homeCardsLoadMoreStateBound = false
let homeCardsLoadMoreTeardown = null
let homeListScrollRestoreToken = 0

export function getActiveHomeVariant() {
  return getVisibleHomeVariant() || document.getElementById('home-posts')
}

function getVisibleHomeVariant() {
  const root = document.getElementById('home-posts')
  if (!root) return null
  return [...root.querySelectorAll('.home-layout-variant')].find((variant) => !variant.hidden) || null
}

function queryHome(selector) {
  const visibleVariant = getVisibleHomeVariant()
  if (visibleVariant) {
    const found = visibleVariant.querySelector(selector)
    if (found) return found
  }
  const root = document.getElementById('home-posts')
  if (root) {
    const found = root.querySelector(selector)
    if (found) return found
  }
  return document.querySelector(selector)
}

function getHomeCardsList() {
  return queryHome('.home-cards-list')
}

function mountHomeCardsLoadMoreUi(list, postList, sentinel, statusEl) {
  if (!list || !sentinel?.isConnected) return
  if (sentinel.parentElement !== list) {
    list.appendChild(sentinel)
  }
  if (statusEl?.isConnected && postList && statusEl.parentElement !== postList) {
    postList.appendChild(statusEl)
  }
}

function syncHomePostsShell(root, variant) {
  if (!root || !variant) return
  const layout = variant.dataset.layout || root.dataset.homeLayout || 'cards'
  root.dataset.homeLayout = layout
  root.classList.remove('is-layout-cards', 'is-layout-list', 'is-layout-timeline', 'is-mobile-cards-list', 'is-desktop-list-double')
  root.classList.add(`is-layout-${layout}`)
  if (variant.dataset.mobileCardsList === 'true') {
    root.classList.add('is-mobile-cards-list')
  }
  if (layout === 'list' && variant.dataset.listColumns === 'double') {
    root.classList.add('is-desktop-list-double')
  }
}

function getHomeLayoutVariantKey(variant) {
  if (!variant) return ''
  const layout = variant.dataset.layout || ''
  const columns = variant.dataset.listColumns || ''
  return `${layout}:${columns}`
}

function readLastHomeLayoutVariantKey() {
  try {
    return sessionStorage.getItem('sakura-home-layout-last') || ''
  } catch {
    return ''
  }
}

function writeLastHomeLayoutVariantKey(key) {
  try {
    if (key) sessionStorage.setItem('sakura-home-layout-last', key)
  } catch {
    /* ignore */
  }
}

function pickRandomHomeLayoutVariant(variants, excludeKey) {
  let pool = variants
  if (excludeKey && variants.length > 1) {
    const filtered = variants.filter((v) => getHomeLayoutVariantKey(v) !== excludeKey)
    if (filtered.length) pool = filtered
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

function findPrimaryHomeLayoutVariant(root, variants) {
  const primary = root.dataset.layoutPrimary || root.dataset.homeLayout || 'cards'
  const listColumns = root.dataset.listColumnsPrimary || 'single'
  return variants.find((v) => {
    if (v.dataset.layout !== primary) return false
    if (primary === 'list' && v.dataset.listColumns) {
      return v.dataset.listColumns === listColumns
    }
    return true
  }) || variants[0] || null
}

function shouldRandomizeHomeLayout(root, variantCount) {
  if (!root || root.dataset.layoutRandom !== 'true' || variantCount < 2) return false
  return !window.matchMedia('(max-width: 768px)').matches
}

function syncHomePostListId(root, picked) {
  if (!root) return
  root.querySelectorAll('.home-post-list[id="home-post-list"]').forEach((el) => {
    el.removeAttribute('id')
  })
  root.querySelectorAll('.home-cards-list[id="home-cards-list"]').forEach((el) => {
    el.removeAttribute('id')
  })
  picked?.querySelector('.home-post-list')?.setAttribute('id', 'home-post-list')
  picked?.querySelector('.home-cards-list')?.setAttribute('id', 'home-cards-list')
}

function applyHomeLayoutVariant(root, picked) {
  if (!root || !picked) return null
  const variants = [...root.querySelectorAll('.home-layout-variant')]
  variants.forEach((v) => {
    v.hidden = v !== picked
  })
  syncHomePostsShell(root, picked)
  syncHomePostListId(root, picked)
  mountHomeListFeatured()
  homeCardsLoader?.refreshMount?.()
  return picked
}

function mountHomeListFeatured() {
  const root = document.getElementById('home-posts')
  if (!root) return
  const mount = root.querySelector('.home-list-featured-mount')
  if (!mount) return
  const featured = mount.querySelector('.home-list-featured')
  const postList = queryHome('.home-post-list')
  if (!featured || !postList) return
  if (postList.contains(featured)) return
  postList.insertBefore(featured, postList.firstChild)
  mount.remove()
}

function restoreHomeLayoutVariant(root, variantKey) {
  const variants = [...root.querySelectorAll('.home-layout-variant')]
  if (!variants.length) return null
  const picked = variants.find((v) => getHomeLayoutVariantKey(v) === variantKey)
    || findPrimaryHomeLayoutVariant(root, variants)
  return applyHomeLayoutVariant(root, picked)
}

function pickHomeLayoutVariant(root) {
  if (!root || root.dataset.layoutRandom !== 'true') return getActiveHomeVariant()

  const variants = [...root.querySelectorAll('.home-layout-variant')]
  if (!variants.length) return null

  const randomize = shouldRandomizeHomeLayout(root, variants.length)
  const picked = randomize
    ? pickRandomHomeLayoutVariant(variants, readLastHomeLayoutVariantKey())
    : findPrimaryHomeLayoutVariant(root, variants)

  if (!picked) return null

  if (randomize) writeLastHomeLayoutVariantKey(getHomeLayoutVariantKey(picked))
  return applyHomeLayoutVariant(root, picked)
}

function readHomePaginatorPage(root) {
  return Math.max(1, parseInt(root?.dataset.homePaginatorPage || '1', 10) || 1)
}

function applyPrimaryHomeLayoutVariant(root, variants) {
  const picked = findPrimaryHomeLayoutVariant(root, variants)
  if (!picked) return null
  return applyHomeLayoutVariant(root, picked)
}

function restoreStoredHomeLayoutVariant(root, variants) {
  const lastKey = readLastHomeLayoutVariantKey()
  if (!lastKey) return null
  return restoreHomeLayoutVariant(root, lastKey)
}

export function initHomeLayoutRandom() {
  const root = document.getElementById('home-posts')
  if (!root) return

  if (root.dataset.layoutRandom === 'true') {
    const variants = [...root.querySelectorAll('.home-layout-variant')]
    const pageNum = readHomePaginatorPage(root)
    const randomize = shouldRandomizeHomeLayout(root, variants.length)

    if (pageNum > 1) {
      if (restoreStoredHomeLayoutVariant(root, variants)
        || applyPrimaryHomeLayoutVariant(root, variants)) {
        bootstrapHomeCardsLoadMore()
      }
      return
    }

    if (randomize && isPjaxContentMounting()) {
      if (restoreStoredHomeLayoutVariant(root, variants)) {
        bootstrapHomeCardsLoadMore()
        return
      }
    }

    pickHomeLayoutVariant(root)
    bootstrapHomeCardsLoadMore()
    return
  }

  const variant = root.querySelector('.home-layout-variant') || root
  syncHomePostsShell(root, variant)
  if (variant.classList?.contains('home-layout-variant')) {
    syncHomePostListId(root, variant)
  }
  mountHomeListFeatured()
  bootstrapHomeCardsLoadMore()
}

function getPostListScrollTop() {
  const target = queryHome('.home-post-list')
    || document.querySelector('.sakura-post-list')
  if (!target) return 0

  const navHeight = getNavbarLayoutOffset()

  return Math.max(0, window.scrollY + target.getBoundingClientRect().top - navHeight - 8)
}

function applyHomeListScroll(scrollY) {
  applyTargetScroll(scrollY)
}

function prepareHomeTimelineForScroll(targetY, timelineItemsTarget = 0) {
  if (!homeTimelineLoader?.hasMore?.()) return Promise.resolve()

  return new Promise((resolve) => {
    const step = () => {
      const currentCount = document.querySelectorAll('.home-layout-variant:not([hidden]) .home-timeline-list .home-timeline-item').length
        || document.querySelectorAll('#home-timeline-list .home-timeline-item, .home-timeline-list .home-timeline-item').length
      if (timelineItemsTarget > 0 && currentCount >= timelineItemsTarget) {
        resolve()
        return
      }
      if (document.documentElement.scrollHeight >= targetY + window.innerHeight * 0.5) {
        resolve()
        return
      }
      if (!homeTimelineLoader?.hasMore?.()) {
        resolve()
        return
      }
      homeTimelineLoader.loadNextBatch({ force: true })
      requestAnimationFrame(step)
    }
    step()
  })
}

function prepareHomeCardsForScroll(targetY, cardsItemsTarget = 0) {
  if (!homeCardsLoader?.hasMore?.()) return Promise.resolve()

  return new Promise((resolve) => {
    const step = () => {
      const currentCount = document.querySelectorAll('.home-layout-variant:not([hidden]) .home-cards-list .sakura-post-card').length
        || document.querySelectorAll('#home-cards-list .sakura-post-card, .home-cards-list .sakura-post-card').length
      if (cardsItemsTarget > 0 && currentCount >= cardsItemsTarget) {
        resolve()
        return
      }
      if (document.documentElement.scrollHeight >= targetY + window.innerHeight * 0.5) {
        resolve()
        return
      }
      if (!homeCardsLoader?.hasMore?.()) {
        resolve()
        return
      }
      homeCardsLoader.loadNextBatch({ force: true })
      requestAnimationFrame(step)
    }
    step()
  })
}

export function restoreHomeListScroll(meta) {
  const targetY = meta.y
  const token = ++homeListScrollRestoreToken
  homeTimelineLoader?.pauseAutoLoad?.()
  homeCardsLoader?.pauseAutoLoad?.()
  const apply = () => {
    if (token !== homeListScrollRestoreToken) return
    applyHomeListScroll(targetY)
    try {
      history.replaceState(
        { ...(history.state || {}), pjax: true, scrollY: targetY },
        '',
        window.location.href,
      )
    } catch {
      /* ignore */
    }
  }

  return Promise.all([
    prepareHomeTimelineForScroll(targetY, meta.timelineItems),
    prepareHomeCardsForScroll(targetY, meta.cardsItems),
  ]).then(() => {
    if (token !== homeListScrollRestoreToken) return
    apply()
    homeTimelineLoader?.resumeAutoLoad?.()
    homeCardsLoader?.resumeAutoLoad?.()
    syncHomeMobileListPins()
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          apply()
          resolve()
        })
      })
    })
  })
}

export function scrollToPostList() {
  const top = getPostListScrollTop()
  applyHomeListScroll(top)
  return top
}

function scheduleScrollToPostList() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollToPostList()
    })
  })
}

function isHomePaginationPath(pathname) {
  const path = pathname.replace(/\/$/, '') || '/'
  return path === '/' || /^\/page\/\d+$/.test(path)
}

export function shouldScrollToPostListForUrl(href) {
  try {
    const url = new URL(href, window.location.href)
    const path = url.pathname.replace(/\/$/, '') || '/'
    if (!isHomePaginationPath(path)) return false
    return url.hash === '#home-post-list'
  } catch {
    return false
  }
}

export function initHomePaginationScroll() {
  if (!queryHome('.home-post-list')) return

  const picked = readHomeListScrollMeta(window.location.href)
  if (picked && picked.y > 0) return

  const pjaxEnabled = document.querySelector('meta[name="sakura-pjax"]')?.content === '1'
  if (pjaxEnabled) return

  try {
    if (new URL(window.location.href).hash !== '#home-post-list') return
  } catch {
    return
  }
  scheduleScrollToPostList()
}

function observeHomePostListReveal(root, cards) {
  if (!cards.length) return

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    cards.forEach((card) => card.classList.add('is-revealed'))
    return
  }

  const supportsScrollTimeline = typeof CSS !== 'undefined'
    && CSS.supports('(animation-timeline: view())')

  if (supportsScrollTimeline) {
    root.classList.add('post-list-scroll-driven')
    return
  }

  if (!homePostListRevealObserver) {
    homePostListRevealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const card = entry.target
        card.classList.add('is-revealed')
        homePostListRevealObserver.unobserve(card)
      })
    }, {
      root: null,
      rootMargin: '0px 0px -4% 0px',
      threshold: 0.08,
    })
  }

  cards.forEach((card) => homePostListRevealObserver.observe(card))
}

export function initHomePostListScrollAnimation() {
  const root = queryHome('.home-post-list')
  if (!root) return

  initHomeMobileListTimes()
  initHomeMobileListPins()

  const cards = [...root.querySelectorAll('.sakura-post-card, .home-timeline-item__content')]
  if (!cards.length) return

  root.classList.add('post-list-animated')
  observeHomePostListReveal(root, cards)
}

function createHomeTimelineItem(post) {
  const side = (post.index % 2 === 0) ? 'is-left' : 'is-right'
  const li = document.createElement('li')
  li.className = `home-timeline-item ${side}`
  li.innerHTML = `
    <div class="home-timeline-item__inner">
      <div class="home-timeline-item__content">
        <a class="home-timeline-card__link" href="${escapeHtml(post.url)}" aria-label="阅读全文：${escapeHtml(post.title)}">
          <h2 class="home-timeline-card__title">${escapeHtml(post.title)}</h2>
          <p class="home-timeline-card__excerpt">${escapeHtml(post.excerpt || '')}</p>
        </a>
      </div>
      <time class="home-timeline-card__date" datetime="${escapeHtml(post.dateTime || post.date || '')}"${post.dateOnly ? ' data-date-only="true"' : ''} title="编辑于${escapeHtml(post.date || '')}">
        <span class="home-timeline-card__date-year">${escapeHtml(post.dateYear || '')}</span>
        <span class="home-timeline-card__date-md">${escapeHtml(post.dateMd || '')}</span>
      </time>
    </div>
    <span class="home-timeline-item__dot" aria-hidden="true"></span>
  `
  return li
}

function renderHomeCardCategoriesHtml(categories) {
  if (!Array.isArray(categories) || !categories.length) return ''
  return categories.map((category, index) => {
    const sep = index === 0
      ? ''
      : '<span class="sakura-post-categories__sep">/</span>'
    const icon = index === 0
      ? '<iconify-icon icon="mdi:folder-open-outline" class="sakura-icon sakura-post-categories__icon" aria-hidden="true"></iconify-icon>'
      : ''
    const href = `/categories/?category=${encodeURIComponent(category)}`
    return `${sep}<a class="sakura-post-categories__link" href="${escapeHtml(href)}">${icon}<span>${escapeHtml(category)}</span></a>`
  }).join('')
}

function renderHomeCardTagsHtml(tags) {
  if (!Array.isArray(tags) || !tags.length) return ''
  return tags.map((tag, index) => {
    const sep = index === 0
      ? ''
      : '<span class="sakura-post-tags__sep">·</span>'
    const icon = index === 0
      ? '<iconify-icon icon="mdi:tag-multiple" class="sakura-icon sakura-post-tags__icon" aria-hidden="true"></iconify-icon>'
      : ''
    const href = `/tags/?tag=${encodeURIComponent(tag)}`
    return `${sep}<a class="sakura-post-tags__link" href="${escapeHtml(href)}">${icon}<span>${escapeHtml(tag)}</span></a>`
  }).join('')
}

function renderHomeCardMetaHtml(post) {
  const categoriesHtml = renderHomeCardCategoriesHtml(post.categories)
  const tagsHtml = renderHomeCardTagsHtml(post.tags)
  if (!categoriesHtml && !tagsHtml) return '<div class="sakura-post-meta"></div>'
  const parts = []
  if (categoriesHtml) {
    parts.push(`<div class="sakura-post-categories">${categoriesHtml}</div>`)
  }
  if (tagsHtml) {
    parts.push(`<div class="sakura-post-tags">${tagsHtml}</div>`)
  }
  return `<div class="sakura-post-meta">${parts.join('')}</div>`
}

function renderHomeCardCoverHtml(post) {
  if (!post.cover) return ''
  const src = escapeHtml(post.cover)
  const title = escapeHtml(post.title || '')
  if (post.coverIsVideo) {
    return `<video class="sakura-cover-thumb sakura-lazy-img" src="${src}" muted playsinline preload="metadata" disablepictureinpicture aria-hidden="true"></video>`
  }
  return `<img class="sakura-lazy-img" src="${src}" alt="${title}" loading="lazy" decoding="async">`
}

function createHomeCardsItem(post) {
  const side = (post.index % 2 === 0) ? 'left' : 'right'
  const article = document.createElement('article')
  article.className = `sakura-post-card ${side}${post.pinned ? ' is-pinned' : ''}`
  const pinHtml = post.pinned
    ? '<span class="sakura-post-pin" title="置顶" aria-label="置顶"><iconify-icon icon="mdi:pin" aria-hidden="true"></iconify-icon></span>'
    : ''
  const metaHtml = renderHomeCardMetaHtml(post)
  article.innerHTML = `
    ${pinHtml}
    <a class="sakura-post-card__cover aspect-video" href="${escapeHtml(post.url)}">
      ${renderHomeCardCoverHtml(post)}
    </a>
    <div class="sakura-post-card__content has-cover">
      <div class="sakura-post-card-info">
        <div class="sakura-post-date post-date">
          <span class="sakura-post-date__inner" title="编辑于${escapeHtml(post.date || '')}">
            <iconify-icon icon="mdi:clock-outline" class="sakura-icon sakura-post-date__icon" aria-hidden="true"></iconify-icon>
            <span class="sakura-post-date__label">编辑于</span>
            <time datetime="${escapeHtml(post.dateTime || post.date || '')}"${post.dateOnly ? ' data-date-only="true"' : ''} itemprop="dateModified">${escapeHtml(post.date || '')}</time>
          </span>
        </div>
        <h2 class="sakura-post-title sakura-post-card__title">
          <a href="${escapeHtml(post.url)}" aria-label="阅读全文：${escapeHtml(post.title)}">${escapeHtml(post.title)}</a>
        </h2>
        ${metaHtml}
        <div class="sakura-post-excerpt sakura-post-card__excerpt">${escapeHtml(post.excerpt || '')}</div>
      </div>
    </div>
  `
  return article
}

let homeCardsInitAttempts = 0

export function bootstrapHomeCardsLoadMore() {
  initHomeCardsLoadMore()
  scheduleHomeCardsLoadMoreSync()
}

export function initHomeCardsLoadMore() {
  if (homeCardsLoader?.sync) {
    homeCardsLoader.sync()
    return
  }

  const layout = document.getElementById('home-posts')
  if (!layout) return

  const dataEl = layout.querySelector('.home-cards-more-data')
  const sentinel = layout.querySelector('.home-cards-scroll-sentinel')
  const statusEl = layout.querySelector('.home-cards-load-status')
  if (!dataEl || !sentinel) return

  const loadMoreEnabled = layout.dataset.cardsPaging === 'loadMore'
  if (!loadMoreEnabled) return

  const list = getHomeCardsList()
  const postList = queryHome('.home-post-list')
  if (!list || !postList) {
    if (homeCardsInitAttempts < 15) {
      homeCardsInitAttempts += 1
      requestAnimationFrame(() => initHomeCardsLoadMore())
    }
    return
  }
  homeCardsInitAttempts = 0

  mountHomeCardsLoadMoreUi(list, postList, sentinel, statusEl)

  let posts = []
  try {
    posts = parseJsonData(dataEl)
  } catch (err) {
    console.warn('[home-cards]', err)
    sentinel.remove()
    statusEl?.remove()
    return
  }

  if (!posts.length) {
    sentinel.remove()
    dataEl.remove()
    statusEl?.remove()
    return
  }

  const getBatchSize = () => Math.max(1, parseInt(sentinel.dataset.batchSize || '10', 10) || 10)

  let loading = false
  let autoLoadPaused = false
  let observing = false
  let scrollObserver = null
  let scrollTick = false

  const refreshMount = () => {
    const activeList = getHomeCardsList()
    const activePostList = queryHome('.home-post-list')
    if (!activeList || !activePostList) return
    mountHomeCardsLoadMoreUi(activeList, activePostList, sentinel, statusEl)
  }

  const showLoadHint = () => {}

  const setStatus = (mode) => {
    if (!statusEl) return
    if (mode === 'idle') {
      statusEl.hidden = true
      statusEl.textContent = ''
      statusEl.classList.remove('is-loading', 'is-done')
      return
    }
    statusEl.hidden = false
    statusEl.classList.toggle('is-loading', mode === 'loading')
    statusEl.classList.toggle('is-done', mode === 'done')
    statusEl.textContent = mode === 'loading' ? '加载中…' : '没有更多了'
  }

  const teardownObserver = () => {
    scrollObserver?.disconnect()
    scrollObserver = null
    observing = false
  }

  const createObserver = () => {
    teardownObserver()
    scrollObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadNextBatch()
    }, {
      root: null,
      rootMargin: '0px 0px 480px 0px',
      threshold: 0,
    })
  }

  const finish = () => {
    teardownObserver()
    window.removeEventListener('scroll', onScroll, scrollListenerOpts)
    document.removeEventListener('scroll', onScroll, scrollCaptureOpts)
    clearInterval(pollId)
    sentinel.remove()
    dataEl.remove()
    setStatus('done')
  }

  const isSentinelNearViewport = () => {
    if (!sentinel.isConnected) return false
    return sentinel.getBoundingClientRect().top <= window.innerHeight + 480
  }

  const loadNextBatch = ({ force = false } = {}) => {
    if (!loadMoreEnabled || loading || (!force && autoLoadPaused) || !posts.length) return
    const activeList = getHomeCardsList()
    const activePostList = queryHome('.home-post-list')
    if (!activeList || !activePostList) return

    mountHomeCardsLoadMoreUi(activeList, activePostList, sentinel, statusEl)

    loading = true
    setStatus('loading')

    const batchSize = getBatchSize()
    const batch = posts.slice(0, batchSize)
    posts = posts.slice(batchSize)

    const newCards = []
    batch.forEach((post) => {
      const item = createHomeCardsItem(post)
      activeList.appendChild(item)
      newCards.push(item)
    })

    refreshMount()
    initLazyImages(activeList)
    initHomeMobileListTimes(layout)
    syncHomeMobileListPins()
    observeHomePostListReveal(activePostList, newCards)

    loading = false

    if (!posts.length) {
      finish()
      return
    }

    showLoadHint()

    if (isSentinelNearViewport() && !autoLoadPaused) {
      requestAnimationFrame(() => loadNextBatch({ force: true }))
    } else if (observing) {
      scrollObserver?.unobserve(sentinel)
      scrollObserver?.observe(sentinel)
    }
  }

  const startObserving = () => {
    if (!loadMoreEnabled || !sentinel.isConnected) return
    if (!scrollObserver) createObserver()
    if (!observing) {
      scrollObserver.observe(sentinel)
      observing = true
    }
  }

  const stopObserving = () => {
    if (!observing || !scrollObserver) return
    scrollObserver.unobserve(sentinel)
    observing = false
    if (posts.length) showLoadHint()
    else setStatus('idle')
  }

  const syncLoadMoreState = () => {
    if (loadMoreEnabled) {
      startObserving()
      if (posts.length) showLoadHint()
      if (isSentinelNearViewport() && !autoLoadPaused) loadNextBatch()
    } else {
      stopObserving()
    }
  }

  const onScroll = () => {
    if (!loadMoreEnabled || scrollTick || loading || autoLoadPaused || !posts.length) return
    if (!isSentinelNearViewport()) return
    scrollTick = true
    requestAnimationFrame(() => {
      scrollTick = false
      loadNextBatch()
    })
  }

  const scrollListenerOpts = { passive: true }
  const scrollCaptureOpts = { passive: true, capture: true }
  window.addEventListener('scroll', onScroll, scrollListenerOpts)
  document.addEventListener('scroll', onScroll, scrollCaptureOpts)

  const pollId = setInterval(() => {
    if (!loadMoreEnabled || loading || autoLoadPaused || !posts.length) return
    if (isSentinelNearViewport()) loadNextBatch()
  }, 1000)

  if (!homeCardsLoadMoreStateBound) {
    homeCardsLoadMoreStateBound = true
    window.addEventListener('resize', syncLoadMoreState, scrollListenerOpts)
  }

  homeCardsLoader = {
    loadNextBatch,
    hasMore: () => posts.length > 0,
    refreshMount,
    sync: syncLoadMoreState,
    pauseAutoLoad: () => {
      autoLoadPaused = true
    },
    resumeAutoLoad: () => {
      autoLoadPaused = false
      if (loadMoreEnabled && isSentinelNearViewport()) loadNextBatch()
    },
  }

  homeCardsLoadMoreTeardown = () => {
    teardownObserver()
    window.removeEventListener('scroll', onScroll, scrollListenerOpts)
    document.removeEventListener('scroll', onScroll, scrollCaptureOpts)
    clearInterval(pollId)
    if (homeCardsLoadMoreStateBound) {
      window.removeEventListener('resize', syncLoadMoreState, scrollListenerOpts)
      homeCardsLoadMoreStateBound = false
    }
    homeCardsLoader = null
    homeCardsLoadMoreTeardown = null
    homeCardsInitAttempts = 0
  }

  registerPageCleanup(homeCardsLoadMoreTeardown)

  syncLoadMoreState()
}

export function scheduleHomeCardsLoadMoreSync() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      homeCardsLoader?.refreshMount?.()
      homeCardsLoader?.sync?.()
    })
  })
}

export function initHomeTimelineLoadMore() {
  const list = queryHome('.home-timeline-list')
  const variant = getActiveHomeVariant()
  const dataEl = variant?.querySelector('.home-timeline-more-data')
  const sentinel = variant?.querySelector('.home-timeline-scroll-sentinel')
  const statusEl = variant?.querySelector('.home-timeline-load-status')
  const root = queryHome('.home-post-list')
  if (!list || !dataEl || !sentinel || !root) return

  let posts = []
  try {
    posts = parseJsonData(dataEl)
  } catch (err) {
    console.warn('[home-timeline]', err)
    sentinel.remove()
    statusEl?.remove()
    return
  }

  if (!posts.length) {
    sentinel.remove()
    dataEl.remove()
    statusEl?.remove()
    return
  }

  const batchSize = Math.max(1, parseInt(sentinel.dataset.batchSize || '10', 10) || 10)
  let loading = false
  let autoLoadPaused = false
  let observing = false

  const setStatus = (mode) => {
    if (!statusEl) return
    if (mode === 'idle') {
      statusEl.hidden = true
      statusEl.textContent = ''
      statusEl.classList.remove('is-loading', 'is-done')
      return
    }
    statusEl.hidden = false
    statusEl.classList.toggle('is-loading', mode === 'loading')
    statusEl.classList.toggle('is-done', mode === 'done')
    statusEl.textContent = mode === 'loading' ? '加载中…' : '没有更多了'
  }

  const finish = () => {
    scrollObserver.disconnect()
    observing = false
    sentinel.remove()
    dataEl.remove()
    setStatus('done')
  }

  const isSentinelNearViewport = () => {
    if (!sentinel.isConnected) return false
    return sentinel.getBoundingClientRect().top <= window.innerHeight + 320
  }

  const loadNextBatch = ({ force = false } = {}) => {
    if (loading || (!force && autoLoadPaused) || !posts.length) return
    loading = true
    setStatus('loading')

    const batch = posts.slice(0, batchSize)
    posts = posts.slice(batchSize)

    const newCards = []
    batch.forEach((post) => {
      const item = createHomeTimelineItem(post)
      list.appendChild(item)
      const content = item.querySelector('.home-timeline-item__content')
      if (content) newCards.push(content)
    })

    observeHomePostListReveal(root, newCards)

    if (!posts.length) {
      finish()
    } else {
      setStatus('idle')
    }

    loading = false

    if (posts.length && isSentinelNearViewport() && (force || !autoLoadPaused)) {
      loadNextBatch({ force })
    }
  }

  const scrollObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadNextBatch()
  }, {
    root: null,
    rootMargin: '0px 0px 320px 0px',
    threshold: 0,
  })

  const startObserving = () => {
    if (observing || !sentinel.isConnected) return
    scrollObserver.observe(sentinel)
    observing = true
  }

  homeTimelineLoader = {
    loadNextBatch,
    hasMore: () => posts.length > 0,
    startObserving,
    pauseAutoLoad: () => {
      autoLoadPaused = true
    },
    resumeAutoLoad: () => {
      autoLoadPaused = false
      if (isSentinelNearViewport()) loadNextBatch()
    },
  }

  startObserving()

  registerPageCleanup(() => {
    scrollObserver.disconnect()
    homeTimelineLoader = null
  })
}

export function cleanupHomeObservers() {
  homePostListRevealObserver?.disconnect()
  homePostListRevealObserver = null
}

let homeListArchiveHeatmapTooltip = null
let homeListArchiveHeatmapCleanup = null
let homeListArchiveHeatmapTooltipCell = null
let homeListFeaturedCleanup = null

function normalizeArchiveDate(raw) {
  return String(raw || '').trim().replace(/^"+|"+$/g, '').slice(0, 10)
}

function getArchiveMonthKeyFromDateString(dateStr) {
  const normalized = normalizeArchiveDate(dateStr)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return ''
  return normalized.slice(0, 7)
}

function getArchiveHeatmapLevel(count) {
  if (!count) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count === 3) return 3
  return 4
}

function getArchiveHeatmapLayout(root) {
  const styles = getComputedStyle(root)
  const columns = Math.max(
    1,
    Number.parseInt(root.dataset.columns || styles.getPropertyValue('--home-list-archive-columns'), 10) || 1,
  )
  const rows = Math.max(
    1,
    Number.parseInt(root.dataset.rows || styles.getPropertyValue('--home-list-archive-rows'), 10) || 1,
  )
  const monthCount = Math.max(columns, columns * rows)
  return { columns, monthCount }
}

function buildArchiveHeatmapMonths(dates, monthCount) {
  const counts = {}
  dates.forEach((raw) => {
    const key = getArchiveMonthKeyFromDateString(raw)
    if (!key) return
    counts[key] = (counts[key] || 0) + 1
  })

  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  const months = []

  for (let i = 0; i < monthCount; i += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    months.unshift({
      key,
      year,
      month,
      count: counts[key] || 0,
    })
    month -= 1
    if (month < 1) {
      month = 12
      year -= 1
    }
  }

  return months.map((item) => ({
    ...item,
    level: getArchiveHeatmapLevel(item.count),
  }))
}

function ensureArchiveHeatmapTooltip() {
  if (!homeListArchiveHeatmapTooltip) {
    homeListArchiveHeatmapTooltip = document.createElement('div')
    homeListArchiveHeatmapTooltip.className = 'home-list-archive-heatmap__tooltip'
    homeListArchiveHeatmapTooltip.setAttribute('role', 'tooltip')
    document.body.appendChild(homeListArchiveHeatmapTooltip)
  }
  return homeListArchiveHeatmapTooltip
}

function showArchiveHeatmapTooltip(cell, text) {
  const tooltip = ensureArchiveHeatmapTooltip()
  homeListArchiveHeatmapTooltipCell = cell
  tooltip.textContent = text
  tooltip.classList.add('is-visible')
  updateArchiveHeatmapTooltipPosition()
}

function hideArchiveHeatmapTooltip() {
  homeListArchiveHeatmapTooltipCell = null
  homeListArchiveHeatmapTooltip?.classList.remove('is-visible')
}

function updateArchiveHeatmapTooltipPosition() {
  const cell = homeListArchiveHeatmapTooltipCell
  const tooltip = homeListArchiveHeatmapTooltip
  if (!cell || !tooltip?.classList.contains('is-visible')) return
  const rect = cell.getBoundingClientRect()
  tooltip.style.left = `${rect.left + rect.width / 2}px`
  tooltip.style.top = `${rect.top - 8}px`
}

function bindArchiveHeatmapTooltip(cell, text) {
  const show = () => showArchiveHeatmapTooltip(cell, text)
  const hide = () => hideArchiveHeatmapTooltip()
  cell.addEventListener('mouseenter', show)
  cell.addEventListener('mouseleave', hide)
  cell.addEventListener('focus', show)
  cell.addEventListener('blur', hide)
  return () => {
    cell.removeEventListener('mouseenter', show)
    cell.removeEventListener('mouseleave', hide)
    cell.removeEventListener('focus', show)
    cell.removeEventListener('blur', hide)
  }
}

export function initHomeListArchiveHeatmap() {
  homeListArchiveHeatmapCleanup?.()
  homeListArchiveHeatmapCleanup = null
  hideArchiveHeatmapTooltip()

  const root = queryHome('.home-list-archive-heatmap')
  const dataEl = getActiveHomeVariant()?.querySelector('.home-list-archive-heatmap-data')
  if (!root || !dataEl) return

  let dates = []
  try {
    dates = parseJsonData(dataEl)
  } catch (err) {
    console.warn('[home-list-archive-heatmap]', err)
    return
  }

  if (!Array.isArray(dates)) return

  const { columns, monthCount } = getArchiveHeatmapLayout(root)
  const months = buildArchiveHeatmapMonths(dates, monthCount)

  const archivesUrl = root.dataset.archivesUrl || '/archives/'
  const tooltipCleanups = []

  const grid = document.createElement('div')
  grid.className = 'home-list-archive-heatmap__grid'
  grid.style.setProperty('--home-list-archive-columns', String(columns))
  grid.setAttribute('role', 'img')
  grid.setAttribute('aria-label', '文章发布月历热力图')

  months.forEach((month) => {
    const item = document.createElement('div')
    item.className = 'home-list-archive-heatmap__month-item'

    const cell = document.createElement('button')
    cell.type = 'button'
    cell.className = 'home-list-archive-heatmap__cell'
    cell.dataset.level = String(month.level)

    const tip = month.count
      ? `${month.key} · ${month.count} 篇`
      : `${month.key} · 无发布`
    cell.setAttribute('aria-label', tip)
    tooltipCleanups.push(bindArchiveHeatmapTooltip(cell, tip))

    if (month.count > 0) {
      cell.dataset.hasPost = 'true'
      cell.addEventListener('click', () => {
        window.location.href = `${archivesUrl}#archive-year-${month.year}`
      })
    }

    item.appendChild(cell)
    grid.appendChild(item)
  })

  root.replaceChildren(grid)

  const onScroll = () => updateArchiveHeatmapTooltipPosition()
  window.addEventListener('scroll', onScroll, { passive: true, capture: true })

  homeListArchiveHeatmapCleanup = () => {
    tooltipCleanups.forEach((cleanup) => cleanup())
    window.removeEventListener('scroll', onScroll, { capture: true })
    hideArchiveHeatmapTooltip()
  }
  registerPageCleanup(homeListArchiveHeatmapCleanup)
}

function getHomeFeaturedVisibleCount(root) {
  const raw = getComputedStyle(root).getPropertyValue('--home-list-featured-visible').trim()
  const count = Number.parseInt(raw, 10)
  return Number.isFinite(count) && count > 0 ? count : 4
}

const HOME_LIST_RANDOM_STORAGE_KEY = 'sakura-home-random-posts'

function readStoredRandomPosts() {
  try {
    const raw = sessionStorage.getItem(HOME_LIST_RANDOM_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStoredRandomPosts(posts) {
  try {
    if (posts?.length) sessionStorage.setItem(HOME_LIST_RANDOM_STORAGE_KEY, JSON.stringify(posts))
  } catch {
    /* ignore */
  }
}

export function initHomeListRandomSidebar() {
  const sidebar = getActiveHomeVariant()?.querySelector('.home-list-random-sidebar')
  const list = queryHome('.home-list-random-posts-list')
  const dataEl = getActiveHomeVariant()?.querySelector('.home-list-random-posts-data')
  if (!list || !dataEl) return

  let posts = []
  try {
    posts = parseJsonData(dataEl)
  } catch (err) {
    console.warn('[home-list-random]', err)
    return
  }

  const count = Math.max(
    1,
    Number.parseInt(sidebar?.dataset.randomCount || '', 10) || posts.length,
  )

  let picked = null
  if (isPjaxContentMounting()) {
    picked = readStoredRandomPosts()
  }
  if (!picked?.length) {
    picked = shuffleArray(posts).slice(0, Math.min(count, posts.length))
    writeStoredRandomPosts(picked)
  } else {
    picked = picked.slice(0, Math.min(count, picked.length))
  }

  list.innerHTML = picked.map((post) => `
    <li class="home-list-random-sidebar__item">
      <a class="home-list-random-sidebar__link" href="${escapeHtml(post.url)}">
        <span class="home-list-random-sidebar__post-title">${escapeHtml(post.title)}</span>
        <time class="home-list-random-sidebar__date" datetime="${escapeHtml(post.dateTime || post.date || '')}">${escapeHtml(post.date || '')}</time>
      </a>
    </li>
  `).join('')
}

export function initHomeListFeatured() {
  homeListFeaturedCleanup?.()
  homeListFeaturedCleanup = null

  const root = queryHome('.home-list-featured')
  const viewport = root?.querySelector('.home-list-featured__viewport')
  const track = root?.querySelector('.home-list-featured-track')
  if (!root || !viewport || !track) return

  const cards = [...track.querySelectorAll('.home-list-featured-card')]
  if (!cards.length) return

  initLazyImages(root)

  const navs = root.querySelector('.home-list-featured__navs')
  const prevBtn = root.querySelector('.home-list-featured__nav--prev')
  const nextBtn = root.querySelector('.home-list-featured__nav--next')
  const visibleCount = getHomeFeaturedVisibleCount(root)
  const canLoop = cards.length > visibleCount
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const getStep = () => {
    if (cards.length < 2) return cards[0]?.getBoundingClientRect().width || 0
    return cards[1].offsetLeft - cards[0].offsetLeft
  }

  const syncNavState = () => {
    if (!canLoop) {
      navs?.setAttribute('hidden', '')
      viewport.scrollLeft = 0
      return
    }
    navs?.removeAttribute('hidden')
  }

  const scrollByStep = (delta) => {
    const step = getStep()
    if (!step) return
    viewport.scrollBy({
      left: delta * step,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    })
  }

  const onPrev = () => scrollByStep(-1)
  const onNext = () => scrollByStep(1)
  const onResize = () => syncNavState()

  prevBtn?.addEventListener('click', onPrev)
  nextBtn?.addEventListener('click', onNext)
  window.addEventListener('resize', onResize, { passive: true })

  syncNavState()

  homeListFeaturedCleanup = () => {
    prevBtn?.removeEventListener('click', onPrev)
    nextBtn?.removeEventListener('click', onNext)
    window.removeEventListener('resize', onResize)
    viewport.scrollLeft = 0
  }
  registerPageCleanup(homeListFeaturedCleanup)
}
