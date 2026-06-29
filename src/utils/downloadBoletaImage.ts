export const BOLETA_WIDTH = 800
export const BOLETA_HEIGHT = 352

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function exportScale(custom?: number): number {
  if (custom) return custom
  return isMobileDevice() ? 2 : 3
}

/**
 * Neutralise CSS transforms on ancestors so html2canvas captures 800×352 at 1:1.
 */
function neutraliseAncestorTransforms(el: HTMLElement): () => void {
  const saved: { el: HTMLElement; transform: string; height: string; minHeight: string }[] = []
  let node = el.parentElement
  while (node && node !== document.documentElement) {
    const computed = getComputedStyle(node)
    if (node.style.transform || computed.transform !== 'none') {
      saved.push({
        el: node,
        transform: node.style.transform,
        height: node.style.height,
        minHeight: node.style.minHeight,
      })
      node.style.transform = 'none'
      node.style.height = 'auto'
      node.style.minHeight = 'auto'
    }
    node = node.parentElement
  }
  return () => {
    for (const s of saved) {
      s.el.style.transform = s.transform
      s.el.style.height = s.height
      s.el.style.minHeight = s.minHeight
    }
  }
}

function resolveTicketElement(options: {
  element?: HTMLElement | null
  elementId?: string
  selector?: string
}): HTMLElement | null {
  if (options.element) {
    return options.element.classList.contains('boleta-ticket')
      ? options.element
      : (options.element.querySelector('.boleta-ticket') as HTMLElement) ?? options.element
  }
  if (options.elementId) {
    const wrapper = document.getElementById(options.elementId)
    if (!wrapper) return null
    return (wrapper.querySelector('.boleta-ticket') as HTMLElement) ?? wrapper
  }
  if (options.selector) {
    const el = document.querySelector(options.selector) as HTMLElement | null
    if (!el) return null
    return el.classList.contains('boleta-ticket')
      ? el
      : (el.querySelector('.boleta-ticket') as HTMLElement) ?? el
  }
  return null
}

async function waitForImages(el: HTMLElement, timeoutMs = 10000): Promise<void> {
  const imgs = Array.from(el.querySelectorAll('img'))
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
          setTimeout(done, timeoutMs)
        })
    )
  )
}

async function triggerFileDownload(blob: Blob, fileName: string): Promise<boolean> {
  const file = new File([blob], fileName, { type: 'image/png' })

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName })
      return true
    } catch (err) {
      if ((err as Error).name === 'AbortError') return true
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return true
  } catch {
    window.open(url, '_blank')
    return true
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }
}

export async function captureBoletaTicket(
  ticket: HTMLElement,
  scale?: number
): Promise<HTMLCanvasElement | null> {
  const restore = neutraliseAncestorTransforms(ticket)
  const prevWidth = ticket.style.width
  const prevHeight = ticket.style.height
  const prevMinWidth = ticket.style.minWidth

  ticket.style.width = `${BOLETA_WIDTH}px`
  ticket.style.height = `${BOLETA_HEIGHT}px`
  ticket.style.minWidth = `${BOLETA_WIDTH}px`

  try {
    await waitForImages(ticket)
    const html2canvas = (await import('html2canvas-pro')).default
    return await html2canvas(ticket, {
      width: BOLETA_WIDTH,
      height: BOLETA_HEIGHT,
      scale: exportScale(scale),
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    })
  } catch (err) {
    console.error('Error capturando boleta:', err)
    return null
  } finally {
    ticket.style.width = prevWidth
    ticket.style.height = prevHeight
    ticket.style.minWidth = prevMinWidth
    restore()
  }
}

export async function downloadBoletaFromElement(
  ticket: HTMLElement,
  fileName: string,
  scale?: number
): Promise<boolean> {
  const canvas = await captureBoletaTicket(ticket, scale)
  if (!canvas) return false

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png')
  })
  if (!blob) return false

  const name = fileName.endsWith('.png') ? fileName : `${fileName}.png`
  return triggerFileDownload(blob, name)
}

export async function downloadBoletaImage(options: {
  elementId?: string
  element?: HTMLElement
  selector?: string
  fileName: string
  scale?: number
}): Promise<boolean> {
  const ticket = resolveTicketElement(options)
  if (!ticket) return false
  return downloadBoletaFromElement(ticket, options.fileName, options.scale)
}
