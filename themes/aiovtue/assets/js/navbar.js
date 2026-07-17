
export let refreshHomeNavbar = null
export let refreshMobileNavbarCollapse = null
export let refreshDesktopNavbarCollapse = null

const MOBILE_NAVBAR_MQ = '(max-width: 768px)'
const DESKTOP_NAVBAR_MQ = '(min-width: 769px)'

export function getNavbarLayoutOffset() {
  const root = document.documentElement
  const layoutOffset = Number.parseFloat(
    getComputedStyle(root).getPropertyValue('--sakura-navbar-layout-offset').trim(),
  )
  if (Number.isFinite(layoutOffset)) return layoutOffset

  return Number.parseInt(getComputedStyle(root).getPropertyValue('--sakura-navbar-height'), 10) || 65
}

function isNavbarCollapseBlocked(navbar) {
  if (document.documentElement.classList.contains('is-search-open')) return true
  if (navbar.classList.contains('is-scroll-locked')) return true
  if (document.getElementById('sidebar')?.classList.contains('is-open')) return true
  return false
}

function initNavbarScrollCollapse({
  flagAttr,
  readyAttr,
  collapsedClass,
  mediaQuery,
  collapseOnHomeAttr,
  thresholdAttr,
  deltaAttr,
  revealModeAttr,
  fallbackThreshold,
  fallbackDelta,
  setRefresh,
}) {
  const navbar = document.getElementById('navbar')
  if (!navbar || navbar.getAttribute(flagAttr) !== '1') return
  if (navbar.dataset[readyAttr] === '1') return
  navbar.dataset[readyAttr] = '1'

  const threshold = Number.parseInt(navbar.getAttribute(thresholdAttr) || '', 10)
  const scrollDelta = Number.parseInt(navbar.getAttribute(deltaAttr) || '', 10)
  const revealMode = navbar.getAttribute(revealModeAttr) || 'scrollUp'
  const scrollThreshold = Number.isFinite(threshold) && threshold >= 0 ? threshold : fallbackThreshold
  const minDelta = Number.isFinite(scrollDelta) && scrollDelta > 0 ? scrollDelta : fallbackDelta
  const collapseOnHome = navbar.getAttribute(collapseOnHomeAttr) === '1'

  let lastScrollY = window.scrollY
  let collapsed = false
  let scrollRaf = 0

  const isEnabledContext = () => {
    if (!window.matchMedia(mediaQuery).matches) return false
    if (document.documentElement.classList.contains('is-home') && !collapseOnHome) return false
    if (isNavbarCollapseBlocked(navbar)) return false
    return true
  }

  const setCollapsed = (next) => {
    if (collapsed === next) return
    collapsed = next
    navbar.classList.toggle(collapsedClass, next)
  }

  const update = () => {
    if (!isEnabledContext()) {
      setCollapsed(false)
      lastScrollY = window.scrollY
      return
    }

    const scrollY = window.scrollY
    if (scrollY <= scrollThreshold) {
      setCollapsed(false)
    } else {
      const diff = scrollY - lastScrollY
      if (diff > minDelta) {
        setCollapsed(true)
      } else if (revealMode === 'scrollUp' && diff < -minDelta) {
        setCollapsed(false)
      }
    }

    lastScrollY = scrollY
  }

  const scheduleUpdate = () => {
    if (scrollRaf) return
    scrollRaf = window.requestAnimationFrame(() => {
      scrollRaf = 0
      update()
    })
  }

  window.addEventListener('scroll', scheduleUpdate, { passive: true })
  window.addEventListener('resize', scheduleUpdate, { passive: true })

  setRefresh(() => {
    lastScrollY = window.scrollY
    update()
  })

  update()
}

