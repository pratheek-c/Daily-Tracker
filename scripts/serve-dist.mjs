/**
 * Tiny static file server used to smoke-test a production build.
 *
 * Vite's own `preview` command re-loads the Vite config, which is unavailable in
 * some restricted environments, so this dependency-free alternative serves the
 * `dist` folder exactly as a static host would (including SPA history fallback).
 *
 * Usage: node scripts/serve-dist.mjs [port]
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const port = Number(process.argv[2] ?? 4173)

if (!existsSync(join(root, 'index.html'))) {
  console.error(`No build found at ${root}. Run "npm run build" first.`)
  process.exit(1)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${port}`)
  const requested = decodeURIComponent(url.pathname)
  // Contain the resolved path inside `dist`.
  const candidate = normalize(join(root, requested))

  let filePath = candidate.startsWith(root) && existsSync(candidate) ? candidate : null
  if (filePath && statSync(filePath).isDirectory()) filePath = join(filePath, 'index.html')
  // Single-page-app fallback: unknown paths render the shell.
  if (!filePath) filePath = join(root, 'index.html')

  const body = readFileSync(filePath)
  response.writeHead(200, {
    'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  response.end(body)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`serving ${root} at http://127.0.0.1:${port}`)
})
