import { describe, expect, it } from 'vitest'
import { colorToken, theme } from './theme'

describe('theme', () => {
  it('uses the tokens.json warning, not the bundle.js one', () => {
    expect(theme.token?.colorWarning).toBe('#a15c07')
  })

  it('maps brand colors from tokens.json', () => {
    expect(theme.token?.colorPrimary).toBe('#0f766e')
    expect(theme.token?.colorText).toBe('#15213b')
    expect(theme.token?.borderRadius).toBe(8)
  })

  it('resolves token references', () => {
    expect(colorToken('highlight-outline')).toBe(colorToken('ink'))
  })
})
