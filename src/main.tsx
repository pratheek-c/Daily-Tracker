import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { AppProvider } from '@/app/AppContext'
import { CloudProvider } from '@/app/CloudContext'
import { router } from '@/app/router'
import { TooltipProvider } from '@/components/ui/tooltip'
import { registerServiceWorker } from '@/services/pwa'
import '@/styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    {/*
      CloudProvider sits outside AppProvider so the sync engine can observe local
      mutations, but AppProvider never depends on it: with cloud sync
      unconfigured the app is exactly the same local-first planner.
    */}
    <CloudProvider>
      <AppProvider>
        <TooltipProvider delayDuration={300}>
          <RouterProvider router={router} />
        </TooltipProvider>
      </AppProvider>
    </CloudProvider>
  </StrictMode>,
)

// Android's hardware back button: walk the router's history back, fall back to
// the dashboard, and only then hand control back to the OS to close the app.
// Without this listener Capacitor exits on the first press from any screen.
if (Capacitor.isNativePlatform()) {
  void CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      void router.navigate(-1)
      return
    }
    if (router.state.location.pathname !== '/') {
      void router.navigate('/')
      return
    }
    void CapacitorApp.exitApp()
  })
}

// The app works fully offline without this; the service worker only makes it
// installable and keeps the shell available when the network drops. It is
// skipped on native, where the bundle already lives on the device.
registerServiceWorker((reload) => {
  window.dispatchEvent(new CustomEvent('adt:update-available', { detail: { reload } }))
})
