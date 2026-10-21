import { describe, expect, it } from 'vitest'
import { dayLabel, dayPhrase, daysBetween, workspaceDate } from './dates'

const TODAY = '2026-10-21'

describe('dayLabel', () => {
  it('reads future days', () => {
    expect(dayLabel('2026-10-21', TODAY)).toBe('Today')
    expect(dayLabel('2026-10-22', TODAY)).toBe('Tomorrow')
    expect(dayLabel('2026-10-23', TODAY)).toBe('Oct 23')
  })

  it('reads past days', () => {
    expect(dayLabel('2026-10-20', TODAY)).toBe('Yesterday')
    expect(dayLabel('2026-10-17', TODAY)).toBe('Oct 17')
  })

  it('adds the year only for another year', () => {
    expect(dayLabel('2025-12-30', TODAY)).toBe('Dec 30, 2025')
  })

  it('reads timestamps in workspace time, never hours', () => {
    // 11pm Pacific on Oct 20 is already Oct 21 in UTC.
    expect(dayLabel('2026-10-21T06:00:00Z', TODAY)).toBe('Yesterday')
    expect(dayLabel('2026-10-21T17:00:00Z', TODAY)).toBe('Today')
  })

  it('has a lowercase form for sentences', () => {
    expect(dayPhrase('2026-10-21', TODAY)).toBe('today')
    expect(dayPhrase('2026-10-26', TODAY)).toBe('Oct 26')
  })
})

describe('helpers', () => {
  it('converts timestamps to workspace dates', () => {
    expect(workspaceDate('2026-10-24T01:00:00Z')).toBe('2026-10-23')
  })

  it('counts days across months', () => {
    expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3)
  })
})
