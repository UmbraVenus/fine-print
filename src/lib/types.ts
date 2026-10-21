export type Role = 'reviewer' | 'marketer'
export type Product = 'personal_loan' | 'credit_card' | 'mortgage'
export type AdStatus = 'draft' | 'pending' | 'changes_required' | 'approved_with_changes' | 'approved' | 'rejected'
export type Severity = 'critical' | 'caution'
export type Template = 'social-square' | 'social-portrait' | 'banner' | 'email' | 'landing-page' | 'blog-post'
export type LayerRole = 'headline' | 'body' | 'cta' | 'disclosure' | 'subject' | 'from' | 'url' | 'eyebrow'

export interface Layer {
  id: string
  role: LayerRole
  text: string
  style?: { fontSize?: number; weight?: number; icon?: string; maxWidth?: number }
}

export interface Shape {
  shape: 'circle' | 'rect'
  right: number
  bottom: number
  w: number
  h: number
  radius?: number
  color: string
}

export interface Theme {
  bg?: string
  fg?: string
  fine?: string
  cta_bg?: string
  cta_fg?: string
  shapes?: Shape[]
  avatar?: string
  art?: 'house' | 'card'
  art_color?: string
  accent?: string
  url?: string
}

export interface AdContent {
  template: Template
  theme: Theme
  layers: Layer[]
}

export interface Trend {
  value: number
  direction: 'up' | 'down'
  good: boolean
  unit: '%' | 'pts'
  compared_to: string
}

export interface Stat {
  key: string
  value: number | null
  display?: string
  label: string
  tone: 'warning' | 'success' | 'primary'
  icon: string
  trend?: Trend | null
}

export interface AdRow extends AdContent {
  id: number
  name: string
  format: string
  product: Product
  source: string
  status: AdStatus
  current_version: number
  due_date: string | null
  created_at: string
  updated_at: string
  closed_at: string | null
  live_since: string | null
  version_id: number
  critical: number
  caution: number
  sent: number
  decision_message: string | null
}

export interface AdList {
  rows: AdRow[]
  total: number
  page: number
  page_size: number
  sort: 'name' | 'date'
  order: 'asc' | 'desc'
  stats: Stat[]
  filters: { formats: string[]; products: Product[]; statuses: AdStatus[] }
}
