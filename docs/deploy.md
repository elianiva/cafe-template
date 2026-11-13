# Deploy

Alchemy deploys the website Worker and the API Worker as one stack. The website
Worker reaches the API through a service binding, so the API has no public URL.
This page covers the first deploy and the manual CI workflow.

## Prerequisites

- Node.js 26 or newer and pnpm 12.
- A Cloudflare account and an API token. The token needs Workers Scripts: Edit
  for the default stack. Add D1: Edit when you add the database, and the
  permissions for R2 or Durable Objects when you add those resources.
- A zone in the same account if you attach a custom domain.
- The account ID. Find it in the Cloudflare dashboard.

For a local deploy, authenticate Alchemy with its login flow or export the two
variables the CLI reads:

```sh
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
```

Do not commit either value.

## First deploy

```sh
pnpm deploy
```

`pnpm deploy` runs `alchemy deploy --stage prod`. The first run creates the
state store, then the Workers. Alchemy may ask before it updates the state store.
In CI, `--yes` accepts that prompt:

```sh
pnpm exec alchemy deploy --stage prod --yes
```

The first deploy prints the `workers.dev` URL of the website. Open it, then call
the API from the app. The API Worker stays private because
`alchemy.run.ts` sets `workersDev: false`.

## State

`Cloudflare.state()` keeps the stack state in a state-store Worker in the same
Cloudflare account. The first deploy bootstraps it. Later deploys and CI read it
through the same account credentials.

Do not delete the state store while the stack exists. A lost state store makes
Alchemy treat every resource as new. If you need to move state, follow the
Alchemy state documentation instead of removing the resource by hand.

## Deploy from CI

The repository ships `.github/workflows/deploy.yml`. It is manual on purpose: a
template should not deploy itself when someone pushes.

1. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets.
   The workflow also reads `CLOUDFLARE_ACCOUNT_ID` from a repository variable if
   you prefer.
2. Add `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and
   `SENTRY_PROJECT` if you want Sentry. The workflow sets
   `VITE_SENTRY_RELEASE` to the commit. Sentry is optional: without a DSN the
   deploy ships with the SDK off, and without the token, org, and project the
   source maps are not uploaded.
3. Create an environment named `production` in the repository settings. Add the
   same secrets there if you want the environment to own them.
4. Run the `Deploy` workflow from the Actions tab.

The workflow runs `pnpm install --frozen-lockfile`, then
`pnpm exec alchemy deploy --stage prod --yes`. It does not run the checks. Let
the `CI` workflow pass on the same commit before you deploy, or add a
`workflow_run` trigger after you are comfortable with the pipeline.

To deploy on every push to `main`, change the trigger to:

```yaml
on:
  push:
    branches: [main]
```

Keep the `production` environment approval if you want a human gate.

## Custom domain

Only the `prod` stage should attach the public domain. Add it to the `Website`
resource in `alchemy.run.ts`:

```ts
const Website = Cloudflare.Website.Foldkit('Website', {
  rootDir: 'apps/web',
  main: 'src/worker.ts',
  env: { API: ApiWorker, ...sentryEnv, ...rateLimits },
  assets: { runWorkerFirst: [`${API_PREFIX}/*`] },
  ...(stage === 'prod' && {
    domain: {
      name: 'example.com',
      redirects: ['www.example.com'],
    },
  }),
  compatibility: sentryCompatibility,
  observability,
})
```

The zone must already exist in the Cloudflare account. The API Worker keeps
`workersDev: false`; remove that line only when the API needs its own hostname.

## Secrets and environment variables

Read secrets in `alchemy.run.ts` with `process.env`, then pass them to the Worker
`env` or to the build. A `VITE_` variable is inlined at build time, so it is
public. Do not put a secret behind a `VITE_` prefix.

Fail a production deploy when a required value is missing:

```ts
if (stage === 'prod' && process.env.SOME_KEY === undefined)
  return yield * Effect.die(new Error('SOME_KEY is required for the prod stage.'))
```

Add the variable to the deploy workflow's `env` block, or to the `production`
environment secrets.

## Rollback

Redeploy the commit that worked. The manual workflow checks out the selected
commit, and Alchemy applies the previous stack state. Do not run
`alchemy destroy` against production without a backup plan.

After a deploy, check the website URL, the Workers logs, and the RPC call from
the app. [Production](production.md) lists the settings to review before real
traffic.
