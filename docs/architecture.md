# Architecture

## Runtime boundaries

`apps/web` and `apps/backend` are separate deployable applications. The browser sends requests to the website origin. The website Worker forwards `/api/*` requests to the API Worker through an Alchemy-managed service binding. Alchemy deploys both Workers in one stack.

```text
Browser / Foldkit
       │ same-origin /api/rpc
       ▼
Website Worker ── service binding ──► API Worker
                                           │
                                           ▼
                                      Effect RPC
                                           │
                                           ▼
                                      packages/rpc
```

The service binding is a deployment concern. Business handlers must not depend on Cloudflare types or bindings. The root `alchemy.run.ts` owns all resource declarations and selects the default website or reference example by Alchemy stage (`reference` selects the example). Each app exposes a plain `src/worker.ts` runtime entry module; these modules do not import Alchemy or declare infrastructure.

## Request routing

`packages/rpc/src/paths.ts` owns `API_PREFIX` and `RPC_PATH`. `alchemy.run.ts` derives the website's `runWorkerFirst` rule from `API_PREFIX`, so the path that the contract declares and the path that the deployment routes cannot drift apart.

The website Worker therefore receives only requests under that prefix, and forwards them to the API Worker through the service binding. Every other path is served from the static assets, including the client-side fallback for unmatched routes.

The API Worker sets `workersDev: false`. The website origin is its only public surface, so a caller cannot skip the website Worker by addressing the API directly.

## Backend composition

`apps/backend/src/handler.ts` owns the RPC composition. `handlerFor` takes one
handler layer per context and returns a web handler. The default input is the
real set. A test passes a fake layer and never starts the Worker.

A context defines the store interface it needs. `apps/backend/src/platform`
implements it with D1, R2, a Durable Object, or another binding. `handler.ts`
supplies the implementation. `apps/backend/src/worker.ts` stays a thin runtime
entry that builds the handler from its bindings and exports `fetch`.

`apps/backend/src/boundaries.test.ts` enforces three directions: contexts do not
import host adapters, the browser does not import backend code, and the wire
contract does not import either app.

## Rate limits

The website Worker applies a per-IP limit before it reaches the service binding. `RATE_LIMIT_API` is declared in `alchemy.run.ts` and bound to the `Website` env. The worker keys the bucket on `CF-Connecting-IP`, fails open when the binding is missing or throws, and answers a refused request with `429` and `Retry-After`. Change `namespaceId` to a value that is unique in your Cloudflare account.

## Telemetry

Sentry records errors, traces, and profiles. The browser starts it in `apps/web/src/platform/sentry.ts`; both Workers wrap their entries with `Sentry.withSentry`. The Workers need `nodejs_compat`, which `sentryCompatibility` sets. `apps/backend/src/handler.ts` provides the Effect error reporter, tracer, and logger, so a span from a context becomes a Sentry span. `ApiError` is a declared answer and stays out of the issue stream.

Cloudflare Workers Observability keeps logs only, sampled at 0.1. Traces are off so a request is traced once. Set `VITE_SENTRY_DSN` and `VITE_SENTRY_RELEASE` to turn Sentry on; without a DSN the browser and both Workers run with the SDK off. `SENTRY_AUTH_TOKEN` uploads hidden source maps from the build.

The browser sends trace headers to `/api/` only. The website Worker passes them through the service binding, so one trace covers the browser, both Workers, and the API handler.

## Code ownership

- `apps/web/src/app` owns the Foldkit application. Remote data belongs in Foldkit Query submodels. Update handlers decide when to load or revalidate them. `apps/web/src/platform` owns the RPC client and the browser Sentry setup.
- `apps/backend/src/contexts` is the home for server-side bounded contexts as product vocabulary is discovered. Do not pre-invent product domains in the scaffold.
- `apps/backend/src/platform` owns host adapters: D1 queries, Durable Objects, R2 reads, and the structural types they expose.
- `apps/backend/src/handler.ts` owns RPC composition and the Sentry Effect layers. `apps/backend/src/worker.ts` is the runtime entry that wraps the handler with Sentry.
- `packages/rpc` owns the public wire contract only: Effect RPC groups, request/response schemas, declared errors, and the API path prefix.
- `examples/reference` shows a complete Query-to-RPC path in a separate website app. It keeps its own RPC client because it deploys separately; `apps/web/src/platform/rpc.ts` is the client the default app uses. Run it with `pnpm dev:reference`, which uses the root Alchemy entrypoint with the `reference` stage; it is deliberately excluded from the default stack.

## Dependency direction

```text
apps/web ─────────► packages/rpc
apps/backend ─────► packages/rpc
examples/reference ► packages/rpc
```

The web app must not import backend implementation modules. The RPC package must not import either app. A backend context must not import `apps/backend/src/platform`; it depends on its own store interface. Share the wire contract and the store interface, not internal models.

## Cloudflare scope

The initial stack provisions only the website Worker and API Worker. Add D1, R2, Access, Durable Objects, or other Cloudflare services only when a product feature requires them. The example API returns a small static status response and does not imply a persistence choice. [Recipes](recipes.md) shows the D1 path end to end.
