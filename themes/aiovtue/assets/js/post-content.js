
import { registerPageCleanup } from './page-cleanup.js'
import { cancelTypeWriter, typeWriter } from './typewriter.js'
import { appendAlbumViewerLightboxItems, initAlbumVideoThumbs } from './lightbox.js'
import { getNavbarLayoutOffset } from './navbar.js'

export function initAlbumPasswordGate() {
  const page = document.querySelector('.sakura-gallery-album-page.is-locked')
  if (!page) return

  const gate = document.getElementById('album-password-gate')
  const viewer = document.getElementById('album-viewer')
  const form = document.getElementById('album-password-form')
  const input = document.getElementById('album-password-input')
  const err = document.getElementById('album-password-error')
  const expected = (page.dataset.albumPassword || gate?.dataset.password || '').trim()

  if (!gate || !viewer || !form || !input || !expected) return

  const unlock = () => {
    page.classList.remove('is-locked')
    gate.classList.add('is-hidden')
    viewer.classList.remove('is-hidden')
    if (err) err.hidden = true
    appendAlbumViewerLightboxItems(viewer)
    initAlbumVideoThumbs(viewer)
    input.blur()
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    if (input.value.trim() === expected) {
      unlock()
      return
    }
    if (err) err.hidden = false
    input.select()
  })
}

const CODE_FOLD_LINE_THRESHOLD = 10

function countCodeLines(text) {
  const normalized = (text || '').replace(/\r\n/g, '\n').replace(/\n$/, '')
  if (!normalized) return 0
  return normalized.split('\n').length
}

function bindCodeBlock(block) {
  if (block.dataset.codeBlockReady) return
  block.dataset.codeBlockReady = '1'

  const copyBtn = block.querySelector('button.copy')
  const unfoldBtn = block.querySelector('button.code-block-unfold-btn')
  const codeEl = block.querySelector('pre code') || block.querySelector('code')

  if (copyBtn && codeEl) {
    copyBtn.addEventListener('click', async () => {
      const text = codeEl.textContent || ''
      try {
        await navigator.clipboard.writeText(text)
        copyBtn.classList.add('copied')
        window.setTimeout(() => copyBtn.classList.remove('copied'), 2000)
      } catch {
        /* clipboard unavailable */
      }
    })
  }

  if (!unfoldBtn) return

  unfoldBtn.addEventListener('click', () => {
    const folded = block.classList.contains('folded')
    if (folded) {
      block.classList.remove('folded', 'max-h-360px')
      unfoldBtn.classList.add('is-expanded')
    } else {
      block.classList.add('folded', 'max-h-360px')
      unfoldBtn.classList.remove('is-expanded')
    }
  })
}

