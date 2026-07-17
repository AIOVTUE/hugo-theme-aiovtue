import { registerPageCleanup } from './page-cleanup.js'
import { escapeHtml, parseJsonData } from './utils.js'
import { initLazyImages } from './lazy-images.js'

const WEEKDAYS_EN = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const WEEKDAYS_CN = ['日', '一', '二', '三', '四', '五', '六']
const MONTHS_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

let weeklyCleanup = null
let weeklyInitAttempts = 0

function renderWeeklyTagsHtml(tags) {
  if (!Array.isArray(tags) || !tags.length) return ''
  return tags.slice(0, 3).map((tag) => (
    `<span class="weekly-card__tag">${escapeHtml(tag)}</span>`
  )).join('')
}

function renderWeeklyCoverHtml(post) {
  if (!post.cover) return '<div class="weekly-card__cover-placeholder" aria-hidden="true"></div>'
  const src = escapeHtml(post.cover)
  const title = escapeHtml(post.title || '')
  if (post.coverIsVideo) {
    return `<video class="sakura-cover-thumb weekly-card__cover-img" src="${src}" muted playsinline preload="metadata" disablepictureinpicture aria-hidden="true"></video>`
  }
  return `<img class="weekly-card__cover-img" src="${src}" alt="${title}" loading="lazy" decoding="async">`
}

function getMonthEn(dateTime) {
  if (!dateTime) return ''
  const month = parseInt(dateTime.slice(5, 7), 10)
  return MONTHS_EN[month - 1] || ''
}

function getWeekdayIdx(dateTime) {
  if (!dateTime) return 0
  const date = new Date(dateTime)
  return Number.isNaN(date.getTime()) ? 0 : date.getDay()
}

function formatCompactDate(dateTime) {
  if (!dateTime) return ''
  return dateTime.slice(0, 10).replace(/-/g, '.')
}

function renderMagDateHtml(post) {
  const issue = String(post.issue || '1').padStart(2, '0')
  const day = post.dateDay || ''
  const year = post.dateYear || ''
  const monthEn = getMonthEn(post.dateTime)
  const weekdayIdx = getWeekdayIdx(post.dateTime)
  const weekdayCn = WEEKDAYS_CN[weekdayIdx] || ''
  const weekdayEn = WEEKDAYS_EN[weekdayIdx] || ''

  return `
    <aside class="weekly-mag-date weekly-mag-date--light" aria-label="发布日期">
      <time class="weekly-mag-date__time" datetime="${escapeHtml(post.dateTime || '')}"${post.dateOnly ? ' data-date-only="true"' : ''}>
        <span class="weekly-mag-date__brand">WEEKLY MAGAZINE</span>
        <span class="weekly-mag-date__issue-num">${escapeHtml(issue)}</span>
        <span class="weekly-mag-date__issue-label">ISSUE</span>
        <span class="weekly-mag-date__year-bar">${escapeHtml(year)} ${escapeHtml(monthEn)}</span>
        <span class="weekly-mag-date__day-num">${escapeHtml(day)}</span>
        <span class="weekly-mag-date__weekday">周${escapeHtml(weekdayCn)} <span>${escapeHtml(weekdayEn)}</span></span>
      </time>
    </aside>
  `
}

function renderMediaHtml(post, curve) {
  return `
    <div class="weekly-card__media weekly-card__media--curve-${curve}">
      <div class="weekly-card__media-shape">
        ${renderWeeklyCoverHtml(post)}
      </div>
    </div>
  `
}

function renderArchStrokeHtml(curve) {
  const path = curve === 'right'
    ? 'M 92 0 C 97 20 100 34 100 50 C 100 66 97 80 90 100'
    : 'M 8 0 C 3 20 0 34 0 50 C 0 66 3 80 10 100'
  return `
    <div class="weekly-card__arch-stroke weekly-card__arch-stroke--${curve}" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="${path}" fill="none" stroke="currentColor" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  `
}

