import * as Sentry from '@sentry/cloudflare'

interface ApiBinding {
  fetch(request: Request): Promise<Response>
}

/** The part of Cloudflare's Rate Limit binding this Worker uses. */
interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

interface Environment {
  readonly API: ApiBinding
  /** Declared in `alchemy.run.ts`. Local dev without it allows everything. */
  readonly RATE_LIMIT_API?: RateLimitBinding
  /** Without a DSN the Sentry SDK stays off. */
  readonly SENTRY_DSN?: string
  readonly SENTRY_RELEASE?: string
}

/** A limiter that fails open: an outage in the rate limiter must not stop the app. */
const allowed = async (binding: RateLimitBinding | undefined, key: string): Promise<boolean> => {
  if (binding === undefined) return true
  try {
    return (await binding.limit({ key })).success
  } catch {
    return true
  }
}

const tooMany = (): Response =>
  new Response('Too many requests. Try again in a minute.', {
    status: 429,
    headers: { 'Retry-After': '60', 'Content-Type': 'text/plain; charset=utf-8' },
  })

/**
 * Only requests under the API prefix reach this module (see `runWorkerFirst`
 * in `alchemy.run.ts`). Every other path is served from the static assets.
 */
export default Sentry.withSentry(
  (env: Environment) => ({
    dsn: env.SENTRY_DSN,
    release: env.SENTRY_RELEASE,
    // Only a browser trace is continued. A request without one starts none.
    tracesSampler: ({ parentSampled }) => (parentSampled ? 1 : 0),
    initialScope: { tags: { service: 'website-worker' } },
  }),
  {
    // The incoming request carries the browser's trace headers. The service binding passes the
    // same headers on, so one trace covers the browser and both Workers.
    async fetch(request: Request, env: Environment): Promise<Response> {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
      if (!(await allowed(env.RATE_LIMIT_API, ip))) return tooMany()
      return env.API.fetch(request)
    },
  },
)
