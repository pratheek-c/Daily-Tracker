import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Plus, RefreshCw, X } from 'lucide-react'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppHeader } from '@/components/layout/AppHeader'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui'
import { PRIMARY_NAV_ITEMS } from '@/config/navigation'
import { useApp } from '@/app/AppContext'
import { useCloud } from '@/app/CloudContext'
import { useNotificationScheduler } from '@/hooks/useNotifications'
import { AuthPage, PasswordRecoveryPage } from '@/pages/AuthPage'
import { cn } from '@/lib/utils'
import { Mascot } from '@/components/mascots/Mascot'

export function AppShell() {
  const { data, ready, error } = useApp()
  const cloud = useCloud()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [updateReload, setUpdateReload] = useState<(() => void) | null>(null)
  const { pending } = useNotificationScheduler({ enabled: ready })

  /** Surfaced by the PWA registration when a newer build has been downloaded. */
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ reload: () => void }>).detail
      if (detail?.reload) setUpdateReload(() => detail.reload)
    }
    window.addEventListener('adt:update-available', handler)
    return () => window.removeEventListener('adt:update-available', handler)
  }, [])

  const unread = useMemo(
    () => data.notificationLog.filter((entry) => !entry.read).length,
    [data.notificationLog],
  )

  if (!ready) {
    return <BootScreen error={error} />
  }

  /*
   * Sign-in comes first. When cloud auth is configured, the planner is only
   * reachable once there is a session, so the very first screen is the
   * login / sign-up page. A deployment without Supabase credentials keeps
   * working exactly as before — a purely local planner — because there would be
   * nothing to sign in to.
   */
  if (cloud.configured && cloud.status !== 'signed-in') {
    return cloud.status === 'loading' ? <BootScreen error={null} /> : <AuthPage />
  }

  // A password-recovery link signs the user in; ask for the new password first.
  if (cloud.recovering) {
    return <PasswordRecoveryPage />
  }

  return (
    <div className="min-h-dvh bg-[var(--surface-2)]">
      {updateReload ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent-ink)] sm:px-4 lg:px-6">
          <RefreshCw className="size-3.5" />
          <span className="flex-1">
            A newer version of your planner has been downloaded. Reload when you are at a stopping
            point — nothing you have saved will be lost.
          </span>
          <Button size="sm" onClick={() => updateReload()}>
            Reload now
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Dismiss update notice"
            onClick={() => setUpdateReload(null)}
          >
            <X />
          </Button>
        </div>
      ) : null}

      <AppSidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

      {/* Offset matches the sidebar width at each breakpoint. */}
      <div className="lg:pl-[264px]">
        <div className="min-h-dvh">
          <AppHeader
            onOpenMobileNav={() => setMobileNavOpen(true)}
            unreadNotifications={unread}
          />
          <main
            key={location.pathname}
            className="animate-rise mx-auto w-full max-w-[1500px] px-3 pt-4 pb-28 sm:px-4 lg:px-6 lg:pb-8"
          >
            <Outlet />
          </main>
        </div>
      </div>

      <MobileTabBar pending={pending} />

      <Button
        size="icon-lg"
        className="fixed right-4 bottom-20 z-30 shadow-lg lg:hidden"
        onClick={() => setMobileNavOpen(true)}
        aria-label="More navigation"
      >
        <Plus />
      </Button>
    </div>
  )
}

function BootScreen({ error }: { error: string | null }) {
  return (
    <div className="paper-grain grid min-h-dvh place-items-center px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <Logo className="size-16" />
        <Mascot kind="cat-box" className="mt-4 size-32" animate />
        <h1 className="font-display mt-3 text-lg font-bold">Anusree&rsquo;s Daily Tracker</h1>
        {error ? (
          <>
            <p className="mt-2 text-sm text-[#C2545F]">Local storage could not be opened.</p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">{error}</p>
            <p className="mt-2 text-xs text-[var(--fg-subtle)]">
              Private browsing and blocked site data can prevent IndexedDB from opening. Allow site
              data for this page, then reload.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--fg-muted)]">Opening your planner…</p>
        )}
      </div>
    </div>
  )
}

function MobileTabBar({ pending }: { pending: number }) {
  const items = PRIMARY_NAV_ITEMS.slice(0, 5)
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--surface)]/96 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Primary"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 px-1 py-2.5 text-[0.62rem] font-semibold transition-colors',
                    isActive ? 'text-[var(--accent-ink)]' : 'text-[var(--fg-muted)]',
                  )
                }
                end={item.to === '/'}
              >
                <Icon className="size-5" />
                <span className="truncate">{item.label.split(' ')[0]}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
      {pending > 0 ? (
        <span className="sr-only">{pending} reminders queued</span>
      ) : null}
    </nav>
  )
}
