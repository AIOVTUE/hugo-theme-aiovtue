const TWIKOO_META_PLACEHOLDERS = {
  nick: '昵称',
  mail: '邮箱',
  link: '网站',
}
const TWIKOO_META_FIELD_ORDER = ['nick', 'mail', 'link']
const TWIKOO_DELETE_ICON_MARK = 'M48 224l0 160c0 8.8'
let twikooFormObserver = null

function getTwikooMetaField(input, index) {
  const name = String(input.name || '').toLowerCase()
  if (TWIKOO_META_PLACEHOLDERS[name]) return name

  const prepend = input.closest('.el-input')?.querySelector('.el-input-group__prepend')?.textContent || ''
  if (/昵称|暱稱|nick/i.test(prepend)) return 'nick'
  if (/邮箱|郵箱|信箱|mail|email/i.test(prepend)) return 'mail'
  if (/网站|網站|网址|網址|site|url|link/i.test(prepend)) return 'link'

  if (input.type === 'email') return 'mail'
  if (input.type === 'url') return 'link'
  return TWIKOO_META_FIELD_ORDER[index]
}

function hideTwikooDeleteButtons(root) {
  root.querySelectorAll('.tk-comment .tk-action > .tk-action-link').forEach((link) => {
    const icon = link.querySelector('.tk-action-icon')
    if (icon?.innerHTML.includes(TWIKOO_DELETE_ICON_MARK)) {
      link.style.setProperty('display', 'none', 'important')
    }
  })
}

export function customizeTwikooCommentForm() {
  document.querySelectorAll('.sakura-comment .twikoo, #tcomment').forEach((root) => {
    root.querySelectorAll('.tk-submit .tk-meta-input').forEach((metaInput) => {
      metaInput.querySelectorAll('.el-input__inner').forEach((input, index) => {
        const field = getTwikooMetaField(input, index)
        const placeholder = TWIKOO_META_PLACEHOLDERS[field]
        if (placeholder && input.placeholder !== placeholder) input.placeholder = placeholder
      })
    })

    hideTwikooDeleteButtons(root)
  })
}

export function cleanupTwikooFormObserver() {
  if (twikooFormObserver) {
    twikooFormObserver.disconnect()
    twikooFormObserver = null
  }
}

export function observeTwikooCommentForm() {
  if (twikooFormObserver) return

  const targets = document.querySelectorAll('.sakura-comment, .comment, #tcomment')
  if (!targets.length) return

  twikooFormObserver = new MutationObserver(() => customizeTwikooCommentForm())
  targets.forEach((target) => twikooFormObserver.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['placeholder'],
  }))
}
