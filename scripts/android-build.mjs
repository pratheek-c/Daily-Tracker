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
 * Two things make this work on a machine that has not been set up by hand:
 *
 *   1. It finds the Android SDK (env var, `android/local.properties`, or the
 *      default install location) and exports it for Gradle.
 *   2. It finds a JDK to *run* Gradle. Capacitor 8 needs a Java 21 *toolchain*
 *      for compilation, which Gradle provisions itself via the Foojay resolver
 *      in `android/settings.gradle` — so the daemon only has to be a JDK Gradle
 *      supports (17–24), even when no JDK 21 is installed.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const isWindows = process.platform === 'win32'

const mode = (process.argv[2] ?? 'debug').toLowerCase()
const gradleTask =
  mode === 'release' ? 'assembleRelease' : mode === 'bundle' ? 'bundleRelease' : 'assembleDebug'

function run(command, args, options = {}) {
  const base = { stdio: 'inherit', cwd: root, ...options }
  // On Windows `npm`, `npx` and `gradlew` are `.cmd`/`.bat` shims, which need a
  // shell. The whole line is joined into one string because passing an argument
  // array together with `shell: true` triggers a Node deprecation warning. No
  // argument here contains a space, so joining is safe.
  const result = isWindows
    ? spawnSync([command, ...args].join(' '), { ...base, shell: true })
    : spawnSync(command, args, base)
  if (result.status !== 0) {
    console.error(`\nCommand failed: ${command} ${args.join(' ')}`)
    process.exit(result.status ?? 1)
  }
}

/** `java -version` reports the major version on stderr (e.g. `version "17.0.12"`). */
function javaMajor(javaHome) {
  const exe = join(javaHome, 'bin', isWindows ? 'java.exe' : 'java')
  if (!existsSync(exe)) return null
  const result = spawnSync(exe, ['-version'], { encoding: 'utf8' })
  const output = `${result.stderr ?? ''}${result.stdout ?? ''}`
  const match = output.match(/version "(\d+)/)
  return match ? Number(match[1]) : null
}

/** Every plausible JDK location, in the order we would like to try them. */
function javaCandidates() {
  const candidates = []
  if (process.env.JAVA_HOME) candidates.push(process.env.JAVA_HOME)

  if (isWindows) {
    candidates.push(
      'C:\\Program Files\\Android\\Android Studio\\jbr',
      'C:\\Program Files\\Android\\Android Studio Preview\\jbr',
    )
    const home = process.env.USERPROFILE ?? process.env.HOME ?? ''
    const bases = [
      'C:\\Program Files\\Java',
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\Microsoft',
      'C:\\Program Files\\Amazon Corretto',
      join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Eclipse Adoptium'),
      // JDKs downloaded by hand or by IntelliJ land in these; the archive often
      // extracts one level deeper (jdk-17.0.12_windows-x64_bin/jdk-17.0.12).
      join(home, 'Downloads'),
      join(home, '.jdks'),
    ]
    const looksLikeJdk = /jdk|java|temurin|zulu|corretto|graal/i
    for (const base of bases) {
      if (!existsSync(base)) continue
      let entries = []
      try {
        entries = readdirSync(base)
      } catch {
        continue // unreadable directory — skip it
      }
      for (const entry of entries) {
        const top = join(base, entry)
        if (looksLikeJdk.test(entry)) candidates.push(top)
        try {
          for (const nested of readdirSync(top)) {
            if (looksLikeJdk.test(nested)) candidates.push(join(top, nested))
          }
        } catch {
          // Not a directory / no permission — fine.
        }
      }
    }
  } else {
    candidates.push('/usr/lib/jvm/temurin-21-jdk-amd64', '/usr/lib/jvm/java-21-openjdk-amd64')
  }

  return candidates
}

/**
 * Pick the JDK to run Gradle with. A 21 is ideal (nothing needs downloading);
 * otherwise any Gradle-supported version works, since the Java 21 *toolchain*
 * is provisioned separately.
 */
function findJavaHome() {
  const seen = new Set()
  const scored = []
  for (const home of javaCandidates()) {
    if (!home || seen.has(home)) continue
    seen.add(home)
    const major = javaMajor(home)
    if (major === null) continue
    scored.push({ home, major })
  }

  const exact = scored.find((entry) => entry.major === 21)
  if (exact) return exact

  const gradleSupported = scored.find((entry) => entry.major >= 17 && entry.major <= 24)
  if (gradleSupported) return gradleSupported

  return scored[0] ?? null
}

function findAndroidSdk() {
  for (const fromEnv of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]) {
    if (fromEnv && existsSync(fromEnv)) return fromEnv
  }

  const localProperties = join(root, 'android', 'local.properties')
  if (existsSync(localProperties)) {
    const match = readFileSync(localProperties, 'utf8').match(/^sdk\.dir=(.+)$/m)
    if (match) {
      const dir = match[1].trim().replace(/\\\\/g, '\\')
      if (existsSync(dir)) return dir
    }
  }

  const fallback = isWindows
    ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
    : join(process.env.HOME ?? '', 'Android', 'Sdk')
  return existsSync(fallback) ? fallback : null
}

