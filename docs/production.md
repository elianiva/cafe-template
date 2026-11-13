# Production

The starter ships errors, traces, profiles, per-IP rate limits, security
headers, and immutable caching for hashed assets. Sentry stays off until you set
a DSN, so a clone of the template sends nothing. This page lists the settings to
review before real traffic.

## Observability

Sentry is wired into the browser and both Workers:

- `apps/web/src/platform/sentry.ts` starts the browser SDK, reports crashes and
  slow Foldkit phases, and turns Effect spans into Sentry spans.
- `apps/backend/src/handler.ts` provides the Effect error reporter, tracer, and
  logger. It keeps `ApiError` out of the issue stream because a declared answer
  is not a fault.
- Both Worker entries wrap `fetch` with `Sentry.withSentry`.
- `alchemy.run.ts` adds `nodejs_compat`, passes the DSN and release to the
  Workers, and runs the Rollup plugin that uploads API source maps.
- `apps/web/vite.config.ts` uploads the browser source maps when
  `SENTRY_AUTH_TOKEN` is set.

Set `VITE_SENTRY_DSN` and `VITE_SENTRY_RELEASE` in the deploy environment.
`VITE_SENTRY_RELEASE` should be the commit. Add `SENTRY_AUTH_TOKEN`,
`SENTRY_ORG`, and `SENTRY_PROJECT` to upload hidden source maps. Without all three the build skips
the upload. Without a DSN the SDK stays off.

Cloudflare Workers Observability keeps logs only, sampled at 0.1. Traces are off
so a request is traced once. Sentry samples traces at 10%, follows the browser's
choice through the service binding, and profiles 5% of sessions.

## Security headers and caching

`apps/web/public/_headers` sets:

- HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, and a CSP.
- `Cache-Control: public, max-age=0, must-revalidate` for documents.
- `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`.

Tune the CSP when you add a font, an image host, or a script. The default
`connect-src` already allows Sentry ingest; remove it when you remove Sentry.
Keep `frame-ancestors 'none'` unless you embed the app. The reference app has its
own `_headers` and a `robots.txt` that blocks indexing.

## Rate limits

`alchemy.run.ts` declares `RATE_LIMIT_API` and binds it to the website Worker.
`apps/web/src/worker.ts` keys the bucket on `CF-Connecting-IP` before the service
binding. The default is 60 requests per 60 seconds.

The limiter fails open. A missing binding (local dev) or a limiter outage allows
the request. A refused request gets `429` with `Retry-After`. Change
`namespaceId` to a value that is unique in your Cloudflare account, and raise the
limit when the app makes more than a handful of API calls a minute.
`apps/web/src/worker.test.ts` covers allowed, refused, and fail-open requests.

## Error reporting

`apps/web/src/entry.ts` calls `startSentry()` before the runtime starts, then
passes `reportCrash` and `reportSlow` to Foldkit. A crash paints Foldkit's crash
view and reaches Sentry with the Message tag. A slow phase is sent as a
`foldkit.slow_ms` distribution.

The API Worker reports Effect failures through `ErrorReporter` in
`apps/backend/src/handler.ts`. Store and transport failures reach Sentry. An
`ApiError` does not, because it is the declared answer to a bad request.

Set the DSN in production to turn this on. Use the Sentry release to connect an
error to the commit, and keep the source map upload token in the deploy
environment only.

## Analytics

If you add product analytics, proxy it through the website Worker on a path that
is not `/api`. A same-origin path avoids the hostname blocklists that catch
analytics scripts. Drop cookies and credentials before forwarding, and document
the opt-out in your privacy page.

Do not send user text, keys, or save files to analytics. Send counts and
durations.

## SEO and the app shell

The website has a `robots.txt` that allows indexing. Add a `sitemap.xml` only
after you know the production domain, and list the domain in `robots.txt`.
`apps/web/index.html` has a title, description, theme colour, and favicon. Add
Open Graph tags, a social image, and JSON-LD when the site has a public name.

If the app should install, add a `manifest.webmanifest` with icons, `id`,
`lang`, and a start URL. A service worker needs its own cache policy. Do not
cache `/api` responses without a revalidation rule.

## Accessibility

Check the app with a keyboard before launch: every control is reachable, focus
is visible, and a dialog returns focus to its trigger. Respect
`prefers-reduced-motion` for transitions. Keep the document language in sync
with the interface language when you add one.

## State and backups

Alchemy keeps stack state in a state-store Worker. Do not delete it. The default
stack stores no user data. When you add D1, take a backup before a migration and
test the migration on a staging stage first.

## Launch checklist

- [ ] `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- [ ] The `CI` workflow is green on the commit you deploy.
- [ ] `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set for the deploy.
- [ ] The `production` environment has the secrets it needs.
- [ ] `VITE_SENTRY_DSN` and `VITE_SENTRY_RELEASE` are set, and source maps upload with `SENTRY_AUTH_TOKEN`.
- [ ] The custom domain is attached only to `prod`.
- [ ] The API Worker has no `workers.dev` URL.
- [ ] `_headers` matches the assets and third-party hosts you actually use.
- [ ] The rate-limit namespace is unique and the limit matches the app's traffic.
- [ ] Cloudflare log sampling and the Sentry trace and profile rates match the expected traffic.
- [ ] A failed request reaches Sentry, and a declared `ApiError` does not.
- [ ] A request over the limit gets `429` with `Retry-After`.
- [ ] A rollback commit is known.
