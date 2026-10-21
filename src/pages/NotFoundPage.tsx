import { Link } from 'react-router-dom'
import { useWorkspace } from '../app/workspace'
import { ROLE_LABEL } from '../lib/labels'

export function NotFoundPage() {
  const { role } = useWorkspace()
  return (
    <>
      <h1 className="fp-page-title">Page not found</h1>
      <p style={{ margin: 0, fontSize: 15 }}>
        This page doesn't exist. <Link to={ROLE_LABEL[role].home}>Go to {role === 'reviewer' ? 'the queue' : 'My ads'}</Link>
      </p>
    </>
  )
}
