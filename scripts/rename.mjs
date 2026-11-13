#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const skipDirectories = new Set([
  '.alchemy',
  '.amp',
  '.git',
  '.turbo',
  '.wrangler',
  'coverage',
  'dist',
  'node_modules',
])
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
])
const skippedFiles = new Set(['pnpm-lock.yaml', 'scripts/rename.mjs'])

const args = process.argv.slice(2)
const name = args.find((argument) => !argument.startsWith('-'))
const dryRun = args.includes('--dry-run')

if (name === undefined) {
  console.error('Usage: node scripts/rename.mjs <project-name> [--dry-run]')
  process.exit(1)
}

if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('Use kebab-case: lowercase letters, numbers, and hyphens, starting with a letter.')
  process.exit(1)
}

const title = name
  .split('-')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ')

const replacements = [
  ['@template/', `@${name}/`],
  ['@template\\/', `@${name}\\/`],
  ['effect-foldkit-cloudflare-template', name],
  ['effect-foldkit-template', name],
  ['template/reference/ApiRpc', `${name}/reference/ApiRpc`],
  ['template/web/ApiRpc', `${name}/web/ApiRpc`],
  ['template/backend/', `${name}/backend/`],
  ['template/web/', `${name}/web/`],
  ['template/reference/', `${name}/reference/`],
  ['Effect Foldkit Template', title],
  ['Effect + Foldkit template', title],
  ['Effect Foldkit template', title],
  ['https://template.test', `https://${name}.test`],
  ['# Cafe', `# ${title}`],
]

const files = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        return skipDirectories.has(entry.name) ? [] : files(path)
      }
      return [path]
    }),
  )
  return nested.flat()
}

const sources = await files(root)
const changed = []

for (const source of sources) {
  const path = relative(root, source)
  if (skippedFiles.has(path)) continue
  if (!textExtensions.has(path.slice(path.lastIndexOf('.')))) continue

  const before = await readFile(source, 'utf8')
  let after = before
  for (const [from, to] of replacements) after = after.replaceAll(from, to)
  if (after === before) continue

  changed.push(path)
  if (!dryRun) await writeFile(source, after)
}

if (changed.length === 0) {
  console.log(`No template names found.`)
  process.exit(0)
}

console.log(`${dryRun ? 'Would rename' : 'Renamed'} ${changed.length} files for ${title}:`)
for (const path of changed) console.log(`  ${path}`)

if (!dryRun) {
  console.log('\nRun `pnpm install` to refresh the lockfile and workspace links.')
}
