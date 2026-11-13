# Cafe

Cloudflare · Alchemy · Foldkit · Effect.

A strict, extensible full-stack starter for Cloudflare Workers, Alchemy,
Foldkit, and Effect. Cloudflare runs the code, Alchemy owns the infrastructure,
Foldkit owns the UI, and Effect owns the server and the shared contract.

The website and the API are separate apps. Alchemy composes them into one
deployment, with a service binding routing same-origin API requests to the
backend.

## Apps and packages

- `apps/web` — Foldkit application, website Worker, and static assets.
- `apps/backend` — Effect RPC handlers, the API Worker entry, and the platform adapters.
- `packages/rpc` — the wire contract: RPC groups, schemas, declared errors, and the API path prefix.
- `examples/reference` — a complete Foldkit Query to RPC example, deployed only to the `reference` stage.

## Get started

Requirements: Node.js 26 or newer and pnpm 12.

```sh
pnpm install
pnpm dev
```

The default Alchemy stack creates the website and API Workers. The reference application uses the same root Alchemy entrypoint with a separate stage:

```sh
pnpm dev:reference
```

## Make it yours

Run the rename script once, before the first feature:

```sh
pnpm rename my-app
pnpm install
```

It updates the package scope, the Alchemy stack name, page titles, the favicon
label, the test URL, and the README heading. It skips `pnpm-lock.yaml`; the
install refreshes it.

## Verify a change

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

`pnpm check` formats and lints through Vite+; the other scripts run through Turbo. Pre-commit runs `pnpm check`, and pre-push runs the typecheck and the tests.

## Deploy

`pnpm deploy` deploys the default stack to Cloudflare with the `prod` stage. Read
[Deploy](docs/deploy.md) for the token, state store, custom domain, and the manual
CI workflow.

The API Worker has no `workers.dev` URL. The website reaches it through its service binding, so the RPC endpoint has one public origin. Remove `workersDev: false` in `alchemy.run.ts` when the API needs its own URL or custom domain.

## Design notes

- Read [Architecture](docs/architecture.md) for app, backend, and RPC boundaries.
- Read [Tooling](docs/tooling.md) for Vite+, Turbo, `tsrs`, and Oxfmt/Oxlint responsibilities.
- Read [Guardrails](docs/guardrails.md) for the rules and the checks that enforce them.
- Read [Adding a feature](docs/extending.md) for the path from contract to handler to UI.
- Read [Recipes](docs/recipes.md) for a D1-backed store and a new binding.
- Read [Production](docs/production.md) for headers, rate limits, error reporting, and launch checks.
- Read [Deploy](docs/deploy.md) for the first deploy and the manual CI workflow.
- The reference example is intentionally kept separate from the starter UI. Copy patterns from it; do not move its demo behavior into the default app by default.

## License

MIT. See [LICENSE](LICENSE).
