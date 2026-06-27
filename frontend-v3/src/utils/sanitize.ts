const ALLOWED_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'i',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'u',
  'ul',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target']),
  img: new Set(['src', 'alt', 'title']),
}

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) return true

  try {
    const url = new URL(trimmed, window.location.origin)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
  } catch {
    return false
  }
}

function sanitizeNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent || '')
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null
  }

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  if (!ALLOWED_TAGS.has(tag)) {
    const fragment = document.createDocumentFragment()
    el.childNodes.forEach(child => {
      const safeChild = sanitizeNode(child)
      if (safeChild) fragment.appendChild(safeChild)
    })
    return fragment
  }

  const safeEl = document.createElement(tag)
  const allowedAttrs = ALLOWED_ATTRS[tag] || new Set<string>()
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase()
    const value = attr.value
    if (!allowedAttrs.has(name)) continue
    if ((name === 'href' || name === 'src') && !isSafeUrl(value)) continue
    safeEl.setAttribute(name, value)
  }

  if (tag === 'a') {
    safeEl.setAttribute('rel', 'noopener noreferrer')
    if (safeEl.getAttribute('target') === '_blank') {
      safeEl.setAttribute('target', '_blank')
    }
  }

  el.childNodes.forEach(child => {
    const safeChild = sanitizeNode(child)
    if (safeChild) safeEl.appendChild(safeChild)
  })
  return safeEl
}

export function sanitizeHtml(html: string): string {
  if (!html) return ''
  const template = document.createElement('template')
  template.innerHTML = html

  const fragment = document.createDocumentFragment()
  template.content.childNodes.forEach(child => {
    const safeChild = sanitizeNode(child)
    if (safeChild) fragment.appendChild(safeChild)
  })

  const wrapper = document.createElement('div')
  wrapper.appendChild(fragment)
  return wrapper.innerHTML
}
