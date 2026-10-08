# Effect + Foldkit + Cloudflare template

A strict, extensible full-stack starter for Effect, Foldkit, and Cloudflare Workers. The web app and API Worker are separate apps. Alchemy composes them into one deployment, with a service binding routing same-origin API requests to the backend.

## Apps and packages

- `apps/web` — Foldkit UI and website Worker.
- `apps/backend` — Effect RPC server and API Worker.
- `packages/rpc` — RPC groups, schemas, declared errors, and shared endpoint paths.
- `examples/reference` — a permanent Foldkit Query + RPC example. Run it separately; it is not deployed with the default stack.

## Get started

Requirements: Node.js 24.11 or newer and pnpm 12.

```sh
pnpm install
pnpm dev
```

The default Alchemy stack creates the website and API Workers. The reference application uses the same root Alchemy entrypoint and a separate `reference` stage:

```sh
pnpm dev:reference
```

Run the checks before making changes:

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

`pnpm deploy` deploys the default stack to Cloudflare. Configure your own Alchemy credentials and stack state before using it.

## Design notes

- Read [Architecture](docs/architecture.md) for app and RPC boundaries.
- Read [Tooling](docs/tooling.md) for Vite+, Turbo, and Oxfmt/Oxlint responsibilities.
- The reference example is intentionally kept separate from the starter UI. Copy patterns from it; do not move its demo behavior into the default app by default.
