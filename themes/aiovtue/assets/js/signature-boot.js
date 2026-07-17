const SIGNATURE_SCRIPT_MARK = 'signature/signature.js'

function resolveSignatureScriptSrc() {
  const fromMeta = document.querySelector('meta[name="sakura-signature-script"]')?.content
  if (fromMeta) return fromMeta

  const fromScript = [...document.scripts].find((script) => script.src.includes(SIGNATURE_SCRIPT_MARK))?.src
  if (fromScript) return fromScript

  return new URL(`/${SIGNATURE_SCRIPT_MARK}`, window.location.origin).href
}

let signatureScriptPromise = null

function waitForSignatureWidget(timeoutMs = 4000) {
  return new Promise((resolve) => {
    if (window.SignatureWidget) {
      resolve()
      return
    }

    const started = Date.now()
    const timer = window.setInterval(() => {
      if (window.SignatureWidget || Date.now() - started >= timeoutMs) {
        window.clearInterval(timer)
        resolve()
      }
    }, 50)
  })
}

function loadSignatureScript() {
  if (window.SignatureWidget) return Promise.resolve()

  const src = resolveSignatureScriptSrc()
  const existing = [...document.scripts].find((script) => script.src === src)
  if (existing) return waitForSignatureWidget()

  if (!signatureScriptPromise) {
    signatureScriptPromise = new Promise((resolve) => {
      const el = document.createElement('script')
      el.src = src
      el.defer = true
      el.onload = () => resolve()
      el.onerror = () => resolve()
      document.body.appendChild(el)
    })
  }

  return signatureScriptPromise.then(() => waitForSignatureWidget())
}

export async function bootSignatureWidget() {
  if (!document.querySelector('.signature-widget')) return
  await loadSignatureScript()
  window.SignatureWidget?.boot()
}
