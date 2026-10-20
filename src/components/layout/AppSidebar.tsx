import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NAV_SECTIONS } from '@/config/navigation'
import { MOTIVATIONS } from '@/config/navigation'
import { Logo } from '@/components/layout/Logo'
import { Mascot } from '@/components/mascots/Mascot'
import { Decoration } from '@/components/mascots/Mascot'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useApp } from '@/app/AppContext'

const STORAGE_KEY = 'adt.sidebarCollapsed'

interface AppSidebarProps {
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function AppSidebar({ mobileOpen, onCloseMobile }: AppSidebarProps) {
  const { settings } = useApp()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      // Preference persistence is best-effort.
    }
  }, [collapsed])

  const motivation = MOTIVATIONS[new Date().getDate() % MOTIVATIONS.length]
  const mascot = settings.mascot === 'cat' ? 'cat' : 'bunny'

  return (
    <>
      {/* Mobile scrim */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-[var(--overlay)] transition-opacity lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onCloseMobile}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[var(--line)] bg-[var(--surface)] pl-[var(--safe-left)] transition-[transform,width] duration-300 ease-out',
          collapsed ? 'lg:w-[76px]' : 'lg:w-[264px]',
          'w-[272px] lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center gap-2.5 px-4 pt-[calc(1rem+var(--safe-top))] pb-4">
          <Logo className="size-9" />
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="font-display truncate text-[0.95rem] leading-tight font-bold text-[var(--fg)]">
                Anusree&rsquo;s
              </p>
              <p className="font-display truncate text-[0.95rem] leading-tight font-bold text-[var(--accent-ink)]">
                Daily Tracker
              </p>
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto hidden lg:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="ml-auto lg:hidden"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <ChevronLeft />
          </Button>
        </div>

        <nav className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-2.5 pb-[calc(0.5rem+var(--safe-bottom))]">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-3">
              {!collapsed ? (
                <p className="mb-1.5 px-2.5 text-[0.62rem] font-bold tracking-[0.14em] text-[var(--fg-subtle)] uppercase">
                  {section.title}
                </p>
              ) : (
                <div className="mx-2.5 mb-2 h-px bg-[var(--line)]" />
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active =
                    item.to === '/'
                      ? location.pathname === '/'
                      : location.pathname.startsWith(item.to)
                  const Icon = item.icon
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={onCloseMobile}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          'group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-colors',
                          active
                            ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                            : 'text-[var(--fg-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]',
                          collapsed && 'justify-center px-0',
                        )}
                        aria-current={active ? 'page' : undefined}
                      >
                        {active ? (
                          <span className="absolute top-1/2 left-0 h-4.5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--accent)]" />
                        ) : null}
                        <Icon className="size-4.5 shrink-0" />
                        {!collapsed ? <span className="truncate">{item.label}</span> : null}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--line)] p-3">
          {collapsed ? (
            <Mascot kind={mascot} className="mx-auto size-11" />
          ) : (
            <div className="relative overflow-hidden rounded-2xl bg-[var(--surface-3)] p-3">
              <Decoration
                kind="star"
                className="absolute animate-twinkle text-[var(--color-warning)] opacity-70"
                style={{ top: 8, right: 10, width: 12, height: 12 }}
              />
              <div className="flex items-start gap-2.5">
                <Mascot kind={mascot} className="size-12 shrink-0" animate />
                <div className="min-w-0">
                  <p className="font-hand text-[0.95rem] leading-snug text-[var(--accent-ink)]">
                    {motivation}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
