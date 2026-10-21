import type { ThemeConfig } from 'antd'
import tokens from '../docs/design-system/tokens.json'

// The single source for colors is tokens.json; antd needs literal values, so read them by name.
const color = Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t.value]))

export function colorToken(name: string): string {
  const value = color[name]
  if (!value) throw new Error(`Unknown color token: ${name}`)
  return value.startsWith('{') ? colorToken(value.slice(1, -1)) : value
}

const px = (value: string) => parseInt(value, 10)
const radius = Object.fromEntries(tokens.radius.tokens.map((t) => [t.name, px(t.value)]))
const shadow = Object.fromEntries(tokens.shadow.tokens.map((t) => [t.name, t.value]))

export const fontFamily = tokens.type.families.sans
export const fontFamilyMono = tokens.type.families.mono

export const theme: ThemeConfig = {
  token: {
    colorPrimary: colorToken('primary'),
    colorInfo: colorToken('primary'),
    colorLink: colorToken('primary'),
    colorSuccess: colorToken('success'),
    colorWarning: colorToken('warning'),
    colorError: colorToken('critical'),
    colorText: colorToken('ink'),
    colorTextSecondary: colorToken('ink-muted'),
    colorTextTertiary: colorToken('ink-muted'),
    colorTextPlaceholder: colorToken('ink-placeholder'),
    colorBorder: colorToken('line-strong'),
    colorBorderSecondary: colorToken('line'),
    colorPrimaryBorder: colorToken('primary'),
    colorBgLayout: colorToken('surface-subtle'),
    colorBgContainer: colorToken('surface'),
    borderRadius: radius['radius-md'],
    borderRadiusLG: radius['radius-lg'],
    borderRadiusSM: radius['radius-sm'],
    fontFamily,
    fontFamilyCode: fontFamilyMono,
    fontSize: 14,
    controlHeight: 36,
    boxShadow: shadow['shadow-overlay'],
  },
  components: {
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 600 },
    Segmented: { itemSelectedColor: colorToken('ink') },
    Collapse: { colorBorder: colorToken('line') },
  },
}