export function initHomeNavbar() {
  const navbar = document.getElementById('navbar')
  const content = document.getElementById('navbar-content')
  const links = document.getElementById('navbar-links')
  if (!navbar || !content) return

  const offset = 0
  const canHoverNavbar = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

  const update = () => {
    if (document.documentElement.classList.contains('is-search-open')) return

    const isHome = document.documentElement.classList.contains('is-home')
    const scrolled = window.scrollY > offset
    const hovered = canHoverNavbar() && navbar.matches(':hover')
    const active = isHome ? (hovered || scrolled) : true

    content.classList.toggle('active-header', active)
    content.classList.toggle('has-scrolled', scrolled)

    if (links && isHome && window.innerWidth >= 768) {
      if (active) {
        links.classList.remove('sakura-fade-out-left', 'sakura-fade-out-right')
        links.classList.add('sakura-fade-in-left')
        links.style.visibility = 'visible'
        links.style.pointerEvents = 'auto'
      } else {
        links.classList.remove('sakura-fade-in-left', 'sakura-fade-in-right')
        links.classList.add('sakura-fade-out-left')
        links.style.visibility = 'hidden'
        links.style.pointerEvents = 'none'
      }
    } else if (links) {
      links.classList.remove(
        'sakura-fade-in-left', 'sakura-fade-out-left',
        'sakura-fade-in-right', 'sakura-fade-out-right',
      )
      links.style.visibility = 'visible'
      links.style.pointerEvents = 'auto'
    }
  }

  navbar.addEventListener('mouseenter', update)
  navbar.addEventListener('mouseleave', update)
  if (!navbar.dataset.homeNavReady) {
    navbar.dataset.homeNavReady = '1'
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update, { passive: true })
  }
  refreshHomeNavbar = update
  update()
}

export function initMobileNavbarCollapse() {
  initNavbarScrollCollapse({
    flagAttr: 'data-mobile-collapse',
    readyAttr: 'mobileCollapseReady',
    collapsedClass: 'is-mobile-collapsed',
    mediaQuery: MOBILE_NAVBAR_MQ,
    collapseOnHomeAttr: 'data-mobile-collapse-home',
    thresholdAttr: 'data-scroll-threshold',
    deltaAttr: 'data-scroll-delta',
    revealModeAttr: 'data-reveal-mode',
    fallbackThreshold: 48,
    fallbackDelta: 15,
    setRefresh: (fn) => { refreshMobileNavbarCollapse = fn },
  })
}

export function initDesktopNavbarCollapse() {
  initNavbarScrollCollapse({
    flagAttr: 'data-desktop-collapse',
    readyAttr: 'desktopCollapseReady',
    collapsedClass: 'is-desktop-collapsed',
    mediaQuery: DESKTOP_NAVBAR_MQ,
    collapseOnHomeAttr: 'data-desktop-collapse-home',
    thresholdAttr: 'data-desktop-scroll-threshold',
    deltaAttr: 'data-desktop-scroll-delta',
    revealModeAttr: 'data-desktop-reveal-mode',
    fallbackThreshold: 15,
    fallbackDelta: 15,
    setRefresh: (fn) => { refreshDesktopNavbarCollapse = fn },
  })
}

export function initNavbarLinkScroll() {
  const links = document.getElementById('navbar-links')
  if (!links || links.dataset.wheelReady === '1') return
  links.dataset.wheelReady = '1'

  links.addEventListener('wheel', (e) => {
    if (links.scrollWidth <= links.clientWidth) return
    e.preventDefault()
    links.scrollLeft += e.deltaY
  }, { passive: false })
}

function closeNavbarDropdown(dropdown) {
  dropdown.setAttribute('aria-expanded', 'false')
  const active = document.activeElement
  if (active instanceof HTMLElement && dropdown.contains(active)) {
    active.blur()
  }
}

export function initNavbarDropdown() {
  document.querySelectorAll('.sakura-dropdown[aria-haspopup="true"]').forEach((dropdown) => {
    if (dropdown.dataset.dropdownReady === '1') return
    dropdown.dataset.dropdownReady = '1'
    dropdown.addEventListener('mouseenter', () => { dropdown.setAttribute('aria-expanded', 'true') })
    dropdown.addEventListener('mouseleave', () => { closeNavbarDropdown(dropdown) })
    dropdown.querySelectorAll('.sakura-dropdown-menu a[href]').forEach((link) => {
      link.addEventListener('click', () => { closeNavbarDropdown(dropdown) })
    })
  })
}

export function initBrandRotate() {
  const el = document.querySelector('.sakura-hvr-rotate')
  if (!el || el.dataset.rotateReady === '1') return
  el.dataset.rotateReady = '1'

  el.addEventListener('mouseenter', () => {
    el.classList.remove('is-spinning')
    void el.offsetWidth
    el.classList.add('is-spinning')
  })
  el.addEventListener('animationend', () => {
    el.classList.remove('is-spinning')
  })
}