function wrapLegacyCodeBlock(highlight) {
  if (highlight.closest('[class*="language-"]')) return null

  const pre = highlight.querySelector('pre')
  const code = pre?.querySelector('code')
  const langMatch = code?.className.match(/language-([A-Za-z0-9_+#.-]+)/)
  const lang = code?.getAttribute('data-lang') || langMatch?.[1] || 'text'
  const lineCount = countCodeLines(code?.textContent || '')
  const fold = lineCount > CODE_FOLD_LINE_THRESHOLD

  const wrapper = document.createElement('div')
  wrapper.className = `language-${lang}${fold ? ' max-h-360px code-foldable folded' : ''}`
  wrapper.dataset.lineCount = String(lineCount)

  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'
  copyBtn.title = 'Copy code'
  copyBtn.className = 'copy'
  copyBtn.setAttribute('aria-label', '复制代码')

  const langSpan = document.createElement('span')
  langSpan.className = 'lang'
  langSpan.textContent = lang

  const unfoldBtn = document.createElement('button')
  unfoldBtn.type = 'button'
  unfoldBtn.className = 'code-block-unfold-btn'
  unfoldBtn.setAttribute('aria-label', '展开代码')
  if (!fold) unfoldBtn.hidden = true

  const parent = highlight.parentNode
  if (!parent) return null
  parent.insertBefore(wrapper, highlight)
  wrapper.append(copyBtn, langSpan, highlight, unfoldBtn)
  return wrapper
}

export function initPostSponsor(root = document) {
  root.querySelectorAll('.sakura-sponsor').forEach((wrap) => {
    if (wrap.dataset.sponsorReady === '1') return
    wrap.dataset.sponsorReady = '1'
    const btn = wrap.querySelector('.sakura-sponsor__toggle')
    const panel = wrap.querySelector('.sakura-sponsor__panel')
    if (!btn || !panel) return

    btn.addEventListener('click', () => {
      const open = panel.classList.toggle('is-open')
      btn.setAttribute('aria-expanded', open ? 'true' : 'false')
    })
  })
}

export function initMarkdownCodeBlocks(root = document) {
  const container = root.querySelector('.markdown-body') || root
  if (!container) return

  container.querySelectorAll('.highlight').forEach((highlight) => {
    wrapLegacyCodeBlock(highlight)
  })

  container.querySelectorAll('div[class*="language-"]').forEach((block) => {
    bindCodeBlock(block)
  })
}

export function initPostImageRows() {
  document.querySelectorAll('.sakura-post-page .markdown-body.sakura-post-content').forEach((body) => {
    if (body.dataset.imageRowsReady === '1') return
    body.dataset.imageRowsReady = '1'

    const isImageOnlyElement = (el) => {
      if (el.tagName === 'IMG') return true
      if (el.tagName !== 'P') return false
      const children = [...el.childNodes]
      return children.some((node) => node.nodeType === 1 && node.tagName === 'IMG')
        && children.every((node) => {
          if (node.nodeType === 3) return node.textContent.trim() === ''
          if (node.nodeType === 1) return node.tagName === 'IMG' || node.tagName === 'BR'
          return false
        })
    }

    const getImagesFromElement = (el) => (
      el.tagName === 'IMG' ? [el] : [...el.querySelectorAll(':scope > img')]
    )

    const buildImageRows = (imgs) => {
      const fragment = document.createDocumentFragment()
      for (let i = 0; i < imgs.length; i += 2) {
        const row = document.createElement('div')
        row.className = 'post-image-row'
        const pair = imgs.slice(i, i + 2)
        if (pair.length === 1) row.classList.add('post-image-row--single')
        pair.forEach((img) => {
          const item = document.createElement('div')
          item.className = 'post-image-row__item'
          item.appendChild(img)
          row.appendChild(item)
        })
        fragment.appendChild(row)
      }
      return fragment
    }

    const findConsecutiveImgRuns = (parent) => {
      const runs = []
      let current = []
      for (const node of parent.childNodes) {
        if (node.nodeType === 1 && node.tagName === 'IMG') {
          current.push(node)
        } else if (
          current.length > 0
          && ((node.nodeType === 3 && node.textContent.trim() === '')
            || (node.nodeType === 1 && node.tagName === 'BR'))
        ) {
          continue
        } else {
          if (current.length >= 2) runs.push([...current])
          current = []
        }
      }
      if (current.length >= 2) runs.push(current)
      return runs
    }

    const hasMeaningfulContentBesides = (parent, excludeNodes) => (
      [...parent.childNodes].some((node) => {
        if (excludeNodes.includes(node)) return false
        if (node.nodeType === 3) return node.textContent.trim() !== ''
        if (node.nodeType === 1) return node.tagName !== 'BR'
        return true
      })
    )

    const wrapImgRun = (paragraph, imgs) => {
      const wrapper = document.createElement('div')
      wrapper.className = 'post-image-group'
      wrapper.appendChild(buildImageRows(imgs))
      if (hasMeaningfulContentBesides(paragraph, imgs)) {
        paragraph.insertAdjacentElement('afterend', wrapper)
      } else {
        paragraph.replaceWith(wrapper)
      }
    }

    body.querySelectorAll('p').forEach((paragraph) => {
      if (paragraph.closest('.post-image-group')) return
      findConsecutiveImgRuns(paragraph)
        .reverse()
        .forEach((imgs) => wrapImgRun(paragraph, imgs))
    })

    const wrapImages = (imgs, insertBefore, removeNodes = []) => {
      if (imgs.length < 2) return
      const wrapper = document.createElement('div')
      wrapper.className = 'post-image-group'
      wrapper.appendChild(buildImageRows(imgs))
      insertBefore.parentNode.insertBefore(wrapper, insertBefore)
      removeNodes.forEach((node) => node.remove())
    }

    const flushBatch = (batch) => {
      if (!batch.length) return
      const imgs = batch.flatMap(getImagesFromElement)
      if (imgs.length < 2) return
      wrapImages(imgs, batch[0], batch)
    }

    const batchContainers = [body, ...body.querySelectorAll('li, blockquote')]
    batchContainers.forEach((container) => {
      let batch = []
      ;[...container.children].forEach((node) => {
        if (node.nodeType === 1 && isImageOnlyElement(node) && getImagesFromElement(node).length === 1) {
          batch.push(node)
          return
        }
        flushBatch(batch)
        batch = []
      })
      flushBatch(batch)
    })
  })
}

export function initPostToc() {
  const aside = document.querySelector('.sakura-post-toc')
  const inner = aside?.querySelector('.sakura-toc__inner')
  const marker = aside?.querySelector('.outline-marker')
  const links = inner ? [...inner.querySelectorAll('#TableOfContents a[href^="#"]')] : []
  if (!aside || !inner || !links.length) return

  const navHeight = () => getNavbarLayoutOffset()

  const headings = links.map((link) => {
    const id = decodeURIComponent(link.getAttribute('href').slice(1))
    return document.getElementById(id)
  }).filter(Boolean)

  const setActive = (activeLink) => {
    links.forEach((link) => link.classList.toggle('active', link === activeLink))
    if (!marker || !activeLink) return
    const innerRect = inner.getBoundingClientRect()
    const linkRect = activeLink.getBoundingClientRect()
    marker.classList.add('is-visible')
    marker.style.top = `${linkRect.top - innerRect.top + inner.scrollTop}px`
    marker.style.height = `${Math.max(linkRect.height, 18)}px`
  }

  const onScroll = () => {
    const offset = window.scrollY + navHeight() + 24
    let current = links[0]
    for (let i = 0; i < headings.length; i++) {
      if (headings[i].offsetTop <= offset) current = links[i]
      else break
    }
    setActive(current)
  }

  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault()
      const id = decodeURIComponent(link.getAttribute('href').slice(1))
      const target = document.getElementById(id)
      if (!target) return
      window.scrollTo({ top: target.offsetTop - navHeight() - 12, behavior: 'smooth' })
      history.replaceState(
        { ...(history.state || {}), pjax: true, scrollY: window.scrollY },
        '',
        `#${id}`,
      )
    })
  })

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  onScroll()

  registerPageCleanup(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
  })
}

export function initPostAiSummary() {
  const section = document.querySelector('.sakura-post-ai-summary')
  const el = section?.querySelector('.sakura-post-ai-summary__text')
  if (!el) return

  const source = section.querySelector('.sakura-post-ai-summary__source')
  const text = (source?.content?.textContent || el.dataset.text || '').trim()
  if (!text) return

  registerPageCleanup(cancelTypeWriter)

  const speed = Number(el.dataset.speed || 20)
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (reducedMotion || el.dataset.typewriter === 'false') {
    el.textContent = text
    return
  }

  void typeWriter(el, text, speed)
}
