
import { registerPageCleanup } from './page-cleanup.js'
import { escapeHtml, parseJsonData, shuffleArray } from './utils.js'
import { initLazyImages } from './lazy-images.js'

const RSS_MIN_BODY_LENGTH = 80
const RSS_MAX_VISIBLE_PER_FEED = 2

const FOOTER_LINKS_TOTAL = 12
const FOOTER_LINKS_MOBILE_MAX = 4
const FOOTER_GROUP1_MAX = 8
const FOOTER_LINKS_MOBILE_MQ = '(max-width: 480px)'

function normalizeFooterLink(link) {
  const url = String(link?.url || '').trim()
  const name = String(link?.blog || link?.name || '').trim()
  if (!url || !name) return null
  return { url, name }
}

function renderFooterLinksList(links) {
  if (!links.length) return ''
  return `<ul class="sakura-footer-links__list">${links.map(({ url, name }) =>
    `<li><a href="${escapeHtml(url)}" target="_blank" rel="friend noopener">${escapeHtml(name)}</a></li>`,
  ).join('')}</ul>`
}

let footerLinksAllCache = null

function buildFooterLinksAll(data) {
  const group1 = (Array.isArray(data.group1) ? data.group1 : [])
    .map(normalizeFooterLink)
    .filter(Boolean)
  const group2 = (Array.isArray(data.group2) ? data.group2 : [])
    .map(normalizeFooterLink)
    .filter(Boolean)
  const pickedGroup1 = group1.slice(0, FOOTER_GROUP1_MAX)
  const group2Count = Math.max(0, FOOTER_LINKS_TOTAL - pickedGroup1.length)
  const pickedGroup2 = shuffleArray(group2).slice(0, group2Count)
  return [...pickedGroup1, ...pickedGroup2]
}

function getFooterLinksDisplayLimit() {
  return window.matchMedia(FOOTER_LINKS_MOBILE_MQ).matches
    ? FOOTER_LINKS_MOBILE_MAX
    : FOOTER_LINKS_TOTAL
}

function renderFooterLinksNav() {
  const linksEl = document.getElementById('sakura-footer-links')
  if (!linksEl || !footerLinksAllCache?.length) return

  const display = footerLinksAllCache.slice(0, getFooterLinksDisplayLimit())
  linksEl.innerHTML = renderFooterLinksList(display)
  linksEl.removeAttribute('hidden')
}

let footerLinksMqBound = false
let footerLinksInitialized = false

export function initFooterLinks() {
  if (footerLinksInitialized) return

  const dataEl = document.getElementById('footer-links-data')
  const linksEl = document.getElementById('sakura-footer-links')
  if (!dataEl || !linksEl) return

  let data
  try {
    data = parseJsonData(dataEl)
  } catch (err) {
    console.warn('[footer-links]', err)
    return
  }

  footerLinksAllCache = buildFooterLinksAll(data)
  if (!footerLinksAllCache.length) return

  renderFooterLinksNav()
  footerLinksInitialized = true

  if (footerLinksMqBound) return
  footerLinksMqBound = true

  const mq = window.matchMedia(FOOTER_LINKS_MOBILE_MQ)
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', renderFooterLinksNav)
  } else if (typeof mq.addListener === 'function') {
    mq.addListener(renderFooterLinksNav)
  }
}

function isValidRssFeed(feed) {
  return Boolean(
    feed
    && String(feed.rss || '').trim()
    && Array.isArray(feed.articles)
    && feed.articles.length > 0,
  )
}

function buildLinksRssPool(feeds) {
  return feeds.flatMap((feed) =>
    (feed.articles || [])
      .filter((article) => hasEnoughRssBody(article))
      .map((article) => ({ article, feed })),
  )
}

function getRssFeedKey(feed) {
  return String(feed?.rss || feed?.url || feed?.name || '').trim()
}

function pickVisibleRssArticles(articles, count) {
  const visible = []
  const perFeedCount = new Map()

  for (const item of articles) {
    if (visible.length >= count) break
    if (!hasEnoughRssBody(item.article)) continue

    const feedKey = getRssFeedKey(item.feed)
    const used = perFeedCount.get(feedKey) || 0
    if (used >= RSS_MAX_VISIBLE_PER_FEED) continue

    visible.push(item)
    perFeedCount.set(feedKey, used + 1)
  }

  return visible
}

