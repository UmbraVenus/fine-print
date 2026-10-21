import { App as AntApp, Button, Checkbox, Drawer, Input, Select, Skeleton } from 'antd'
import { useState, type CSSProperties } from 'react'
import { useWorkspace } from '../app/workspace'
import { FilledIcon, Icon } from '../components/Icon'
import { Tag } from '../components/StatusTag'
import { api, ApiError } from '../lib/api'
import type { Rule } from '../lib/detail'
import { useApi } from '../lib/useApi'

const SECTIONS: Array<{ category: Rule['category']; sub: string }> = [
  { category: 'Claims', sub: 'What the words promise' },
  { category: 'Required elements', sub: 'Things that must be on the ad' },
  { category: 'Presentation', sub: 'How the ad looks' },
]

const APPLY_OPTIONS = [
  { value: 'personal_loan', label: 'Personal loan', plural: 'personal loans' },
  { value: 'credit_card', label: 'Credit card', plural: 'credit cards' },
  { value: 'mortgage', label: 'Mortgage', plural: 'mortgage' },
  { value: 'affiliate', label: 'Affiliate content', plural: 'affiliate content' },
]

/** "personal loans and credit cards", "all products", "affiliate content" */
export function appliesText(applies: string[]): string {
  const products = ['personal_loan', 'credit_card', 'mortgage']
  if (products.every((p) => applies.includes(p))) {
    return applies.includes('affiliate') ? 'all products and affiliate content' : 'all products'
  }
  const words = APPLY_OPTIONS.filter((o) => applies.includes(o.value)).map((o) => o.plural)
  if (words.length <= 1) return words[0] ?? 'nothing yet'
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

interface ExampleLine {
  size: 'main' | 'big' | 'small' | 'tiny'
  text: string
}

function exampleLines(value: string): ExampleLine[] {
  if (value.startsWith('[')) {
    try {
      return JSON.parse(value) as ExampleLine[]
    } catch {
      // A custom rule's text that happens to start with a bracket.
    }
  }
  return [{ size: 'main', text: value }]
}

const LINE_STYLE: Record<ExampleLine['size'], CSSProperties> = {
  main: { fontSize: 15, lineHeight: '21px', fontWeight: 700 },
  big: { fontSize: 20, lineHeight: '26px', fontWeight: 800 },
  small: { fontSize: 11, lineHeight: '15px', fontWeight: 600, color: '#374151' },
  tiny: { fontSize: 7, lineHeight: '9px', color: '#4A5468' },
}

function ExampleCard({ kind, value }: { kind: 'dont' | 'do'; value: string }) {
  const lines = exampleLines(value)
  const tall = lines.some((l) => l.size === 'big')
  return (
    <div className="fp-example" style={{ minHeight: tall ? 120 : undefined }}>
      <span
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '1px 7px',
          borderRadius: 4,
          fontSize: 12,
          lineHeight: '18px',
          fontWeight: 600,
          background: kind === 'dont' ? '#FEF3F2' : '#ECFDF3',
          color: kind === 'dont' ? '#B42318' : '#067647',
        }}
      >
        <FilledIcon name={kind === 'dont' ? 'critical' : 'good'} size={12} strokeWidth={2.4} />
        {kind === 'dont' ? 'Don’t' : 'Do'}
      </span>
      {lines.map((line, i) => (
        <span key={i} style={{ ...LINE_STYLE[line.size], ...(line.size === 'tiny' ? { marginTop: 'auto' } : {}), ...(line.size === 'small' && tall ? { fontSize: 12, fontWeight: 500 } : {}) }}>
          {line.text}
        </span>
      ))}
    </div>
  )
}

function RuleRow({ rule }: { rule: Rule }) {
  return (
    <div className="fp-rule-row" data-rule={rule.id}>
      <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, lineHeight: '22px', fontWeight: 600 }}>{rule.name}</h3>
          {rule.is_custom && (
            <Tag tone="neutral" icon={<Icon name="person" size={12} strokeWidth={2.2} />}>
              Added by reviewer
            </Tag>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 14, lineHeight: '22px', color: '#374151' }}>{rule.description}</p>
        <p style={{ margin: 0, fontSize: 12, lineHeight: '16px', color: '#4A5468' }}>
          Applies to {appliesText(rule.applies_to)} · Flagged as {rule.severity === 'critical' ? 'Critical' : 'Caution'}
        </p>
      </div>
      <div style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <ExampleCard kind="dont" value={rule.dont_example} />
        <ExampleCard kind="do" value={rule.do_example} />
      </div>
    </div>
  )
}

interface Draft {
  name: string
  category: Rule['category']
  description: string
  severity: 'critical' | 'caution'
  applies_to: string[]
  dont_example: string
  do_example: string
}

const EMPTY: Draft = {
  name: '',
  category: 'Claims',
  description: '',
  severity: 'critical',
  applies_to: [],
  dont_example: '',
  do_example: '',
}

