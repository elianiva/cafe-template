import * as Sentry from '@sentry/browser'
import { SentryEffectTracer } from '@sentry/effect/client'
import { Layer, Option, Tracer } from 'effect'
import { Runtime } from 'foldkit'
import { API_PREFIX } from '@template/rpc'
import type { Message, Model } from '../app/main.ts'

/**
 * Errors, traces, and profiles for the browser. Nothing starts without a DSN,
 * so a clone of the template sends nothing. The Workers continue the browser's
 * trace when it reaches the API.
 */
const DSN = import.meta.env.VITE_SENTRY_DSN
const RELEASE = import.meta.env.VITE_SENTRY_RELEASE

const TRACES_SAMPLE_RATE = 0.1
const PROFILE_SESSION_SAMPLE_RATE = 0.05

export const startSentry = (): void => {
  if (!DSN || !import.meta.env.PROD) return
  Sentry.init({
    dsn: DSN,
    release: RELEASE,
    integrations: [Sentry.browserTracingIntegration(), Sentry.browserProfilingIntegration()],
    tracesSampleRate: TRACES_SAMPLE_RATE,
    profileSessionSampleRate: PROFILE_SESSION_SAMPLE_RATE,
    profileLifecycle: 'trace',
    // Trace headers go to this origin's API only.
    tracePropagationTargets: [`${API_PREFIX}/`],
    initialScope: { tags: { service: 'web' } },
  })
}

/** Foldkit calls this after the runtime stops, before it paints the crash view. */
export const reportCrash = ({ error, message }: Runtime.CrashContext<Model, Message>): void => {
  if (!DSN) return
  Sentry.captureException(error, {
    level: 'fatal',
    tags: {
      message: Option.match(message, { onNone: () => 'none', onSome: (value) => value._tag }),
    },
  })
}

/**
 * Foldkit measures update, view, and patch against a budget and calls this only
 * for a phase over it. A healthy frame costs nothing. The Message tag says which
 * gesture was slow.
 */
export const reportSlow = (context: Runtime.SlowContext<Model, Message>): void => {
  // An `onSlow` callback replaces Foldkit's console warning, so keep it in development.
  if (!import.meta.env.PROD) Runtime.defaultSlowCallback(context as never)
  if (!DSN) return
  const message =
    context._tag === 'Update'
      ? context.message._tag
      : context._tag === 'SubscriptionDependencies'
        ? context.subscriptionKey
        : Option.match(context.message, { onNone: () => 'none', onSome: (value) => value._tag })
  Sentry.metrics.distribution('foldkit.slow_ms', context.durationMs, {
    unit: 'millisecond',
    attributes: { phase: context._tag, message },
  })
}

/** Effect spans become Sentry spans. Without a DSN the layer is empty. */
export const tracerLayer: Layer.Layer<never> = DSN
  ? Layer.succeed(Tracer.Tracer, SentryEffectTracer)
  : Layer.empty
