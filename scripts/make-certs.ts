// Generates a locally trusted dev certificate (via mkcert) for localhost and
// this machine's current LAN addresses. Re-run when your LAN IP changes.
// Requires `mkcert -install` once beforehand.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { networkInterfaces } from 'node:os'

const lanIps = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal)
  .map((n) => n!.address)

const hosts = ['localhost', '127.0.0.1', '::1', ...lanIps]
mkdirSync('.certs', { recursive: true })
execFileSync('mkcert', ['-cert-file', '.certs/cert.pem', '-key-file', '.certs/key.pem', ...hosts], {
  stdio: 'inherit',
})
console.log(`\nCertificate covers: ${hosts.join(', ')}`)
