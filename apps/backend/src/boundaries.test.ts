import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

const sourceRoot = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = join(sourceRoot, '../../..')
const contextsRoot = join(sourceRoot, 'contexts')
const webRoot = join(repositoryRoot, 'apps/web/src')
const rpcRoot = join(repositoryRoot, 'packages/rpc/src')

/** Adapters the deployment owns; contexts must stay platform-agnostic. */
const importsHostAdapter =
  /(?:\bfrom\s+|\bimport\s*\(?\s*)['"](?:alchemy(?:\/|['"])|@alchemy\.run\/|cloudflare:|@cloudflare\/|@sentry\/|wrangler)/

/** A context sees a store interface. The implementation lives in `platform`. */
const importsPlatform = /(?:\bfrom\s+|\bimport\s*\(?\s*)['"](?:\.{1,2}\/)+platform\//

/** The browser talks to the RPC contract, never to the API Worker's code. */
const importsBackend =
  /(?:\bfrom\s+|\bimport\s*\(?\s*)['"](?:@template\/backend|(?:\.{1,2}\/)+backend|apps\/backend)/

/** The contract is shared by both apps, so it must not depend on either. */
const importsApp =
  /(?:\bfrom\s+|\bimport\s*\(?\s*)['"](?:@template\/(?:web|backend|reference)|(?:\.{1,2}\/)+apps\/)/

/** The browser must not import a host adapter. Sentry is a browser SDK, so it is allowed. */
const importsAdapter =
  /(?:\bfrom\s+|\bimport\s*\(?\s*)['"](?:alchemy(?:\/|['"])|@alchemy\.run\/|cloudflare:|@cloudflare\/|wrangler)/

/**
 * `@cloudflare/workers-types` is ambient in this package, so a context can name
 * a host type without importing anything. Keep those names at the edge.
 */
const namesHostType =
  /\b(?:D1Database|R2Bucket|KVNamespace|DurableObjectState|DurableObjectStorage|DurableObjectNamespace|ExecutionContext|Fetcher|SqlStorage|AnalyticsEngineDataset|Ai)\b/

const listSources = async (directory: string): Promise<Array<string>> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return listSources(path)
      return entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') ? [path] : []
    }),
  )
  return nested.flat()
}

const scan = async (
  directory: string,
  check: (text: string) => string | undefined,
): Promise<Readonly<{ sources: ReadonlyArray<string>; violations: ReadonlyArray<string> }>> => {
  const sources = await listSources(directory)
  const violations: Array<string> = []

  for (const source of sources) {
    const text = await readFile(source, 'utf8')
    const reason = check(text)
    if (reason !== undefined) violations.push(`${relative(repositoryRoot, source)}: ${reason}`)
  }

  return { sources, violations }
}

test('backend contexts do not depend on the host platform', async () => {
  const { sources, violations } = await scan(contextsRoot, (text) => {
    if (importsHostAdapter.test(text)) return 'imports an Alchemy, Cloudflare, or Sentry adapter'
    if (importsPlatform.test(text)) return 'imports a platform adapter'
    if (namesHostType.test(text)) return 'names a Cloudflare global type'
    return undefined
  })

  expect(sources.length).toBeGreaterThan(0)
  expect(violations).toEqual([])
})

test('the browser does not import backend code or host adapters', async () => {
  const { sources, violations } = await scan(webRoot, (text) => {
    if (importsBackend.test(text)) return 'imports backend code'
    if (importsAdapter.test(text)) return 'imports an Alchemy or Cloudflare adapter'
    return undefined
  })

  expect(sources.length).toBeGreaterThan(0)
  expect(violations).toEqual([])
})

test('the wire contract does not import an app', async () => {
  const { sources, violations } = await scan(rpcRoot, (text) =>
    importsApp.test(text) ? 'imports an app' : undefined,
  )

  expect(sources.length).toBeGreaterThan(0)
  expect(violations).toEqual([])
})
