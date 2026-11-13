import * as Sentry from '@sentry/cloudflare'
import { SentryEffectLogger, SentryEffectTracer } from '@sentry/effect'
import { Cause, ErrorReporter, Schema } from 'effect'
import * as HttpRouter from 'effect/http/HttpRouter'
import * as Layer from 'effect/Layer'
import * as Logger from 'effect/Logger'
import * as Tracer from 'effect/Tracer'
import { RpcSerialization, RpcServer } from 'effect/rpc'
import { Api, ApiError, RPC_PATH } from '@template/rpc'
import { SystemHandlers } from './contexts/system/handlers.ts'

/**
 * The bindings the stack gives the API Worker. Sentry is optional: without a DSN
 * the SDK stays off and the Worker still serves the contract.
 */
export type Env = Readonly<{
  SENTRY_DSN?: string
  SENTRY_RELEASE?: string
}>

/**
 * Sentry gets every failure Effect reports except `ApiError`: it is the declared
 * answer to a bad request, not a fault, so it stays out of the issue list. The
 * reporter hands a pretty-printed copy to its callback, so the decision reads the
 * original cause instead.
 */
const declaredAnswer = (cause: Cause.Cause<unknown>): boolean =>
  cause.reasons.every(
    (reason) =>
      Cause.isInterruptReason(reason) ||
      (Cause.isFailReason(reason) && Schema.is(ApiError)(reason.error)),
  )

const SentryErrors = ErrorReporter.layer(
  [
    ErrorReporter.make(({ cause, error }) => {
      if (declaredAnswer(cause)) return
      Sentry.captureException(error)
    }),
  ],
  { mergeWithExisting: true },
)

/** Effect spans become Sentry spans, and Effect logs reach Sentry next to the console. */
const SentryLive = Layer.mergeAll(
  SentryErrors,
  Layer.succeed(Tracer.Tracer, SentryEffectTracer),
  Logger.layer([SentryEffectLogger], { mergeWithExisting: true }),
)

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
    }).pipe(
      Layer.provide(input.system),
      Layer.provideMerge(RpcSerialization.layerJson),
      Layer.provide(SentryLive),
    ),
  )

/** The Worker's handler. Tests build their own with `handlerFor`. */
export const handler = handlerFor()