function Field({ label, children, id }: { label: string; children: React.ReactNode; id?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label htmlFor={id} id={id ? `${id}-label` : undefined} style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600, color: '#4A5468' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

function AddRuleDrawer({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (rule: Rule) => void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const complete = draft.name.trim() && draft.description.trim() && draft.applies_to.length && draft.dont_example.trim() && draft.do_example.trim()

  const close = () => {
    setError(null)
    onClose()
  }

  const save = async () => {
    if (!complete) {
      setError('Fill in every field and pick what it applies to.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const rule = await api.post<Rule>('/api/rules', draft)
      setDraft(EMPTY)
      onAdded(rule)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't add the rule. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      size={520}
      closable={false}
      destroyOnHidden
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, lineHeight: '28px', fontWeight: 800 }}>Add a rule</h2>
          <button type="button" aria-label="Close" onClick={close} className="fp-icon-button">
            <Icon name="close" size={18} />
          </button>
        </div>
      }
      styles={{
        header: { padding: '22px 28px', borderBottom: '1px solid #E3E6EC' },
        body: { padding: '24px 28px' },
        footer: { padding: '18px 28px', borderTop: '1px solid #E3E6EC' },
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={close} className="fp-footer-button">
            Cancel
          </Button>
          <Button type="primary" onClick={save} loading={saving} className="fp-footer-button" style={{ padding: '0 22px' }}>
            Add rule
          </Button>
        </div>
      }
    >
      <div className="fp-rule-form" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Field label="Rule name" id="rule-name">
          <Input id="rule-name" value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Balance transfer fees" />
        </Field>
        <Field label="Category" id="rule-category">
          <Select
            id="rule-category"
            aria-labelledby="rule-category-label"
            value={draft.category}
            onChange={(v) => set('category', v)}
            options={SECTIONS.map((s) => ({ value: s.category, label: s.category }))}
          />
        </Field>
        <Field label="What it checks" id="rule-description">
          <Input.TextArea
            id="rule-description"
            rows={3}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="A balance transfer offer must show the transfer fee next to the intro APR."
          />
        </Field>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span id="flag-as" style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600, color: '#4A5468' }}>
            Flag as
          </span>
          <div role="radiogroup" aria-labelledby="flag-as" style={{ display: 'flex', gap: 8 }}>
            {(['critical', 'caution'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={draft.severity === value}
                className="fp-choice"
                onClick={() => set('severity', value)}
              >
                {value === 'critical' ? 'Critical' : 'Caution'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span id="applies-to" style={{ fontSize: 13, lineHeight: '18px', fontWeight: 600, color: '#4A5468' }}>
            Applies to
          </span>
          <div role="group" aria-labelledby="applies-to" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {APPLY_OPTIONS.map((option) => (
              <Checkbox
                key={option.value}
                className="fp-check-chip"
                checked={draft.applies_to.includes(option.value)}
                onChange={(e) =>
                  set(
                    'applies_to',
                    e.target.checked ? [...draft.applies_to, option.value] : draft.applies_to.filter((v) => v !== option.value),
                  )
                }
              >
                {option.label}
              </Checkbox>
            ))}
          </div>
        </div>
        <Field label="Don’t example" id="rule-dont">
          <Input id="rule-dont" value={draft.dont_example} onChange={(e) => set('dont_example', e.target.value)} placeholder="0% intro APR for 18 months" />
        </Field>
        <Field label="Do example" id="rule-do">
          <Input id="rule-do" value={draft.do_example} onChange={(e) => set('do_example', e.target.value)} placeholder="0% intro APR for 18 months. 3% transfer fee." />
        </Field>
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: 13, color: '#B42318' }}>
            {error}
          </p>
        )}
        <p style={{ margin: 0, fontSize: 13, lineHeight: '18px', color: '#4A5468' }}>
          Every live check uses it from now on: Re-check and new submissions. Results already on ads stay as they are.
        </p>
      </div>
    </Drawer>
  )
}

export function RulesPage() {
  const { role, version } = useWorkspace()
  const { message } = AntApp.useApp()
  const [reload, setReload] = useState(0)
  const [adding, setAdding] = useState(false)
  const { latest } = useApi<{ rules: Rule[] }>('/api/rules', version * 1000 + reload)
  const rules = latest?.rules

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 640 }}>
          <h1 className="fp-page-title">Rules</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: '22px', color: '#4A5468' }}>
            Every ad is checked against these {rules?.length ?? ''} rules. Each suggestion names the rule it comes from.
          </p>
        </div>
        {role === 'reviewer' && (
          <Button type="primary" icon={<Icon name="plus" size={16} strokeWidth={2.4} />} onClick={() => setAdding(true)} style={{ minHeight: 42, padding: '0 18px' }}>
            Add a rule
          </Button>
        )}
      </div>

      {!rules && <Skeleton active paragraph={{ rows: 12 }} />}
      {rules &&
        SECTIONS.map(({ category, sub }) => {
          const inSection = rules.filter((r) => r.category === category)
          if (!inSection.length) return null
          return (
            <section key={category} className="fp-rule-section" aria-labelledby={`section-${category}`}>
              <div className="fp-rule-section-header">
                <h2 id={`section-${category}`} style={{ margin: 0, fontSize: 19, lineHeight: '26px', fontWeight: 800, color: '#115E59' }}>
                  {category}
                </h2>
                <span style={{ fontSize: 12, lineHeight: '16px', fontWeight: 700, color: '#FFFFFF', background: '#0F766E', borderRadius: 9999, padding: '2px 9px' }}>
                  {inSection.length}
                </span>
                <span style={{ fontSize: 14, lineHeight: '20px', color: '#115E59' }}>{sub}</span>
              </div>
              {inSection.map((rule) => (
                <RuleRow key={rule.id} rule={rule} />
              ))}
            </section>
          )
        })}
      <p style={{ margin: 0, fontSize: 12, lineHeight: '16px', color: '#4A5468' }}>
        Rule wording is simplified for this sample workspace and is not legal advice.
      </p>

      <AddRuleDrawer
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(rule) => {
          setAdding(false)
          setReload((r) => r + 1)
          message.success(`Added “${rule.name}”. The next check uses it.`)
          window.setTimeout(() => document.querySelector(`[data-rule="${rule.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300)
        }}
      />
    </>
  )
}