function renderMagCard(post) {
  const isReverse = (post.index % 2) === 1
  const issue = post.issue ? String(post.issue) : '1'
  const tagsHtml = renderWeeklyTagsHtml(post.tags)
  const pinHtml = post.pinned
    ? '<span class="sakura-post-pin" title="置顶" aria-label="置顶"><iconify-icon icon="mdi:pin" aria-hidden="true"></iconify-icon></span>'
    : ''

  const bodyHtml = `
    <div class="weekly-card__body">
      <div class="weekly-card__label-row">
        <span class="weekly-card__issue">
          <span class="weekly-card__issue-label">ISSUE</span>
          <span class="weekly-card__issue-num">${escapeHtml(issue.padStart(2, '0'))}</span>
        </span>
        <time class="weekly-card__mobile-date" datetime="${escapeHtml(post.dateTime || '')}"${post.dateOnly ? ' data-date-only="true"' : ''}>${escapeHtml(formatCompactDate(post.dateTime))}</time>
      </div>
      <h2 class="weekly-card__title">${escapeHtml(post.title || '')}</h2>
      <p class="weekly-card__excerpt">${escapeHtml(post.excerpt || '')}</p>
      <div class="weekly-card__meta-row">
        ${tagsHtml ? `<div class="weekly-card__tags">${tagsHtml}</div>` : '<div class="weekly-card__tags"></div>'}
        <span class="weekly-card__read-more">继续阅读<iconify-icon icon="ri:arrow-right-line" class="sakura-icon" aria-hidden="true"></iconify-icon></span>
      </div>
    </div>
  `

  const parts = isReverse
    ? [
      renderMediaHtml(post, 'right'),
      bodyHtml,
      renderMagDateHtml(post),
    ]
    : [
      renderMagDateHtml(post),
      bodyHtml,
      renderMediaHtml(post, 'left'),
    ]

  return `
    ${pinHtml}
    <a class="weekly-card__link" href="${escapeHtml(post.url)}" aria-label="阅读全文：${escapeHtml(post.title)}">
      ${parts.join('')}
    </a>
    ${renderArchStrokeHtml(isReverse ? 'right' : 'left')}
  `
}

function createWeeklyCardItem(post) {
  const article = document.createElement('article')
  const layoutClass = (post.index % 2) === 1 ? ' weekly-card--layout-b' : ' weekly-card--layout-a'
  article.className = `weekly-card weekly-card--mag${layoutClass}${post.pinned ? ' is-pinned' : ''}`
  article.innerHTML = renderMagCard(post)
  return article
}

function isSentinelNearViewport(sentinel) {
  if (!sentinel?.isConnected) return false
  return sentinel.getBoundingClientRect().top <= window.innerHeight + 480
}

export function bootstrapWeeklyLoadMore() {
  initWeeklyLoadMore()
}

export function initWeeklyLoadMore() {
  weeklyCleanup?.()
  weeklyCleanup = null

  const root = document.getElementById('weekly-posts')
  if (!root) return

  const list = document.getElementById('weekly-post-list')
  const dataEl = root.querySelector('.weekly-more-data')
  const sentinel = root.querySelector('.weekly-scroll-sentinel')
  const statusEl = root.querySelector('.weekly-load-status')
  if (!list || !dataEl || !sentinel) {
    if (weeklyInitAttempts < 15) {
      weeklyInitAttempts += 1
      requestAnimationFrame(() => initWeeklyLoadMore())
    }
    return
  }
  weeklyInitAttempts = 0

  const loadMoreEnabled = root.dataset.paging === 'loadMore'
  if (!loadMoreEnabled) return

  let posts = []
  try {
    posts = parseJsonData(dataEl)
  } catch (err) {
    console.warn('[weekly]', err)
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
  let scrollObserver = null
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
    scrollObserver?.disconnect()
    scrollObserver = null
    observing = false
    sentinel.remove()
    dataEl.remove()
    setStatus('done')
  }

  const loadNextBatch = () => {
    if (!loadMoreEnabled || loading || !posts.length) return

    loading = true
    setStatus('loading')

    const batch = posts.slice(0, getBatchSize())
    posts = posts.slice(batch.length)

    batch.forEach((post) => {
      list.appendChild(createWeeklyCardItem(post))
    })

    initLazyImages(list)
    loading = false

    if (!posts.length) {
      finish()
      return
    }

    setStatus('idle')
    if (isSentinelNearViewport(sentinel)) {
      requestAnimationFrame(() => loadNextBatch())
      return
    }

    if (sentinel.isConnected && scrollObserver) {
      scrollObserver.unobserve(sentinel)
      scrollObserver.observe(sentinel)
    }
  }

  const startObserving = () => {
    if (!loadMoreEnabled || !sentinel.isConnected) return
    if (!scrollObserver) {
      scrollObserver = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadNextBatch()
      }, {
        root: null,
        rootMargin: '0px 0px 480px 0px',
        threshold: 0,
      })
    }
    if (!observing) {
      scrollObserver.observe(sentinel)
      observing = true
    }
  }

  const syncLoadMoreState = () => {
    if (!loadMoreEnabled) {
      scrollObserver?.disconnect()
      observing = false
      setStatus('idle')
      return
    }
    startObserving()
    if (posts.length && isSentinelNearViewport(sentinel)) {
      loadNextBatch()
    }
  }

  syncLoadMoreState()

  weeklyCleanup = () => {
    scrollObserver?.disconnect()
    observing = false
  }

  registerPageCleanup(() => {
    weeklyCleanup?.()
    weeklyCleanup = null
  })
}
