import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Scope from 'effect/Scope'
import { Schema } from 'effect'
import { FetchHttpClient } from 'effect/http'
import * as HttpRouter from 'effect/http/HttpRouter'
import { Rpc, RpcClient, RpcGroup, RpcSerialization, RpcServer } from 'effect/rpc'
import { expect, test } from 'vitest'
import { Api, ApiError, RPC_PATH, SystemRpc } from '@template/rpc'
import { handler, handlerFor } from './handler.ts'

const url = `http://api.test${RPC_PATH}`

type WebHandler = Readonly<{
  handler: (request: Request) => Promise<Response>
}>

/**
 * Sends an RPC client's HTTP requests straight to a composed handler, so the
 * test covers request encoding, routing, the handler, and error mapping.
 */
const fetchThrough =
  (webHandler: WebHandler): typeof globalThis.fetch =>
  async (input, init) =>
    webHandler.handler(new Request(input, init))

const protocol = RpcClient.layerProtocolHttp({ url }).pipe(
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(FetchHttpClient.layer),
)

const run = <A, E>(
  webHandler: WebHandler,
  effect: Effect.Effect<A, E, RpcClient.Protocol | Scope.Scope>,
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(protocol),
      Effect.provideService(FetchHttpClient.Fetch, fetchThrough(webHandler)),
      Effect.scoped,
    ),
  )

test('the API Worker serves the shared RPC contract over HTTP', async () => {
  const response = await run(
    handler,
    Effect.gen(function* () {
      const client = yield* RpcClient.make(Api)
      return yield* client.systemStatusGet()
    }),
  )

  expect(response).toEqual({ message: 'The API Worker is connected.' })
})

test('the composition root replaces one context with a fake handler layer', async () => {
  const fakeSystem = SystemRpc.toLayer(
    Effect.succeed(
      SystemRpc.of({
        systemStatusGet: () => Effect.succeed({ message: 'From the fake layer.' }),
      }),
    ),
  )

  const response = await run(
    handlerFor({ system: fakeSystem }),
    Effect.gen(function* () {
      const client = yield* RpcClient.make(Api)
      return yield* client.systemStatusGet()
    }),
  )

  expect(response).toEqual({ message: 'From the fake layer.' })
})

test('the API Worker rejects unknown paths', async () => {
  const response = await handler.handler(new Request('http://api.test/unknown', { method: 'POST' }))

  expect(response.status).toBe(404)
})

const failurePath = '/api/failure'

const FailureRpc = RpcGroup.make(
  Rpc.make('failure', {
    success: Schema.Void,
    error: ApiError,
  }),
)

const failureHandler = HttpRouter.toWebHandler(
  RpcServer.layerHttp({
    group: FailureRpc,
    path: failurePath,
    protocol: 'http',
  }).pipe(
    Layer.provide(
      FailureRpc.toLayer(
        Effect.succeed(
          FailureRpc.of({
            failure: () => Effect.fail(new ApiError({ message: 'Declared failure' })),
          }),
        ),
      ),
    ),
    Layer.provideMerge(RpcSerialization.layerJson),
  ),
)

test('a declared ApiError crosses the RPC transport', async () => {
  const failureProtocol = RpcClient.layerProtocolHttp({
    url: `http://api.test${failurePath}`,
  }).pipe(Layer.provide(RpcSerialization.layerJson), Layer.provide(FetchHttpClient.layer))

  const failure = await Effect.runPromise(
    Effect.gen(function* () {
      const client = yield* RpcClient.make(FailureRpc)
      return yield* Effect.flip(client.failure())
    }).pipe(
      Effect.provide(failureProtocol),
      Effect.provideService(FetchHttpClient.Fetch, fetchThrough(failureHandler)),
      Effect.scoped,
    ),
  )

  expect(failure).toMatchObject({ _tag: 'ApiError', message: 'Declared failure' })
})
