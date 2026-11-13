import * as HttpRouter from 'effect/http/HttpRouter'
import * as Layer from 'effect/Layer'
import { RpcSerialization, RpcServer } from 'effect/rpc'
import { Api, RPC_PATH } from '@template/rpc'
import { SystemHandlers } from './contexts/system/handlers.ts'

/**
 * The dependencies the RPC surface needs. Each context contributes one handler
 * layer. A store or a host adapter is added here, never imported by a context.
 *
 * The default is the real composition. A test passes a fake layer to replace
 * one context without starting the Worker.
 */
export type HandlerInput = Readonly<{
  system: typeof SystemHandlers
}>

const defaults: HandlerInput = { system: SystemHandlers }

export const handlerFor = (input: HandlerInput = defaults) =>
  HttpRouter.toWebHandler(
    RpcServer.layerHttp({
      group: Api,
      path: RPC_PATH,
      protocol: 'http',
    }).pipe(Layer.provide(input.system), Layer.provideMerge(RpcSerialization.layerJson)),
  )

/** The Worker's handler. Tests build their own with `handlerFor`. */
export const handler = handlerFor()
