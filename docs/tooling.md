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
| `effect-tsgo`              | Effect-aware TypeScript compiler, patched in after install                    |
| `@effect/language-service` | Effect diagnostics, including per-file `allowedUnstableApis`                  |

Use `pnpm check` for the Vite+ checks. Use `pnpm typecheck`, `pnpm test`, and `pnpm build` for Turbo tasks. Do not add standalone Prettier or ESLint configurations alongside Vite+.

Dependencies are pinned to exact versions in workspace manifests and `pnpm-lock.yaml`. Keep Effect on one version across the workspace. Foldkit Query is experimental, so review its release notes and run the reference tests when upgrading Foldkit.

## TypeScript and unstable Effect APIs

`pnpm install` runs `prepare`, which installs the Git hooks and calls `effect-tsgo patch`. The patch replaces the platform `tsc` binary with an Effect-aware build, so `pnpm typecheck` also reports Effect diagnostics. If the patch does not apply, typecheck still runs on stock TypeScript, but the Effect rules are skipped.

Unstable Effect APIs fail typecheck unless a tsconfig override allows them for named files. Each override lives beside the code that needs it, for example in `apps/backend/tsconfig.json`. See [Guardrails](guardrails.md) for the rule and the current exceptions.

## Common commands

```sh
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm dev
pnpm dev:reference
```

`pnpm deploy` modifies Cloudflare infrastructure. It is not part of routine verification.
`pnpm dev:reference` uses the same root entrypoint with the `reference` stage; the default stage selects `apps/web`.
