const TWIKOO_META_PLACEHOLDERS = {
  nick: '昵称',
  mail: '邮箱',
  link: '网址 (选填)',
}
const TWIKOO_DELETE_ICON_MARK = 'M48 224l0 160c0 8.8'
let twikooFormObserver = null

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
    root.querySelectorAll('.tk-submit .tk-meta-input .el-input__inner').forEach((input) => {
      input.placeholder = TWIKOO_META_PLACEHOLDERS[input.name] ?? ''
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
  targets.forEach((target) => twikooFormObserver.observe(target, { childList: true, subtree: true }))
}
