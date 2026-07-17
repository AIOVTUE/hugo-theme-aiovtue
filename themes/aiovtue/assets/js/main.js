
import { cleanupPageComments, initPageComments, initTwikooVisitors } from './comments.js'
import { runPageCleanups } from './page-cleanup.js'
import { bootShell, bindCopyYmlBtn } from './shell.js'
import { updateSidebarNavActive } from './sidebar.js'
import { refreshHomeNavbar, refreshMobileNavbarCollapse, refreshDesktopNavbarCollapse } from './navbar.js'
import { bindHeroScrollDown, initHeroMedia, initHeroHitokoto, cleanupHero } from './hero.js'
import { initLazyImages } from './lazy-images.js'
import {
  initMarkdownCodeBlocks,
  initPostSponsor,
  initPostImageRows,
  initPostToc,
  initPostAiSummary,
  initAlbumPasswordGate,
} from './post-content.js'
import { initNoticeBoard } from './notice-board.js'
import { initSiteRuntime } from './site-runtime.js'
import {
  initHomeLayoutRandom,
  initHomePaginationScroll,
  initHomePostListScrollAnimation,
  initHomeTimelineLoadMore,
  initHomeCardsLoadMore,
  bootstrapHomeCardsLoadMore,
  scheduleHomeCardsLoadMoreSync,
  initHomeListFeatured,
  initHomeListRandomSidebar,
  initHomeListArchiveHeatmap,
  refreshMobileCardsListPage,
  cleanupHomeObservers,
} from './home.js'
import { customizeTwikooCommentForm, observeTwikooCommentForm, cleanupTwikooFormObserver } from './twikoo-form.js'
import { initLightbox, initAlbumVideoThumbs, cleanupLightbox } from './lightbox.js'
import { initCharts, cleanupCharts } from './charts.js'
import { initFooterLinks, initLinksPreviewShuffle, initLinksRssSpotlight, cleanupLinksRssSpotlight } from './links.js'
import { initMomentsModule, initExcalidrawModule, initGalleryPostModule } from './lazy-modules.js'
import { isPjaxContentMounting } from './page-nav.js'
import { initSearchPage } from './search-page.js'
import { initEnvelope, initEnvelopeDanmaku } from './envelope.js'
import { initWeeklyLoadMore, bootstrapWeeklyLoadMore } from './weekly.js'
import { cancelTypeWriter } from './typewriter.js'
import { bootSignatureWidget } from './signature-boot.js'

function unmountPage() {
  runPageCleanups()
  cleanupHero()
  cleanupCharts()
  cleanupTwikooFormObserver()
  cleanupPageComments()
  cleanupLinksRssSpotlight()
  cleanupHomeObservers()
  cleanupLightbox()
  cancelTypeWriter()
  refreshHomeNavbar?.()
  refreshMobileNavbarCollapse?.()
  refreshDesktopNavbarCollapse?.()
}

function mountPage() {
  updateSidebarNavActive()
  initHeroMedia()
  initHeroHitokoto()
  initLazyImages()
  initMarkdownCodeBlocks()
  initPostSponsor()
  bindHeroScrollDown()
  initNoticeBoard()
  initSiteRuntime()
  initHomeLayoutRandom()
  initHomePaginationScroll()
  initHomePostListScrollAnimation()
  initHomeTimelineLoadMore()
  initHomeListFeatured()
  initHomeListRandomSidebar()
  initHomeListArchiveHeatmap()
  refreshMobileCardsListPage()
  initHomeCardsLoadMore()
  scheduleHomeCardsLoadMoreSync()
  initWeeklyLoadMore()
  initPostToc()
  initPageComments({
    onTwikooReady: () => {
      customizeTwikooCommentForm()
      observeTwikooCommentForm()
    },
  })
  initTwikooVisitors()
  initAlbumPasswordGate()
  initPostImageRows()
  initPostAiSummary()
  initLightbox()
  initAlbumVideoThumbs()
  void initCharts().catch((err) => console.warn('[charts]', err))
  initFooterLinks()
  initLinksPreviewShuffle()
  initLinksRssSpotlight()
  if (!isPjaxContentMounting()) {
    void initMomentsModule().catch((err) => console.warn('[moments]', err))
    void initExcalidrawModule().catch((err) => console.warn('[excalidraw]', err))
    void initGalleryPostModule().catch((err) => console.warn('[gallery-post]', err))
  }
  void initSearchPage().catch((err) => console.warn('[search]', err))
  initEnvelope()
  initEnvelopeDanmaku()
  void bootSignatureWidget().catch((err) => console.warn('[signature]', err))
  bindCopyYmlBtn()
  refreshHomeNavbar?.()
  refreshMobileNavbarCollapse?.()
  refreshDesktopNavbarCollapse?.()
}

document.addEventListener('DOMContentLoaded', () => {
  bootShell({ mountPage, unmountPage })
  mountPage()
})

window.addEventListener('load', () => {
  bootstrapHomeCardsLoadMore()
  bootstrapWeeklyLoadMore()
}, { once: true })
