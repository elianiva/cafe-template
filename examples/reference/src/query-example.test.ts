import { AsyncData } from 'foldkit'
import * as Effect from 'effect/Effect'
import { expect, test } from 'vitest'
import { ApiRpc } from './platform/rpc.ts'
import { statusQuery } from './query-example.ts'

test('the reference Query starts empty before its first request', () => {
  const status = statusQuery.read(statusQuery.init())

  expect(
    AsyncData.matchData(status, {
      onEmpty: () => 'empty',
      onFailure: () => 'failure',
      onData: () => 'data',
    }),
  ).toBe('empty')
})

test('the reference Query maps an RPC answer into its data', async () => {
  const fake = {
    systemStatusGet: () => Effect.succeed({ message: 'From the fake RPC.' }),
  }

  const status = await Effect.runPromise(
    statusQuery.run.pipe(Effect.provideService(ApiRpc, fake as never)),
  )

  expect(
    AsyncData.matchData(status, {
      onEmpty: () => 'empty',
      onFailure: () => 'failure',
      onData: ({ message }) => message,
    }),
  ).toBe('From the fake RPC.')
})
