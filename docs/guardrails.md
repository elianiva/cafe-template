# Guardrails

These are the rules this template enforces, and how each one is checked. Change a
rule and its check in the same commit.

| Concern          | Rule                                                                                                                                                               | Check                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Host isolation   | `apps/backend/src/contexts` must not import Alchemy, Cloudflare, Sentry, or `apps/backend/src/platform`, and must not name Cloudflare global types.                | `apps/backend/src/boundaries.test.ts`                      |
| Browser boundary | Browser modules under `apps/web/src` must not import `apps/backend` or an Alchemy or Cloudflare adapter. The website Worker entry may import `@sentry/cloudflare`. | `apps/backend/src/boundaries.test.ts`                      |
| Wire contract    | Only `packages/rpc` declares RPC groups, schemas, declared errors, and path prefixes.                                                                              | `apps/backend/src/boundaries.test.ts` and architecture     |
| Unstable APIs    | Unstable Effect APIs are allowed only in the files named by a tsconfig override.                                                                                   | `effect-tsrs diagnostics --strict` during `pnpm typecheck` |
| Routing          | The API prefix has one definition.                                                                                                                                 | `packages/rpc/src/paths.ts`, imported by `alchemy.run.ts`  |
| API surface      | The API Worker has no public URL.                                                                                                                                  | `workersDev: false` in `alchemy.run.ts`                    |
| Telemetry        | Only the app edges import Sentry. Contexts use `Effect.withSpan`, Cloudflare traces stay off, and `ApiError` stays out of the issue stream.                        | `apps/backend/src/boundaries.test.ts` and review           |
| Rate limits      | The website Worker limits each IP and fails open when the limiter is missing or down.                                                                              | `apps/web/src/worker.test.ts`                              |
| Dependencies     | Effect has one version. `typescript` is not installed; `tsrs` and `effect-tsrs` are the only type checkers, and Vite+ is the only linter.                          | `package.json`, `pnpm-workspace.yaml`, and review          |
| Deploy           | Deployment changes Cloudflare infrastructure. The deploy workflow is manual and `pnpm deploy` is not part of routine verification.                                 | Review of `.github/workflows/deploy.yml` and `AGENTS.md`   |

## Unstable API allowances

`effect-tsrs` fails typecheck when code calls an Effect API marked
`@stability unstable`. A tsconfig override grants the exception per file. The
backend allows `effect/rpc`, `effect/http`, and `effect/ErrorReporter` in the
composition root, Worker entry, and Worker test:

```json
{
  "include": ["src/handler.ts", "src/worker.ts", "src/worker.test.ts"],
  "options": {
    "allowedUnstableApis": ["effect/rpc", "effect/http", "effect/ErrorReporter"]
  }
}
```

`apps/web` allows `effect/rpc` in `src/platform/**/*.ts` only, where its RPC
client lives. The reference app keeps the same allowance for its own copy.

Add an allowance only when the unstable call is the point of the file, and keep
the pattern narrow. Contexts and UI code have no allowance, so unstable Effect
APIs cannot reach them by accident.

`pnpm install` runs `prepare`, which patches Oxlint with `effect-tsrs`. If
`vp lint` fails after an install that skipped scripts, run:

```sh
pnpm exec effect-tsrs patch --oxlint
```

## Review checklist

Before you call a change done:

- Does the change extend the wire contract instead of starting a second one?
- Does every handler stay free of bindings and platform types?
- Does a context depend on its own store interface instead of importing a platform adapter?
- Does a context stay free of Sentry, D1, and Worker types?
- Does the browser import only `packages/rpc`, never `apps/backend`?
- Does the rate limiter fail open when its binding is missing or throws?
- Does each new endpoint have a test that crosses the RPC path?
- Did you edit an allowlist, and is the new entry as narrow as the code needs?
- Do failures use `ApiError` with `Effect.fail` instead of a thrown value?
- Do `pnpm check`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass?
