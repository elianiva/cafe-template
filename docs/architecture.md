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

## Code ownership

- `apps/web/src/app` owns the Foldkit application. Remote data belongs in Foldkit Query submodels. Update handlers decide when to load or revalidate them.
- `apps/backend/src/contexts` is the home for server-side bounded contexts as product vocabulary is discovered. Do not pre-invent product domains in the scaffold.
- `packages/rpc` owns the public wire contract only: Effect RPC groups, request/response schemas, declared errors, and the RPC path.
- `examples/reference` shows a complete Query-to-RPC path in a separate website app. Run it with `pnpm dev:reference`, which uses the root Alchemy entrypoint with the `reference` stage; it is deliberately excluded from the default stack.

## Dependency direction

```text
apps/web ─────────► packages/rpc
apps/backend ─────► packages/rpc
examples/reference ► packages/rpc
```

The web app must not import backend implementation modules. The RPC package must not import either app. Share the wire contract, not internal backend models.

## Cloudflare scope

The initial stack provisions only the website Worker and API Worker. Add D1, R2, Access, Durable Objects, or other Cloudflare services only when a product feature requires them. The example API returns a small static status response and does not imply a persistence choice.
