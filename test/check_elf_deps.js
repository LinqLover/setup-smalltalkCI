#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p))
    else out.push(p)
  }
  return out
}

const root = join(process.argv[2] || process.cwd())

const files = walk(root).filter(
  (p) => p.endsWith('/squeak') || p.endsWith('.so')
)

const missingLibraries = {}

for (const file of files) {
  const result = spawnSync('ldd', [file], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  })

  const output = `${result.stdout || ''}\n${result.stderr || ''}`

  const missing = [...output.matchAll(/^\s*(\S+)\s+=>\s+not found\s*$/gm)].map(
    (match) => match[1]
  )

  if (missing.length > 0) {
    missingLibraries[relative(root, file)] = [...new Set(missing)]
  }
}

if (Object.keys(missingLibraries).length > 0) {
  console.error('Missing shared libraries:')
  console.log(JSON.stringify(missingLibraries, null, 2))
  process.exit(1)
}

console.error('No missing shared libraries found.')
