import { App as AntApp, Dropdown, Popconfirm, Tooltip } from 'antd'
import { useState, type CSSProperties } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from '../components/Icon'
import { Logo } from '../components/Logo'
import { api } from '../lib/api'
import { ROLE_LABEL } from '../lib/labels'
import type { Role } from '../lib/types'
import { useWorkspace } from './workspace'

const COMING_NEXT = ['Turn compliance documents into rules', 'Upload your own ads', 'Search past decisions']

interface NavItem {
  to: string
  label: string
  icon: IconName
  badge?: number | null
}

function navItems(role: Role, pending: number | null): NavItem[] {
  if (role === 'marketer') {
    return [
      { to: '/my-ads', label: 'My ads', icon: 'image' },
      { to: '/rules', label: 'Rules', icon: 'book' },
    ]
  }
  return [
    { to: '/queue', label: 'Queue', icon: 'inbox', badge: pending },
    { to: '/history', label: 'History', icon: 'history' },
    { to: '/rules', label: 'Rules', icon: 'book' },
  ]
}

const outlineButton: CSSProperties = {
  flexShrink: 0,
  border: '1px solid #3A4A6E',
  borderRadius: 8,
  background: 'transparent',
  color: '#FFFFFF',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  cursor: 'pointer',
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { role, setRole, pending, refresh } = useWorkspace()
  const navigate = useNavigate()
  const { message } = AntApp.useApp()
  const [comingOpen, setComingOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const items = navItems(role, pending)

  const switchRole = (next: Role) => {
    setRole(next)
    navigate(ROLE_LABEL[next].home)
  }

  const reset = async () => {
    setResetting(true)
    try {
      await api.post('/api/reset')
      message.success('Sample data reset')
      refresh()
      navigate(ROLE_LABEL[role].home)
    } catch {
      message.error("Couldn't reset the sample data. Try again.")
    } finally {
      setResetting(false)
    }
  }

  const resetButton = (
    <Popconfirm
      title="Reset sample data?"
      description="Every ad, rule and decision goes back to the starting sample."
      okText="Reset"
      cancelText="Cancel"
      placement="topLeft"
      onConfirm={reset}
      okButtonProps={{ loading: resetting }}
    >
      <Tooltip title="Reset sample data" placement="right">
        <button type="button" aria-label="Reset sample data" className="fp-sidebar-icon" style={{ ...outlineButton, width: 32, height: 32 }}>
          <Icon name="reset" size={16} />
        </button>
      </Tooltip>
    </Popconfirm>
  )

  return (
    <aside className="fp-sidebar" data-collapsed={collapsed} aria-label="Sidebar">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexDirection: collapsed ? 'column' : 'row' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Logo size={22} variant={collapsed ? 'mark' : 'wordmark'} />
          {!collapsed && <span style={{ fontSize: 12, color: '#AEB8CC' }}>ClearPath Financial</span>}
        </div>
        <Tooltip title={collapsed ? 'Expand menu' : undefined} placement="right">
          <button
            type="button"
            aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
            aria-expanded={!collapsed}
            onClick={onToggle}
            className="fp-sidebar-icon"
            style={{ ...outlineButton, width: 36, height: 36 }}
          >
            <Icon name="sidebar" size={18} />
          </button>
        </Tooltip>
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span id="viewas" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#B4F1DA' }}>
            VIEWING AS
          </span>
          <Dropdown
            trigger={['click']}
            menu={{
              selectable: true,
              selectedKeys: [role],
              onClick: ({ key }) => switchRole(key as Role),
              items: (['reviewer', 'marketer'] as Role[]).map((r) => ({
                key: r,
                label: (
                  <span style={{ display: 'flex', flexDirection: 'column', padding: '2px 0' }}>
                    <span style={{ fontWeight: 700 }}>{ROLE_LABEL[r].name}</span>
                    <span style={{ fontSize: 12, color: '#4A5468' }}>{ROLE_LABEL[r].team}</span>
                  </span>
                ),
              })),
            }}
          >
            <button type="button" aria-describedby="viewas" className="fp-role-button">
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span id="role-name" style={{ fontSize: 15, fontWeight: 700 }}>
                  {ROLE_LABEL[role].name}
                </span>
                <span id="role-team" style={{ fontSize: 12, color: '#AEB8CC' }}>
                  {ROLE_LABEL[role].team}
                </span>
              </span>
              <Icon name="chevronDown" size={18} strokeWidth={2.2} />
            </button>
          </Dropdown>
        </div>
      )}

      <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item) => {
          const link = (
            <NavLink key={item.to} to={item.to} className="fp-nav-link" aria-label={collapsed ? item.label : undefined}>
              <Icon name={item.icon} size={18} />
              {!collapsed && item.label}
              {item.badge != null && (
                <span className="fp-nav-badge" aria-label={`${item.badge} waiting`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          )
          return collapsed ? (
            <Tooltip key={item.to} title={item.label} placement="right">
              {link}
            </Tooltip>
          ) : (
            link
          )
        })}
      </nav>

      <div style={{ flexGrow: 1 }} />

      {!collapsed && (
        <div className="fp-coming-next" data-open={comingOpen}>
          <button type="button" aria-expanded={comingOpen} aria-controls="coming-next-list" onClick={() => setComingOpen((o) => !o)}>
            <Icon name="arrowRight" size={16} strokeWidth={2.2} color="#B4F1DA" />
            Coming next
            <span style={{ flexGrow: 1 }} />
            <Icon name={comingOpen ? 'chevronUp' : 'chevronDown'} size={16} />
          </button>
          {comingOpen && (
            <ul id="coming-next-list">
              {COMING_NEXT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div
        style={{
          borderTop: '1px solid #2C3A5C',
          paddingTop: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
        }}
      >
        {!collapsed && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#AEB8CC' }}>WORKSPACE</span>}
        {resetButton}
      </div>
    </aside>
  )
}
