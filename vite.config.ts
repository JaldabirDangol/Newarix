import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: { external: [/^@sentry\//] },
      // Explicitly route API requests before Nitro's dev asset detection.
      // Browser image requests otherwise skip the TanStack SSR handler.
      routes: { '/api/**': './src/server/nitro-api.ts' },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
