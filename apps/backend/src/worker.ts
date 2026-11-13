import * as Sentry from '@sentry/cloudflare'
import { handler, type Env } from './handler.ts'

export type { Env }

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    release: env.SENTRY_RELEASE,
    // Sentry owns traces; Cloudflare Workers Observability keeps logs only (see `alchemy.run.ts`).
    // A request follows the browser's choice; one without a trace header is sampled on its own.
    tracesSampler: ({ parentSampled }) => parentSampled ?? 0.1,
    initialScope: { tags: { service: 'api-worker' } },
  }),
  {
    // The incoming request carries the browser's trace headers. The service binding passes the
    // same headers on, so one trace covers the browser, the website Worker, and the API Worker.
    fetch: (request: Request) => handler.handler(request),
  },
)
