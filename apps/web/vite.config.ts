import { foldkit } from '@foldkit/vite-plugin'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { defineConfig } from 'vite'

const authToken = process.env.SENTRY_AUTH_TOKEN
const org = process.env.SENTRY_ORG
const project = process.env.SENTRY_PROJECT
const release = process.env.VITE_SENTRY_RELEASE
const uploads = authToken !== undefined && org !== undefined && project !== undefined

export default defineConfig({
  // Source maps go to Sentry only from a build with the upload credentials, and
  // never into the deployed assets: hidden maps carry no link in the bundle.
  build: { sourcemap: uploads ? 'hidden' : false },
  plugins: [
    foldkit(),
    // Last, so it sees the final bundle.
    uploads
      ? sentryVitePlugin({
          authToken,
          org,
          project,
          ...(release ? { release: { name: release } } : {}),
          sourcemaps: {
            assets: ['./dist/**'],
            filesToDeleteAfterUpload: ['./dist/**/*.map'],
          },
        })
      : null,
  ],
  resolve: { dedupe: ['effect', 'foldkit'] },
})
