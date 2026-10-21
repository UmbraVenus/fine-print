// Dates read by day, never hours: "Today", "Tomorrow", "Yesterday", then "Oct 23".
// The workspace plans in Pacific time; the server sends its "today" so every label agrees with the stats.

export const WORKSPACE_TZ = 'America/Los_Angeles'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A UTC timestamp as a workspace calendar date, "YYYY-MM-DD". */
export function workspaceDate(iso: string, timeZone = WORKSPACE_TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso),
  )
}

function parseDay(day: string): { y: number; m: number; d: number; t: number } {
  const [y, m, d] = day.split('-').map(Number)
  return { y, m, d, t: Date.UTC(y, m - 1, d) }
}

/** Whole days from `today` to `day` (both "YYYY-MM-DD"); negative in the past. */
export function daysBetween(today: string, day: string): number {
  return Math.round((parseDay(day).t - parseDay(today).t) / 86_400_000)
}

/** "Oct 23", with the year only when it isn't this year. */
export function shortDate(day: string, today: string): string {
  const { y, m, d } = parseDay(day)
  const label = `${MONTHS[m - 1]} ${d}`
  return y === parseDay(today).y ? label : `${label}, ${y}`
}

/** "Today", "Tomorrow", "Yesterday", else "Oct 23". `day` is a date or a UTC timestamp. */
export function dayLabel(day: string, today: string): string {
  const date = day.length > 10 ? workspaceDate(day) : day
  const diff = daysBetween(today, date)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return shortDate(date, today)
}

/** The same label inside a sentence: "today", "tomorrow", "Oct 23". */
export function dayPhrase(day: string, today: string): string {
  const label = dayLabel(day, today)
  return label === 'Today' || label === 'Tomorrow' || label === 'Yesterday' ? label.toLowerCase() : label
}
