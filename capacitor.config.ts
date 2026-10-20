import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor configuration — one web codebase, two targets.
 *
 * `npm run build` produces the web app in `dist/`. Capacitor copies that same
 * `dist/` into the native Android project (`android/`), so the web build and the
 * Android build can never drift apart: the Android app *is* the web app, wrapped
 * in a WebView.
 *
 * `androidScheme: 'https'` serves the bundle from `https://localhost` inside the
 * WebView. That matters for auth: `@supabase/ssr` stores the session in cookies,
 * and a real https origin lets the WebView keep them (a `file://` or custom
 * scheme origin would not).
 */
const config: CapacitorConfig = {
  appId: 'app.anusree.dailytracker',
  appName: "Anusree's Daily Tracker",
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#FFFAFC',
  },
  plugins: {
    /*
     * Android 15+ (API 35) draws apps edge to edge, so the WebView extends
     * behind the status and navigation bars. Capacitor's SystemBars plugin
     * measures the insets and injects them as `--safe-area-inset-*` custom
     * properties on the root element; the stylesheet turns those into the
     * `--safe-*` tokens the layout uses. `style: "LIGHT"` asks for dark icons
     * on the light app background, and `initialViewportFitValueHint` matches
     * the `viewport-fit=cover` in index.html so the first frame is not laid out
     * twice.
     */
    SystemBars: {
      style: 'LIGHT',
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
  },
}

export default config
