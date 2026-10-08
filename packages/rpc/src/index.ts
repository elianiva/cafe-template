export { RPC_PATH, SystemRpc, SystemStatus } from './system.ts'
export type { SystemStatus as SystemStatusType } from './system.ts'

import { SystemRpc } from './system.ts'

export class Api extends SystemRpc {}
