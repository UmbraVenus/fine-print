import { LoadingOutlined } from '@ant-design/icons'

/** A page or panel still loading: the teal spinner and one line saying what's on its way. */
export function Loading({ text }: { text: string }) {
  return (
    <div role="status" className="fp-loading">
      <LoadingOutlined aria-hidden="true" style={{ fontSize: 20, color: '#0F766E' }} />
      <span>{text}</span>
    </div>
  )
}
