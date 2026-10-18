import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Connect, Plugin, PreviewServer, ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

function attachPatientDataCacheHeaders(server: ViteDevServer | PreviewServer) {
  const middleware: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? ''
    if (url.startsWith('/data/') && url.includes('.glb')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    }
    next()
  }
  server.middlewares.use(middleware)
}

/** Long-cache headers for static patient GLBs (bytes unchanged; URL is the cache key). */
function patientDataCacheHeaders(): Plugin {
  return {
    name: 'patient-data-cache-headers',
    configureServer: attachPatientDataCacheHeaders,
    configurePreviewServer: attachPatientDataCacheHeaders,
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), patientDataCacheHeaders()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
})
