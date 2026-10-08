import { Schema } from 'effect'
import { Rpc, RpcGroup } from 'effect/rpc'

export const SystemStatus = Schema.Struct({
  message: Schema.String,
})
export type SystemStatus = typeof SystemStatus.Type

export class SystemRpc extends RpcGroup.make(
  Rpc.make('systemStatusGet', {
    success: SystemStatus,
    error: Schema.String,
  }),
) {}

export const RPC_PATH = '/api/rpc'
