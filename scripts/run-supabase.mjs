/**
 * Runs the Supabase CLI with output captured to a file.
 *
 * The CLI ships as a Bun-compiled launcher plus a Go binary, and it writes its
 * config to the user profile by default. In a restricted environment the launcher
 * cannot create that directory and piped stdio is unavailable, so this helper:
 *
 *   - invokes the Go binary directly (the launcher only forwards to it),
 *   - redirects stdout/stderr through file descriptors instead of pipes,
 *   - points `HOME` / `USERPROFILE` at a workspace-local directory so the CLI's
 *     config and token storage stay inside the project.
 *
 * Usage: node scripts/run-supabase.mjs <config-dir> -- <args…>
 */
import { spawnSync } from 'node:child_process'
import { existsSync, openSync, closeSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'

const [configDirArg, separator, ...args] = process.argv.slice(2)
if (!configDirArg || separator !== '--') {
  console.error('Usage: node scripts/run-supabase.mjs <config-dir> -- <args…>')
  process.exit(2)
}

const configDir = resolve(configDirArg)
mkdirSync(configDir, { recursive: true })
mkdirSync(join(configDir, 'tmp'), { recursive: true })

const require = createRequire(import.meta.url)
const packageDir = dirname(require.resolve('@supabase/cli-windows-x64/package.json'))
const binary = join(packageDir, 'bin', 'supabase.exe')
if (!existsSync(binary)) {
  console.error(`Supabase CLI binary not found at ${binary}`)
  process.exit(2)
}

const outPath = join(configDir, 'cli-out.txt')
const errPath = join(configDir, 'cli-err.txt')
for (const path of [outPath, errPath]) {
  if (existsSync(path)) rmSync(path)
}

const outFd = openSync(outPath, 'w')
const errFd = openSync(errPath, 'w')

const result = spawnSync(binary, args, {
  // File descriptors, not pipes: the sandbox permits fd redirection to files.
  stdio: ['ignore', outFd, errFd],
  env: {
    ...process.env,
    // Keep the CLI's config and access token inside the project.
    HOME: configDir,
    USERPROFILE: configDir,
    APPDATA: configDir,
    LOCALAPPDATA: configDir,
    XDG_CONFIG_HOME: configDir,
    TMPDIR: join(configDir, 'tmp'),
    TMP: join(configDir, 'tmp'),
    TEMP: join(configDir, 'tmp'),
  },
  windowsHide: true,
})

closeSync(outFd)
closeSync(errFd)

const stdout = readFileSync(outPath, 'utf8')
const stderr = readFileSync(errPath, 'utf8')

if (stdout.trim()) console.log(stdout.trimEnd())
if (stderr.trim()) console.error(stderr.trimEnd())
console.log(`\n[exit ${result.status ?? 'null'}]`)
process.exit(result.status ?? 1)
