import * as Cloudflare from '@alchemy.run/cloudflare'
import { sentryRollupPlugin } from '@sentry/rollup-plugin'
import * as Alchemy from 'alchemy'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { API_PREFIX } from '@template/rpc'

const compatibility = { date: '2026-10-08' }
// The Sentry SDK in the API and website Workers needs AsyncLocalStorage, which
// `nodejs_compat` gives.
const sentryCompatibility = { ...compatibility, flags: ['nodejs_compat'] }

/**
 * Sentry is optional. The browser inlines the DSN at build time; the Workers
 * get it as a plain-text binding. A stage without a DSN ships with Sentry off.
 * `VITE_SENTRY_RELEASE` (the commit) is the release all three report.
 */
const sentryDsn = process.env.VITE_SENTRY_DSN ?? ''
const sentryRelease = process.env.VITE_SENTRY_RELEASE ?? ''
const sentryEnv = {
  ...(sentryDsn && { SENTRY_DSN: sentryDsn }),
  ...(sentryRelease && { SENTRY_RELEASE: sentryRelease }),
}

/**
 * Source maps for the API Worker. The website build uploads its own through the
 * Sentry plugin in `apps/web/vite.config.ts`. Both need `SENTRY_AUTH_TOKEN`, and
 * read `SENTRY_ORG` and `SENTRY_PROJECT` from the environment. Without all three,
 * nothing uploads.
 */
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
const sentryUpload =
  sentryAuthToken !== undefined &&
  process.env.SENTRY_ORG !== undefined &&
  process.env.SENTRY_PROJECT !== undefined
const apiBuild = {
  build: {
    input: {
      plugins: sentryUpload
        ? [
            sentryRollupPlugin({
              authToken: sentryAuthToken,
              ...(sentryRelease ? { release: { name: sentryRelease } } : {}),
            }),
          ]
        : [],
    },
  },
}

/**
 * Per-IP limits at the website Worker, before a request reaches the API. A
 * single app rarely makes more than a handful of API calls a minute. Change the
 * namespace IDs to values that are unique in your Cloudflare account.
 */
const rateLimits = {
  RATE_LIMIT_API: Cloudflare.RateLimit('RateLimitApi', {
    namespaceId: 7401,
    simple: { limit: 60, period: 60 },
  }),
}

/**
 * Cloudflare Workers Observability, configured on the host resources only.
 * Sampling at 0.1 keeps one request in ten, enough for a starter and a launch
 * spike. Sentry owns traces, so Cloudflare's are off: they would record every
 * request a second time. Raise the log rate while you debug a specific request.
 */
const observability = {
  enabled: true,
  headSamplingRate: 0.1,
  logs: { enabled: true, invocationLogs: true, headSamplingRate: 0.1, persist: true },
  traces: { enabled: false },
}

const state = Layer.unwrap(
  Effect.gen(function* () {
    const dev = yield* Alchemy.ALCHEMY_DEV.pipe(Effect.orDie)
    return dev ? Alchemy.localState() : Cloudflare.state()
  }),
)

export default Alchemy.Stack(
  'effect-foldkit-template',
  { providers: Cloudflare.providers(), state },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stack.use((stack) => Effect.succeed(stack.stage))
    const ApiWorker = Cloudflare.Worker('Api', {
      main: './apps/backend/src/worker.ts',
      // A stable local URL for the service binding. The website takes 5173.
      dev: { port: 1337 },
      env: { ...sentryEnv },
      ...apiBuild,
      compatibility: sentryCompatibility,
      observability,
      // The website reaches the API through its service binding only. Remove
      // this when the API needs its own public URL or custom domain.
      workersDev: false,
    })
    const Website = Cloudflare.Website.Foldkit('Website', {
      rootDir: stage === 'reference' ? 'examples/reference' : 'apps/web',
      main: 'src/worker.ts',
      dev: { port: 5173 },
      env: { API: ApiWorker, ...sentryEnv, ...rateLimits },
      assets: { runWorkerFirst: [`${API_PREFIX}/*`] },
      compatibility: sentryCompatibility,
      observability,
    })

    yield* ApiWorker
    const website = yield* Website
    return { url: website.url }
  }),
)
