import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import typegpu from 'unplugin-typegpu/vite'
import { defineConfig } from 'vite'

// A locally trusted certificate from `bun run certs` (mkcert), if present.
// Without it, fall back to basic-ssl's self-signed certificate, which
// browsers warn about but still allow.
const hasTrustedCert = existsSync('.certs/cert.pem') && existsSync('.certs/key.pem')

// https://vite.dev/config/
export default defineConfig({
  // typegpu compiles 'use gpu' functions to WGSL-ready ASTs; it must run before React's transform.
  plugins: [typegpu(), react(), ...(hasTrustedCert ? [] : [basicSsl()])],
  server: {
    // Listen on the LAN so a phone can open the printed "Network" URL.
    // HTTPS is required there: getUserMedia only works in a secure context.
    host: true,
    https: hasTrustedCert
      ? { cert: readFileSync('.certs/cert.pem'), key: readFileSync('.certs/key.pem') }
      : undefined,
  },
})