/* -- preflight ------------------------------------------------------------- */
const java = findJavaHome()
if (!java) {
  console.error(
    [
      'No JDK found. Gradle needs one to run, and Capacitor 8 compiles Java 21.',
      'Install Android Studio (bundles a JDK) or a JDK 17+, then re-run.',
    ].join('\n'),
  )
  process.exit(2)
}

const sdk = findAndroidSdk()
if (!sdk) {
  console.error(
    [
      'Android SDK not found.',
      'Install it through Android Studio → SDK Manager, or set ANDROID_HOME to its location.',
    ].join('\n'),
  )
  process.exit(2)
}

console.log(`› JDK for Gradle : ${java.home} (Java ${java.major})`)
console.log(`› Android SDK    : ${sdk}`)
if (java.major !== 21) {
  console.log('  (Java 21 is provisioned automatically for compilation via the Foojay resolver)')
}

const gradleEnv = {
  ...process.env,
  JAVA_HOME: java.home,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
  PATH: `${join(java.home, 'bin')}${isWindows ? ';' : ':'}${process.env.PATH ?? ''}`,
}

/* -- build ----------------------------------------------------------------- */
console.log('\n› building the web bundle')
run('npm', ['run', 'build'], { env: gradleEnv })

console.log('\n› syncing dist/ into the Android project')
run('npx', ['cap', 'sync', 'android'], { env: gradleEnv })

/**
 * Drop the empty `.gitkeep` placeholders inside the generated Cordova plugins
 * folder. When the project lives under OneDrive they can become cloud-only
 * reparse points, and Gradle then fails with “not a regular file” while
 * snapshotting inputs. They keep empty directories in git and nothing else, and
 * the folder is regenerated on every sync, so removing them is safe.
 */
function removeCloudPlaceholders(base) {
  if (!existsSync(base)) return 0
  let removed = 0
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const full = join(base, entry.name)
    if (entry.isDirectory()) removed += removeCloudPlaceholders(full)
    else if (entry.name === '.gitkeep') {
      rmSync(full, { force: true })
      removed += 1
    }
  }
  return removed
}

const placeholders = removeCloudPlaceholders(join(root, 'android', 'capacitor-cordova-android-plugins'))
if (placeholders > 0) console.log(`  removed ${placeholders} cloud-placeholder file(s) that Gradle cannot snapshot`)

console.log(`\n› gradle ${gradleTask}`)
const wrapper = isWindows ? 'gradlew.bat' : './gradlew'
run(wrapper, [gradleTask], { cwd: join(root, 'android'), env: gradleEnv })

const artifact =
  mode === 'release'
    ? join('android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk')
    : mode === 'bundle'
      ? join('android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
      : join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')

console.log(`\n✓ done — ${artifact}`)
console.log(`  Install on a connected device with: adb install -r ${artifact}`)