function pickRssArticleBody(article) {
  let body = String(article.content || '').trim()
  const title = String(article.title || '').trim()
  const desc = String(article.description || '').trim()

  if (!body) return ''

  if (desc && (body === desc || body.startsWith(desc))) {
    body = body.slice(desc.length).trim()
  }
  if (title && (body === title || body.startsWith(title))) {
    body = body.slice(title.length).trim()
  }

  return body
}

function getRssArticleDisplayParts(article, minLen = RSS_MIN_BODY_LENGTH) {
  const desc = String(article.description || '').trim()
  const body = pickRssArticleBody(article)

  if (body.length >= minLen) {
    return { summary: desc, body }
  }

  const raw = String(article.content || '').trim()
  if (raw.length >= minLen) {
    return { summary: '', body: raw }
  }

  return { summary: desc, body: '' }
}

function hasEnoughRssBody(article, minLen = RSS_MIN_BODY_LENGTH) {
  const { summary, body } = getRssArticleDisplayParts(article, minLen)
  return (body || summary).length >= minLen
}

function renderLinksRssCard(article, linkMeta, defaultCover) {
  const color = escapeHtml(linkMeta.color || '#0078e7')
  const linkName = escapeHtml(linkMeta.blog || linkMeta.name || '友链站点')
  const linkDesc = escapeHtml(linkMeta.desc || '')
  const avatar = escapeHtml(linkMeta.avatar || defaultCover)
  const url = escapeHtml(article.link)
  const articleTitle = escapeHtml(article.title || '无标题')
  const { summary, body } = getRssArticleDisplayParts(article)
  const summaryHtml = summary
    ? `<div class="links-rss-article__summary">${escapeHtml(summary)}</div>`
    : ''
  const bodyHtml = body
    ? `<div class="links-rss-article__body">${escapeHtml(body)}</div>`
    : ''
  const contentClass = summary
    ? 'links-rss-article__content'
    : 'links-rss-article__content links-rss-article__content--body-only'
  const contentHtml = (summaryHtml || bodyHtml)
    ? `<div class="${contentClass}">${summaryHtml}${bodyHtml}</div>`
    : ''

  return `<li class="links-preview-item" style="--link-color: ${color}">
    <a class="links-preview-card" href="${url}" target="_blank" rel="noopener">
      <div class="links-preview-shot links-preview-shot--excerpt">
        <div class="links-rss-article__title">${articleTitle}</div>
        ${contentHtml}
      </div>
      <div class="links-preview-meta">
        <img class="sakura-lazy-img links-preview-avatar" src="${avatar}" alt="${linkName}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${escapeHtml(defaultCover)}'">
        <div class="links-preview-text">
          <div class="links-preview-name">${linkName}</div>
          <div class="links-preview-desc">${linkDesc || linkName}</div>
        </div>
      </div>
    </a>
  </li>`
}

function getLinksRssRowCount(grid) {
  if (!grid) return 1
  if (window.matchMedia('(max-width: 768px)').matches) return 2

  const section = grid.closest('.links-rss-spotlight')
  const page = grid.closest('.sakura-links-page')
  const pageStyle = page ? getComputedStyle(page) : getComputedStyle(document.documentElement)
  const cardWidth = parseFloat(pageStyle.getPropertyValue('--link-card-width')) || 210
  const gridStyle = getComputedStyle(grid)
  const gap = parseFloat(gridStyle.columnGap) || parseFloat(gridStyle.gap) || 14

  let width = section?.clientWidth || grid.clientWidth
  if (width <= 0) {
    const content = page?.querySelector('.sakura-page-content')
    if (content) {
      const contentStyle = getComputedStyle(content)
      width = content.clientWidth
        - (parseFloat(contentStyle.paddingLeft) || 0)
        - (parseFloat(contentStyle.paddingRight) || 0)
    }
  }

  if (width <= 0) return 1
  return Math.max(1, Math.floor((width + gap) / (cardWidth + gap)))
}

let linksRssSpotlightState = null
let linksRssSpotlightResizeTimer = null
let linksRssSpotlightResizeObserver = null

