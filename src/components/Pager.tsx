import { Link } from 'react-router-dom'
import type { ListPosition } from '../lib/detail'
import { Icon } from './Icon'

/** Previous / "3 of 9" / Next through a list of ads, each opening at `href(id)`. */
export function Pager({ at, label, href }: { at: ListPosition; label: string; href: (id: number) => string }) {
  const step = (id: number | null, text: string, icon: 'chevronLeft' | 'chevronRight') => {
    const inner =
      icon === 'chevronLeft' ? (
        <>
          <Icon name={icon} size={16} />
          {text}
        </>
      ) : (
        <>
          {text}
          <Icon name={icon} size={16} />
        </>
      )
    return id ? (
      <Link className="fp-pager" to={href(id)}>
        {inner}
      </Link>
    ) : (
      <span className="fp-pager" aria-disabled="true">
        {inner}
      </span>
    )
  }
  return (
    <nav aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {step(at.previous, 'Previous', 'chevronLeft')}
      <span style={{ fontSize: 13, color: '#4A5468' }}>
        {at.position} of {at.total}
      </span>
      {step(at.next, 'Next', 'chevronRight')}
    </nav>
  )
}
