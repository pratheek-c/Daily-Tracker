/**
 * Builds the web bundle, syncs it into the Android project, and runs Gradle.
 *
 * Usage:
 *   node scripts/android-build.mjs [debug|release|bundle]
 *
 *   debug    → android/app/build/outputs/apk/debug/app-debug.apk
 *   release  → android/app/build/outputs/apk/release/app-release-unsigned.apk
 *   bundle   → android/app/build/outputs/bundle/release/app-release.aab
 *
 * Cross-platform on purpose: it picks `gradlew.bat` on Windows and `./gradlew`
 * elsewhere, so `npm run android:build` works from cmd, PowerShell, bash and CI.
 *
 * The Android build needs a JDK and the Android SDK, which are not npm
 * dependencies. This script checks for them up front so the failure is a clear
 * message rather than a wall of Gradle output.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const isWindows = process.platform === 'win32'

const mode = (process.argv[2] ?? 'debug').toLowerCase()
const gradleTask =
  mode === 'release' ? 'assembleRelease' : mode === 'bundle' ? 'bundleRelease' : 'assembleDebug'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: root,
    // Windows resolves `npm`, `npx` and `gradlew.bat` only through a shell.
    shell: isWindows,
    ...options,
  })
  if (result.status !== 0) {
    console.error(`\nCommand failed: ${command} ${args.join(' ')}`)
    process.exit(result.status ?? 1)
  }
}

function hasCommand(command, args) {
  const result = spawnSync(command, args, { stdio: 'ignore', shell: isWindows })
  return result.status === 0
}

/* -- prerequisites --------------------------------------------------------- */
const sdkRoot =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  (isWindows
    ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
    : join(process.env.HOME ?? '', 'Android', 'Sdk'))

if (!hasCommand('java', ['-version'])) {
  console.error(
    [
      'No Java runtime found on PATH — the Android build needs a JDK (17 or newer).',
      'Install Android Studio (which bundles one) or a JDK, then re-run.',
    ].join('\n'),
  )
  process.exit(2)
}

if (!existsSync(sdkRoot)) {
  console.error(
    [
      `Android SDK not found at ${sdkRoot || '(unset)'}.`,
      'Install it through Android Studio → SDK Manager, or point ANDROID_HOME at it.',
    ].join('\n'),
  )
  process.exit(2)
}

/* -- build ----------------------------------------------------------------- */
console.log('› building the web bundle')
run('npm', ['run', 'build'])

console.log('\n› syncing dist/ into the Android project')
run('npx', ['cap', 'sync', 'android'])

console.log(`\n› gradle ${gradleTask}`)
const wrapper = isWindows ? 'gradlew.bat' : './gradlew'
run(wrapper, [gradleTask], { cwd: join(root, 'android') })

const artifact =
  mode === 'release'
    ? join('android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk')
    : mode === 'bundle'
      ? join('android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
      : join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

console.log(`\n✓ done — ${artifact}`)
console.log('  Install on a connected device with: adb install -r ' + artifact)