function bindLinksRssSpotlightResize(section) {
  if (!section || section.dataset.rssResizeBound) return
  section.dataset.rssResizeBound = '1'

  const scheduleRender = () => {
    clearTimeout(linksRssSpotlightResizeTimer)
    linksRssSpotlightResizeTimer = setTimeout(renderLinksRssSpotlightGrid, 100)
  }

  window.addEventListener('resize', scheduleRender)
  registerPageCleanup(() => {
    window.removeEventListener('resize', scheduleRender)
    section.dataset.rssResizeBound = ''
  })

  if (typeof ResizeObserver !== 'undefined') {
    linksRssSpotlightResizeObserver?.disconnect()
    linksRssSpotlightResizeObserver = new ResizeObserver(scheduleRender)
    const observeTarget = section.closest('.sakura-page-content') || section
    linksRssSpotlightResizeObserver.observe(observeTarget)
  }
}

function renderLinksRssSpotlightGrid() {
  const state = linksRssSpotlightState
  if (!state) return

  const { section, grid, articles, defaultCover } = state
  const count = getLinksRssRowCount(grid)
  const visible = pickVisibleRssArticles(articles, count)

  if (!visible.length) {
    section.hidden = true
    grid.hidden = true
    grid.innerHTML = ''
    return
  }

  section.hidden = false
  grid.hidden = false
  grid.innerHTML = visible.map(({ article, feed }) => renderLinksRssCard(article, feed, defaultCover)).join('')
  initLazyImages(section)
}

export function initLinksPreviewShuffle() {
  if (window.__sakuraPjaxMounting) return

  const root = document.querySelector('.links-preview')
  if (!root) return

  const rootShuffle = root.dataset.shuffleGroups !== 'false'

  root.querySelectorAll('.links-preview-group .links-preview-grid').forEach((grid) => {
    const group = grid.closest('.links-preview-group')
    const raw = group?.dataset.shuffle
    const shuffleEnabled =
      raw === 'true' ? true : raw === 'false' ? false : rootShuffle

    const items = [...grid.children].filter((el) => el.matches('.links-preview-item'))
    const pinned = items.filter((el) => el.dataset.pinLast === 'true')
    let shuffleable = items.filter((el) => el.dataset.pinLast !== 'true')

    if (shuffleEnabled && shuffleable.length >= 2) {
      shuffleable = shuffleArray(shuffleable)
    }

    shuffleable.forEach((item) => grid.appendChild(item))
    pinned.forEach((item) => grid.appendChild(item))
  })
}

export async function initLinksRssSpotlight() {
  const section = document.getElementById('links-rss-spotlight')
  const dataEl = document.getElementById('links-rss-feeds')
  const grid = document.getElementById('links-rss-spotlight-grid')
  const loadingEl = document.getElementById('links-rss-spotlight-loading')
  const titleEl = document.getElementById('links-rss-spotlight-title')
  const sourceEl = document.getElementById('links-rss-spotlight-source')
  if (!section || !dataEl || !grid) return

  let feeds = []
  try {
    feeds = parseJsonData(dataEl).filter(isValidRssFeed)
  } catch (err) {
    console.warn('[links-rss]', err)
    return
  }

  if (!feeds.length) return

  const defaultCover = section.dataset.defaultCover || '/hero/tt3.png'
  const pool = shuffleArray(buildLinksRssPool(feeds))
  if (!pool.length) return

  if (titleEl) titleEl.textContent = '朋友动态'
  if (sourceEl) sourceEl.textContent = '要去朋友们的文章看看吗~'

  linksRssSpotlightState = { section, grid, articles: pool, defaultCover }

  section.hidden = false
  if (loadingEl) loadingEl.hidden = true
  grid.hidden = false

  renderLinksRssSpotlightGrid()
  requestAnimationFrame(renderLinksRssSpotlightGrid)

  bindLinksRssSpotlightResize(section)
}

export function cleanupLinksRssSpotlight() {
  linksRssSpotlightState = null
  window.clearTimeout(linksRssSpotlightResizeTimer)
  linksRssSpotlightResizeObserver?.disconnect()
  linksRssSpotlightResizeObserver = null
}
