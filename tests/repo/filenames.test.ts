import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  )
}

describe('file names', () => {
  // macOS and Windows disks ignore case, so `WhatChanged.tsx` and `whatChanged.ts` would load as one module there.
  it('never differ only by case, ignoring the extension', () => {
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const file of files('src').map((f) => relative('src', f))) {
      const key = file.replace(/\.(tsx?|css)$/, '').toLowerCase()
      const other = seen.get(key)
      if (other && other !== file) clashes.push(`${other} / ${file}`)
      seen.set(key, file)
    }
    expect(clashes).toEqual([])
  })
})
