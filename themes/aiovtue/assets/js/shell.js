import { scheduleLive2dInit } from './live2d-widget.js'
import { scheduleMouseStyleInit } from './tuantuanma-mouse.js'
import {
  consumeHomePaginationIntent,
  initPageNav,
  isHomeListPath,
  pickHomeListScroll,
} from './page-nav.js'
import { openSakuraLightbox } from './lightbox.js'
import {
  refreshHomeNavbar,
  refreshMobileNavbarCollapse,
  refreshDesktopNavbarCollapse,
  initHomeNavbar,
  initMobileNavbarCollapse,
  initDesktopNavbarCollapse,
  initNavbarLinkScroll,
  initNavbarDropdown,
  initBrandRotate,
} from './navbar.js'
import { initSidebar } from './sidebar.js'
import { initSearchModal } from './search-modal.js'
import {
  getActiveHomeVariant,
  scrollToPostList,
  restoreHomeListScroll,
  shouldScrollToPostListForUrl,
} from './home.js'

function scheduleSiteEffectsInitLazy() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (!document.getElementById('sakura-site-effects-config')) return

  import('./site-effects.js')
    .then((mod) => {
      if (mod.shouldUseSiteEffects()) mod.scheduleSiteEffectsInit()
    })
    .catch((err) => console.warn('[site-effects]', err))
}

function applyTheme(root, isDark) {
  root.classList.toggle('dark', isDark)
  localStorage.setItem('sakura-theme', isDark ? 'dark' : 'light')
}

function getThemeToggleOrigin(event) {
  const button = document.getElementById('theme-toggle')
  const rect = button?.getBoundingClientRect()
  const x = event?.clientX ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2)
  const y = event?.clientY ?? (rect ? rect.top + rect.height / 2 : window.innerHeight / 2)
  return { x, y }
}

function toggleTheme(event) {
  const root = document.documentElement
  const nextDark = !root.classList.contains('dark')
  const apply = () => applyTheme(root, nextDark)

  if (
    !document.startViewTransition
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    apply()
    return
  }

  const { x, y } = getThemeToggleOrigin(event)
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  )
  const transitionClass = nextDark ? 'theme-transition-to-dark' : 'theme-transition-to-light'

  root.classList.remove('theme-transition-to-dark', 'theme-transition-to-light')
  root.classList.add(transitionClass)

  const transition = document.startViewTransition(apply)

  transition.ready.then(() => {
    const toDark = nextDark
    document.documentElement.animate(
      {
        clipPath: toDark
          ? [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ]
          : [
            `circle(${endRadius}px at ${x}px ${y}px)`,
            `circle(0px at ${x}px ${y}px)`,
          ],
      },
      {
        duration: 320,
        easing: 'ease-in-out',
        pseudoElement: toDark ? '::view-transition-new(root)' : '::view-transition-old(root)',
      },
    )
  }).catch(() => {})

  transition.finished.finally(() => {
    root.classList.remove('theme-transition-to-dark', 'theme-transition-to-light')
  })
}

export function bootShell({ mountPage, unmountPage }) {
  const root = document.documentElement
  const stored = localStorage.getItem('sakura-theme')
  if (stored === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  document.getElementById('theme-toggle')?.addEventListener('click', (event) => {
    toggleTheme(event)
  })

  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebar-overlay')
  const toggleSidebar = (open) => {
    sidebar?.classList.toggle('is-open', open)
    overlay?.classList.toggle('is-open', open)
    sidebar?.setAttribute('aria-hidden', open ? 'false' : 'true')
    const menuBtn = document.getElementById('sidebar-toggle')
    menuBtn?.classList.toggle('mobile-btn-open', open)
    menuBtn?.setAttribute('aria-expanded', open ? 'true' : 'false')
  }
  document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
    toggleSidebar(!sidebar?.classList.contains('is-open'))
  })
  overlay?.addEventListener('click', () => toggleSidebar(false))
  initSidebar(toggleSidebar)

  initHomeNavbar()
  initMobileNavbarCollapse()
  initDesktopNavbarCollapse()
  initNavbarLinkScroll()
  initNavbarDropdown()
  initBrandRotate()
  initSearchModal()
  scheduleLive2dInit()
  scheduleMouseStyleInit()
  scheduleSiteEffectsInitLazy()

  window.addEventListener('sakura:open-lightbox', (event) => {
    const { urls, index } = event.detail || {}
    openSakuraLightbox(urls, index ?? 0)
  })

  initPageNav({
    mountPage,
    unmountPage,
    collectHomeListScrollExtra() {
      const variant = getActiveHomeVariant()
      const timeline = variant?.querySelector('.home-timeline-list')
      if (timeline) {
        return {
          timelineItems: timeline.querySelectorAll('.home-timeline-item').length,
          cardsItems: 0,
        }
      }
      const cards = variant?.querySelector('.home-cards-list')
      if (cards) {
        return {
          timelineItems: 0,
          cardsItems: cards.querySelectorAll('.sakura-post-card').length,
        }
      }
      return {}
    },
    resolveScrollAfterMount(url, { scrollTop = true, scrollY = 0 } = {}) {
      if (!isHomeListPath(url)) return null

      if (consumeHomePaginationIntent(url)) {
        return () => scrollToPostList()
      }

      const picked = pickHomeListScroll(
        url,
        !scrollTop && typeof scrollY === 'number' ? scrollY : null,
      )

      if (picked && picked.y > 0) {
        return () => restoreHomeListScroll(picked)
      }

      if (shouldScrollToPostListForUrl(url)) {
        return () => scrollToPostList()
      }

      return null
    },
    onNavigateComplete() {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      refreshHomeNavbar?.()
      refreshMobileNavbarCollapse?.()
      refreshDesktopNavbarCollapse?.()
    },
  })
}

export function bindCopyYmlBtn() {
  const btn = document.getElementById('copy-yml-btn')
  if (!btn || btn.dataset.bound === '1') return
  btn.dataset.bound = '1'
  btn.addEventListener('click', async () => {
    const el = document.getElementById('yml-template')
    const text = el?.value || el?.textContent || ''
    try { await navigator.clipboard.writeText(text) } catch (_) {}
  })
}
