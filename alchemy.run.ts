import * as Alchemy from 'alchemy'
import * as Cloudflare from 'alchemy/Cloudflare'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

const state = Layer.unwrap(
  Effect.gen(function* () {
    const dev = yield* Alchemy.ALCHEMY_DEV.pipe(Effect.orDie)
    return dev ? Alchemy.localState() : Cloudflare.state()
  }),
)

export default Alchemy.Stack(
  'effect-foldkit-template',
  { providers: Cloudflare.providers(), state },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stack.use((stack) => Effect.succeed(stack.stage))
    const ApiWorker = Cloudflare.Worker('Api', {
      main: './apps/backend/src/worker.ts',
      compatibility: { date: '2026-10-08' },
    })
    const Website = Cloudflare.Website.Foldkit('Website', {
      rootDir: stage === 'reference' ? 'examples/reference' : 'apps/web',
      main: 'src/worker.ts',
      env: { API: ApiWorker },
      assets: { runWorkerFirst: ['/api/*'] },
      compatibility: { date: '2026-10-08' },
    })

    yield* ApiWorker
    const website = yield* Website
    return { url: website.url }
  }),
)
