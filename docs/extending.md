# Adding a feature

The starter ships one endpoint so the wiring is visible, not as a product
domain. Use that endpoint as the shape for your own.

## Where each change goes

| Concern                  | Location                              |
| ------------------------ | ------------------------------------- |
| Wire contract and errors | `packages/rpc/src`                    |
| Server-side behavior     | `apps/backend/src/contexts/<context>` |
| Store and host adapters  | `apps/backend/src/platform`           |
| Handler composition      | `apps/backend/src/handler.ts`         |
| Browser state and UI     | `apps/web/src/app`                    |
| Browser details          | `apps/web/src/entry.ts`               |
| Deployment and bindings  | `alchemy.run.ts`                      |

## Add an endpoint to the existing contract

1. Declare the request, response, and declared error in
   `packages/rpc/src/system.ts`. Every endpoint returns the shared `ApiError`:

   ```ts
   import { ApiError } from './errors.ts'

   export const SystemVersion = Schema.Struct({ version: Schema.String })

   export class SystemRpc extends RpcGroup.make(
     Rpc.make('systemStatusGet', { success: SystemStatus, error: ApiError }),
     Rpc.make('systemVersionGet', { success: SystemVersion, error: ApiError }),
   ) {}
   ```

2. Export the schema from `packages/rpc/src/index.ts` when the browser needs it.

3. Implement the handler in `apps/backend/src/contexts/system/handlers.ts`.
   `SystemRpc.of` is typed from the group, so a missing method fails typecheck:

   ```ts
   SystemRpc.of({
     systemStatusGet: () => Effect.succeed({ message: 'The API Worker is connected.' }),
     systemVersionGet: () => Effect.fail(new ApiError({ message: 'No version is configured.' })),
   })
   ```

4. Call it from the browser through `ApiRpc` in
   `apps/web/src/platform/rpc.ts`. `apps/web/src/entry.ts` already provides the
   client's layer:

   ```ts
   const application = Runtime.makeApplication({
     // ...
     resources: ApiRpc.layer,
   })
   ```

5. Keep remote data in a Foldkit Query submodel, as
   `examples/reference/src/query-example.ts` does. Update handlers decide when to
   load or revalidate; views read the query.

## Errors

`packages/rpc/src/errors.ts` owns `ApiError`, the only declared failure on the
wire. A handler returns it with `Effect.fail(new ApiError({ message }))`. Do not
throw, and do not invent a new error shape at the edge: a client cannot type what
the contract does not declare.

The client sees two sources of failure: the declared `ApiError` and the
transport-level `RpcClientError` from `effect/rpc`. The reference app maps the
transport error into `ApiError`, which leaves the view with one type:

```ts
Effect.mapError((error) =>
  error._tag === 'RpcClientError' ? new ApiError({ message: error.message }) : error,
)
```

Match on `_tag`, not `instanceof`. `_tag` survives serialization; the prototype
does not.

Sentry receives failures reported by the Effect runtime and the Worker edges.
`apps/backend/src/handler.ts` filters `ApiError` before it reaches the issue
stream, so a declared answer stays out. A context uses `Effect.withSpan` when it
needs a span. It does not import Sentry.

## Add a bounded context

Give the context its own folder, its own RPC group, a store interface, and a
handler layer. Then compose them at the edge.

```ts
// packages/rpc/src/index.ts
export class Api extends SystemRpc.merge(NotesRpc) {}
```

```ts
// apps/backend/src/handler.ts
export type HandlerInput = Readonly<{
  system: typeof SystemHandlers
  notes: typeof NotesHandlers
}>

const defaults: HandlerInput = {
  system: SystemHandlers,
  notes: NotesHandlers,
}

export const handlerFor = (input: HandlerInput = defaults) =>
  HttpRouter.toWebHandler(
    RpcServer.layerHttp({ group: Api, path: RPC_PATH, protocol: 'http' }).pipe(
      Layer.provide(Layer.mergeAll(input.system, input.notes)),
      Layer.provideMerge(RpcSerialization.layerJson),
    ),
  )
```

`worker.ts` stays a thin entry that imports `handler`. A test calls
`handlerFor` with a fake layer or a fake store, so it never needs the Worker
runtime.

Do not add a context until a product feature needs it. Empty domains are harder
to remove than to add.

## Add a store

A context owns the interface it needs, never the D1 or Durable Object type. The
implementation lives in `apps/backend/src/platform`, and `handler.ts` wires it
into `handlerFor`. The [D1 recipe](recipes.md#add-a-d1-backed-store) walks
through the migration, the binding, the adapter, and the test.

## Verify the change

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
```

`apps/backend/src/worker.test.ts` calls the API Worker through a real RPC client,
so it fails when the contract, the path, or the handlers stop agreeing. It also
drives a declared `ApiError` across the transport. `apps/backend/src/boundaries.test.ts`
keeps host imports out of contexts, keeps backend code out of the browser, and
keeps both apps out of the wire contract.

`pnpm typecheck` also rejects unstable Effect APIs outside their tsconfig
allowlist. If a new file needs one, add the narrowest matching entry to that
package's tsconfig, as [Guardrails](guardrails.md) describes.

For the finished version of this path, read
[`examples/reference`](../examples/reference/README.md).
