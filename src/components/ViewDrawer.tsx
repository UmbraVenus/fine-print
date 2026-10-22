import { Drawer, Skeleton } from 'antd'
import { useSearchParams } from 'react-router-dom'
import { AdView } from '../ads/AdView'
import { DownloadAd } from '../ads/DownloadAd'
import { useWorkspace } from '../app/workspace'
import { useMarkSeen } from '../lib/seen'
import { useApi } from '../lib/useApi'
import { dayLabel, dayPhrase } from '../lib/dates'
import { activityText, sentText, type AdDetail } from '../lib/detail'
import { PRODUCT_LABEL } from '../lib/labels'
import { Icon } from './Icon'
import { StatusTag } from './StatusTag'

const SECTION_LABEL = { fontSize: 12, lineHeight: '16px', fontWeight: 700, letterSpacing: '0.04em', color: '#4A5468' } as const

function headerDate(detail: AdDetail, today: string): string {
  const { ad } = detail
  if (ad.closed_at) return dayLabel(ad.closed_at, today)
  if (ad.status === 'pending' && ad.due_date) return `Due ${dayPhrase(ad.due_date, today)}`
  return dayLabel(ad.updated_at, today)
}

/** Read-only: the ad, the changes sent to the submitter, and its activity. Opened from any ad name. */
export function ViewDrawer() {
  const [params, setParams] = useSearchParams()
  const { role, today, version } = useWorkspace()
  const id = Number(params.get('view'))
  const open = Number.isFinite(id) && id > 0
  const { data: detail, error } = useApi<AdDetail>(open ? `/api/ads/${id}` : null, version)
  useMarkSeen(role, detail && detail.ad.id === id ? id : null, detail?.ad.updated_at)
  const missing = Boolean(error)

  const close = () =>
    setParams((p) => {
      p.delete('view')
      return p
    })

  const shown = detail ?? null
  const sent = shown ? shown.current.findings.filter((f) => f.sent_to_submitter) : []

  return (
    <Drawer
      open={open}
      onClose={close}
      size={480}
      closable={false}
      destroyOnHidden
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 800 }}>{shown?.ad.name ?? (missing ? 'Ad not found' : '')}</h2>
          <button type="button" aria-label="Close" onClick={close} className="fp-icon-button">
            <Icon name="close" size={18} />
          </button>
        </div>
      }
      styles={{ header: { padding: '22px 28px', borderBottom: '1px solid #E3E6EC' }, body: { padding: '24px 28px' } }}
      aria-label={shown?.ad.name}
    >
      {!shown && !missing && <Skeleton active />}
      {missing && <p style={{ margin: 0 }}>This ad doesn't exist anymore. It may have been reset.</p>}
      {shown && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            <StatusTag status={shown.ad.status} />
            <span style={{ fontSize: 14, color: '#4A5468' }}>
              {[headerDate(shown, today), shown.ad.format, PRODUCT_LABEL[shown.ad.product]].join(' · ')}
            </span>
          </div>

          <AdView content={shown.current} />

          {(shown.ad.status === 'approved' || shown.ad.status === 'approved_with_changes') && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
              <DownloadAd content={shown.current} name={shown.ad.name} version={shown.ad.current_version} />
              {shown.ad.status === 'approved_with_changes' && (
                <span style={{ fontSize: 13, lineHeight: '18px', color: '#4A5468' }}>Make the change below before it goes live.</span>
              )}
            </div>
          )}

          {sent.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={SECTION_LABEL}>BEFORE IT GOES LIVE</span>
              {sent.map((finding) => (
                <div
                  key={finding.id}
                  style={{
                    border: '1px solid #E3E6EC',
                    borderLeft: '3px solid #15213B',
                    borderRadius: 10,
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 700, color: '#4A5468' }}>
                    {role === 'marketer' ? 'From your reviewer' : 'Sent to the submitter'}
                  </span>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 500 }}>{sentText(finding)}</p>
                  {finding.origin === 'auto' && finding.suggested_fix && (
                    <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', color: '#4A5468' }}>
                      {finding.fix_label}: {finding.suggested_fix}
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}

          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={SECTION_LABEL}>ACTIVITY</span>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: '20px' }}>
              {shown.events.map((event) => (
                <li key={event.id} style={{ display: 'flex', gap: 12 }}>
                  <span style={{ flex: '0 0 72px', color: '#4A5468' }}>{dayLabel(event.at, today)}</span>
                  <span>{activityText(event, role)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Drawer>
  )
}
