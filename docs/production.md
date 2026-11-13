# Production

The starter ships a small production baseline: sampled observability, security
headers, immutable caching for hashed assets, and a crash reporter hook. This
page lists the rest of the settings to review before real traffic.

## Observability

`alchemy.run.ts` samples logs and traces at 0.1 and keeps them in Cloudflare.
One request in ten is enough to see a launch spike. Raise both rates while you
debug a specific request, then lower them again.

If you add Sentry or another tracer, turn Cloudflare traces off so a request is
recorded once. Keep logs on.

## Security headers and caching

`apps/web/public/_headers` sets:

- HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, and a CSP.
- `Cache-Control: public, max-age=0, must-revalidate` for documents.
- `Cache-Control: public, max-age=31536000, immutable` for `/assets/*`.

Tune the CSP when you add a font, an image host, or a script. Keep
`frame-ancestors 'none'` unless you embed the app. The reference app has its own
`_headers` and a `robots.txt` that blocks indexing.

## Rate limits

The default stack has no rate limit. Add one at the website Worker when the API
is public and has no accounts. The binding fails open in the example so a
limiter outage does not stop the app.

```ts
const rateLimits = {
  RATE_LIMIT_API: Cloudflare.RateLimit('RateLimitApi', {
    namespaceId: 7301,
    simple: { limit: 60, period: 60 },
  }),
}
```

Add the binding to the `Website` env, then check it in `apps/web/src/worker.ts`
before the service binding:

```ts
interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

const allowed = async (binding: RateLimitBinding | undefined, key: string) => {
  if (binding === undefined) return true
  try {
    return (await binding.limit({ key })).success
  } catch {
    return true
  }
}
```

Return `429` with `Retry-After` when the limit refuses a request. Pick a
`namespaceId` that is unique in the account.

## Error reporting

`apps/web/src/entry.ts` passes a `crash.report` hook to
`Runtime.makeApplication`. It logs to the console today. Replace it with Sentry,
Bugsnag, or your own endpoint.

For Sentry on the Workers, add `nodejs_compat` to the compatibility flags:

```ts
const sentryCompatibility = {
  ...compatibility,
  flags: ['nodejs_compat'],
}
```

Wrap both Worker entries with `Sentry.withSentry`, upload hidden source maps from
the build, and set the release to the commit. Keep `ApiError` out of the issue
stream: it is a declared answer, not a fault. Report store and transport failures
instead.

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
- [ ] The custom domain is attached only to `prod`.
- [ ] The API Worker has no `workers.dev` URL.
- [ ] `_headers` matches the assets and third-party hosts you actually use.
- [ ] Sampling is set for the expected traffic.
- [ ] A failed request reaches your error reporter.
- [ ] A rollback commit is known.
