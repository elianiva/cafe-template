import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

test('backend contexts do not import Cloudflare or Alchemy adapters', async () => {
  const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const contextsRoot = join(sourceRoot, 'contexts')
  const files = ['system/handlers.ts']
  const violations: string[] = []

  for (const file of files) {
    const source = await readFile(join(contextsRoot, file), 'utf8')
    if (/from\s+['"](?:alchemy|cloudflare:|@cloudflare\/)/.test(source)) {
      violations.push(file)
    }
  }

  expect(violations).toEqual([])
})
