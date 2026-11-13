# Tooling

| Tool                       | Owns                                                                          |
| -------------------------- | ----------------------------------------------------------------------------- |
| pnpm                       | Workspace installation and package linking                                    |
| Turborepo                  | Cached build, typecheck, and test task graph                                  |
| Vite+ (`vp`)               | Root formatting/lint configuration and unified checks                         |
| Oxfmt                      | Formatting engine used by Vite+                                               |
| Oxlint                     | Lint engine used by Vite+                                                     |
| Vite                       | Web app bundler, integrated into Alchemy's website dev/deploy flow            |
| Alchemy                    | Local Cloudflare development and deployment through the root `alchemy.run.ts` |
| Vitest                     | Unit and integration tests                                                    |
| `tsrs`                     | Rust port of the TypeScript 7 compiler; type checks in `pnpm typecheck`       |
| `effect-tsrs`              | Effect diagnostics on `tsrs` and the Effect Oxlint preset                     |
| `@effect/language-service` | Effect diagnostics config and editor support, including `allowedUnstableApis` |
| Sentry                     | Browser and Worker errors, traces, profiles, and hidden source-map upload     |

Use `pnpm check` for the Vite+ checks. Use `pnpm typecheck`, `pnpm test`, and `pnpm build` for Turbo tasks. Do not add standalone Prettier or ESLint configurations alongside Vite+.

Dependencies are pinned to exact versions in workspace manifests and `pnpm-lock.yaml`. Keep Effect on one version across the workspace. The repository targets Node.js 26, which matches CI and `.node-version`. Foldkit Query is experimental, so review its release notes and run the reference tests when upgrading Foldkit.

## TypeScript and unstable Effect APIs

`pnpm typecheck` runs `tsrs --noEmit`, then `effect-tsrs diagnostics --strict`, which reads the `@effect/language-service` plugin entry in each tsconfig. Effect warnings fail the command. Quick fixes, refactors, and completions are editor features that `effect-tsrs` does not provide.

`tsrs` and `effect-tsrs` are the only type checkers. The workspace does not install `typescript`. Do not use `tsc` or `tsgo`.

`vp lint` also runs the Effect rules from the `effect-tsrs` recommended Oxlint preset. The root `prepare` script runs `effect-tsrs patch --oxlint`, which replaces the `oxlint-tsgolint` backend with `effect-tsrs`. `effect-tsrs` sends non-Effect type-aware rules to the original tsgolint binary, so `vite.config.ts` turns those rules off. The `oxlint-tsgolint` override in `pnpm-workspace.yaml` pins the version that `effect-tsrs` supports.

Unstable Effect APIs fail typecheck unless a tsconfig override allows them for named files. Each override lives beside the code that needs it, for example in `apps/backend/tsconfig.json`. See [Guardrails](guardrails.md) for the rule and the current exceptions.

## Common commands

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm dev
pnpm dev:reference
pnpm rename my-app
```

`pnpm deploy` modifies Cloudflare infrastructure. It is not part of routine verification. For a CI deploy, use the manual `Deploy` workflow described in [Deploy](deploy.md).

`pnpm dev:reference` uses the same root entrypoint with the `reference` stage; the default stage selects `apps/web`.

## CI

`.github/workflows/ci.yml` runs each check in its own job and restores `.turbo/cache` for typecheck, test, and build. `.github/workflows/deploy.yml` is manual and runs `alchemy deploy --stage prod --yes`.
