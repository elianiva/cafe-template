# Tooling

| Tool         | Owns                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| pnpm         | Workspace installation and package linking                                    |
| Turborepo    | Cached build, typecheck, and test task graph                                  |
| Vite+ (`vp`) | Root formatting/lint configuration and unified checks                         |
| Oxfmt        | Formatting engine used by Vite+                                               |
| Oxlint       | Lint engine used by Vite+                                                     |
| Vite         | Web app bundler, integrated into Alchemy's website dev/deploy flow            |
| Alchemy      | Local Cloudflare development and deployment through the root `alchemy.run.ts` |
| Vitest       | Unit and integration tests                                                    |

Use `pnpm check` for the Vite+ checks. Use `pnpm typecheck`, `pnpm test`, and `pnpm build` for Turbo tasks. Do not add standalone Prettier or ESLint configurations alongside Vite+.

Dependencies are pinned to exact versions in workspace manifests and `pnpm-lock.yaml`. Keep Effect on one version across the workspace. Foldkit Query is experimental, so review its release notes and run the reference tests when upgrading Foldkit.

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
