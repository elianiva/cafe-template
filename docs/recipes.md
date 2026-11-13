# Recipes

These are the changes a feature usually needs next. Each recipe keeps the same
boundaries as the starter: the wire contract in `packages/rpc`, a context in
`apps/backend/src/contexts`, a host adapter in `apps/backend/src/platform`, and
composition in `apps/backend/src/handler.ts`.

## Add a D1-backed store

This recipe adds a `notes` table and a `notesList` RPC. The context never sees a
`D1Database`; it sees a store interface. The adapter owns the SQL.

### 1. Declare the contract

```ts
// packages/rpc/src/notes.ts
import { Schema } from 'effect'
import { Rpc, RpcGroup } from 'effect/rpc'
import { ApiError } from './errors.ts'

export const Note = Schema.Struct({
  id: Schema.String,
  body: Schema.String,
})

export class NotesRpc extends RpcGroup.make(
  Rpc.make('notesList', {
    success: Schema.Array(Note),
    error: ApiError,
  }),
) {}
```

Merge it into the served group in `packages/rpc/src/index.ts`:

```ts
export class Api extends SystemRpc.merge(NotesRpc) {}
```

### 2. Define the store interface

```ts
// apps/backend/src/contexts/notes/store.ts
import { Context, type Effect } from 'effect'
import { Schema } from 'effect'

export type Note = Readonly<{ id: string; body: string }>

export class NoteStoreError extends Schema.TaggedError<
  NoteStoreError,
  { readonly brand: unique symbol }
>()('NoteStoreError', { message: Schema.String }) {}

export class NoteStore extends Context.Service<
  NoteStore,
  Readonly<{ list: Effect.Effect<ReadonlyArray<Note>, NoteStoreError> }>
>()('template/backend/NoteStore') {}
```

The context imports `effect` and its own files. It does not import D1.

### 3. Implement the adapter

Start with a structural SQL type so a `D1Database` and a test database both fit:

```ts
// apps/backend/src/platform/sql.ts
export type SqlRunner = Readonly<{
  prepare: (query: string) => Readonly<{
    all: <T>() => Promise<Readonly<{ results: ReadonlyArray<T> }>>
  }>
}>
```

```ts
// apps/backend/src/platform/d1-note-store.ts
import * as Effect from 'effect/Effect'
import { NoteStore, NoteStoreError, type Note } from '../contexts/notes/store.ts'
import type { SqlRunner } from './sql.ts'

export const d1NoteStore = (db: SqlRunner): NoteStore['Service'] => ({
  list: Effect.tryPromise({
    try: () => db.prepare('SELECT id, body FROM notes ORDER BY id').all<Note>(),
    catch: (cause) => new NoteStoreError({ message: String(cause) }),
  }).pipe(Effect.map((result) => result.results)),
})
```

### 4. Add the migration

```sql
-- apps/backend/migrations/0001_notes.sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL
);
```

Bind the database in `alchemy.run.ts`:

```ts
const Database = Cloudflare.D1.Database('Database', {
  migrations: './apps/backend/migrations',
})

const ApiWorker = Cloudflare.Worker('Api', {
  main: './apps/backend/src/worker.ts',
  env: { DB: Database },
  // ...
})
```

### 5. Compose it

```ts
// apps/backend/src/contexts/notes/handlers.ts
import * as Effect from 'effect/Effect'
import { NotesRpc } from '@template/rpc'
import { NoteStore } from './store.ts'

export const NotesHandlers = NotesRpc.toLayer(
  Effect.gen(function* () {
    const store = yield* NoteStore
    return NotesRpc.of({
      notesList: () => store.list,
    })
  }),
)
```

`handler.ts` takes the binding, supplies the store, and merges the handler
layers:

```ts
// apps/backend/src/handler.ts
export type HandlerInput = Readonly<{
  system: typeof SystemHandlers
  notes: typeof NotesHandlers
  db: SqlRunner
}>

export const handlerFor = (input: HandlerInput) =>
  HttpRouter.toWebHandler(
    RpcServer.layerHttp({ group: Api, path: RPC_PATH, protocol: 'http' }).pipe(
      Layer.provide(
        Layer.mergeAll(input.system, input.notes).pipe(
          Layer.provide(Layer.succeed(NoteStore, d1NoteStore(input.db))),
        ),
      ),
      Layer.provideMerge(RpcSerialization.layerJson),
      Layer.provide(SentryLive),
    ),
  )
```

Keep the `SentryLive` layer from the starter. The snippet only adds the store
and the notes context.

The Worker builds the handler from its binding and keeps it for the isolate:

```ts
// apps/backend/src/worker.ts
import { NotesHandlers } from './contexts/notes/handlers.ts'
import { SystemHandlers } from './contexts/system/handlers.ts'
import { handlerFor, type HandlerInput } from './handler.ts'

export type Env = Readonly<{ DB: HandlerInput['db'] }>

let built: Readonly<{ db: Env['DB']; handler: ReturnType<typeof handlerFor> }> | undefined

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    if (built?.db !== env.DB) {
      built = {
        db: env.DB,
        handler: handlerFor({
          system: SystemHandlers,
          notes: NotesHandlers,
          db: env.DB,
        }),
      }
    }
    return built.handler.handler(request)
  },
}
```

Import the two handler layers in `worker.ts`, or let `handlerFor` take a
`HandlerInput` built in `entry.ts`. Keep the binding at the edge, and keep the
`Sentry.withSentry` wrapper from the starter around the export.

### 6. Test the store

`apps/backend/src/worker.test.ts` already passes a fake layer to `handlerFor`.
For a store, use `node:sqlite` with the same `SqlRunner` shape, or pass a fake
`NoteStore`:

```ts
const fakeNotes = Layer.succeed(NoteStore, {
  list: Effect.succeed([{ id: '1', body: 'A note' }]),
})
```

Then pass `fakeNotes` as the `NoteStore` layer and call the handler through the
RPC client. The test covers the SQL or the store, the handler, and the wire
shape without a Worker.

## Add a Cloudflare binding without a store

Bindings are declared in `alchemy.run.ts` and typed at the Worker edge. Add the
resource to the Worker's `env`, then add the field to the Worker's `Env` type.
Do not import the binding in a context. If a context needs the data, define a
store interface and implement it in `apps/backend/src/platform`.
