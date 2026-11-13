import { Context, Layer } from 'effect'
import { RpcClient, RpcClientError, RpcSerialization } from 'effect/rpc'
import { Http } from 'foldkit'
import { Api, RPC_PATH } from '@template/rpc'

/**
 * The API Worker's RPC client, reached through the website origin. The
 * `apps/web/tsconfig.json` override allows `effect/rpc` in this folder only,
 * because the client is the one place the browser touches an unstable API.
 */
export class ApiRpc extends Context.Service<
  ApiRpc,
  RpcClient.FromGroup<typeof Api, RpcClientError.RpcClientError>
>()('template/web/ApiRpc') {
  static readonly layer = Layer.effect(ApiRpc, RpcClient.make(Api)).pipe(
    Layer.provide(RpcClient.layerProtocolHttp({ url: RPC_PATH })),
    Layer.provide(RpcSerialization.layerJson),
    Layer.provide(Http.layer),
  )
}
