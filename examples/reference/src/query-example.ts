import * as Effect from 'effect/Effect'
import { Schema } from 'effect'
import { AsyncData, Update } from 'foldkit'
import type { Document, HtmlBuilder } from 'foldkit/html'
import { Query } from 'foldkit/experimental'
import { defineMessageUnion } from 'foldkit/message'
import { ApiRpc } from './platform/rpc.ts'

export const statusQuery = Query.define({
  name: 'SystemStatus',
  data: Schema.Struct({ message: Schema.String }),
  error: Schema.String,
  execute: Effect.gen(function* () {
    const rpc = yield* ApiRpc
    return yield* rpc.systemStatusGet().pipe(Effect.mapError(String))
  }),
})

export const Model = Schema.Struct({ status: statusQuery.Model })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  GotStatusMessage: { message: statusQuery.Message },
})
export type Message = typeof Message.Type

const status = statusQuery.lift<Model, Message>({
  parentField: 'status',
  toParentMessage: (message) => Message.GotStatusMessage({ message }),
})

export const init = () => {
  const model = Model.make({ status: statusQuery.init() })
  return status.loadIfMissing(model)
}

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    GotStatusMessage: ({ message: childMessage }) => status.fold(model, childMessage),
  })

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const data = statusQuery.read(model.status)

  return {
    title: 'Reference · Foldkit Query',
    body: h.main(
      [h.Class('page')],
      [
        h.p([h.Class('eyebrow')], ['REFERENCE EXAMPLE']),
        h.h1([], ['Foldkit Query + Effect RPC']),
        h.p(
          [h.Class('description')],
          [
            'This separate app demonstrates the shared RPC contract, API Worker, and a retained Query.',
          ],
        ),
        h.section(
          [h.Class('card'), h.AriaLabel('API response')],
          [
            h.h2([], ['API Worker']),
            AsyncData.matchData(data, {
              onEmpty: () => h.p([], ['Loading API status…']),
              onFailure: (error) => h.p([h.Class('error')], [error]),
              onData: ({ message }) => h.p([], [message]),
            }),
          ],
        ),
      ],
    ),
  }
}
