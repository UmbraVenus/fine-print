import { App as AntApp, Button } from 'antd'
import { toPng } from 'html-to-image'
import { useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import type { AdContent } from '../lib/types'
import { AdView, NATURAL_WIDTH, isImageTemplate } from './AdView'

function fileName(name: string, version: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug || 'ad'}-v${version}.png`
}

/**
 * Download the approved ad as a PNG, ready to launch. It's drawn from the same data as everywhere else,
 * at full size and twice the pixel density, off screen, so the export never depends on the drawer's width.
 */
export function DownloadAd({ content, name, version }: { content: AdContent; name: string; version: number }) {
  const { message } = AntApp.useApp()
  const frame = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const width = isImageTemplate(content.template) ? NATURAL_WIDTH[content.template] : 520

  const download = async () => {
    if (!frame.current) return
    setBusy(true)
    try {
      const url = await toPng(frame.current, { pixelRatio: 2, cacheBust: true })
      const link = document.createElement('a')
      link.href = url
      link.download = fileName(name, version)
      link.click()
    } catch {
      message.error("Couldn't create the image. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button icon={<Icon name="download" size={16} />} onClick={download} loading={busy}>
        Download ad
      </Button>
      <div aria-hidden="true" inert style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none' }}>
        <div ref={frame} style={{ width, background: 'transparent' }}>
          <AdView content={content} />
        </div>
      </div>
    </>
  )
}
