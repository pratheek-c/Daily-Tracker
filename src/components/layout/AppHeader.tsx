import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bell,
  BookOpenCheck,
  CalendarHeart,
  ClipboardList,
  Command,
  FolderPlus,
  Menu,
  Moon,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NotificationCenter } from '@/components/notifications/NotificationCenter'
import { SyncStatus } from '@/components/cloud/SyncStatus'
import { EventFormDialog } from '@/components/calendar/EventFormDialog'
import { useApp } from '@/app/AppContext'
import { formatLongDate, greetingForNow } from '@/lib/date'
import { initialsFrom } from '@/lib/utils'
import type { QuickAddKind } from '@/components/layout/quickAddTypes'

interface AppHeaderProps {
  onOpenMobileNav: () => void
  unreadNotifications: number
}

const GREETING_ICONS: Record<string, typeof Sparkles> = {
  'Good morning': Sparkles,
  'Good afternoon': Sparkles,
  'Good evening': Sparkles,
  'Good night': Moon,
  'Still up': Moon,
}

export function AppHeader({ onOpenMobileNav, unreadNotifications }: AppHeaderProps) {
  const { settings, today } = useApp()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  const quickAddParam = searchParams.get('quickAdd') as QuickAddKind | null

  /**
   * A deep-linked `?quickAdd=` is picked up during the first render (not from an
   * effect), and the effect below only cleans the URL up. Menu clicks set the
   * action directly, so no state is ever written synchronously inside an effect.
   */
  const [quickAddState, setQuickAddState] = useState(() => ({
    param: quickAddParam,
    action: quickAddParam,
  }))
  if (quickAddParam !== quickAddState.param) {
    setQuickAddState({ param: quickAddParam, action: quickAddParam })
  }
  const quickAdd = quickAddState.action
  const setQuickAdd = (kind: QuickAddKind | null) =>
    setQuickAddState((current) => ({ ...current, action: kind }))

  useEffect(() => {
    if (!quickAddParam) return
    const next = new URLSearchParams(searchParams)
    next.delete('quickAdd')
    setSearchParams(next, { replace: true })
  }, [quickAddParam, searchParams, setSearchParams])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      if (typing) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'n' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        setQuickAdd('study')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const greeting = greetingForNow()
  const GreetingIcon = GREETING_ICONS[greeting] ?? Sparkles

  const runSearch = () => {
    const term = query.trim()
    if (!term) return
    setSearchOpen(false)
    navigate(`/tasks?q=${encodeURIComponent(term)}`)
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/92 backdrop-blur-md">
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          <Menu />
        </Button>

        <div className="flex min-w-0 items-center gap-2.5">
          <Logo className="size-8 lg:hidden" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-[0.8rem] font-bold text-[var(--fg)] sm:text-sm">
              <GreetingIcon className="size-3.5 text-[var(--accent-ink)]" />
              {greeting}, {settings.displayName.split(' ')[0]}!
              <span className="text-[var(--accent)]">♡</span>
            </p>
            <p className="truncate text-[0.68rem] text-[var(--fg-muted)]">{formatLongDate(today)}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[var(--surface-2)] px-3 py-1.5 text-xs text-[var(--fg-subtle)] transition-colors hover:border-[var(--accent)] hover:text-[var(--fg-muted)] md:flex md:w-56"
            aria-label="Search tasks and events"
          >
            <Search className="size-3.5" />
            <span>Search…</span>
            <kbd className="ml-auto flex items-center gap-0.5 rounded border border-[var(--line-strong)] px-1 py-px font-sans text-[0.6rem]">
              <Command className="size-2.5" />K
            </kbd>
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
          >
            <Search />
          </Button>

          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogContent title="Search your planner" size="sm">
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  runSearch()
                }}
                className="space-y-3"
              >
                <Input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tasks, assignments and notes…"
                  aria-label="Search"
                />
                <p className="text-xs text-[var(--fg-subtle)]">
                  Search runs across your tasks, assignments and project work. Press Enter to open
                  the filtered list.
                </p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSearchOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Search
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <NotificationCenter unread={unreadNotifications} />

          <SyncStatus />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 pl-2.5">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Quick add</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Add to your planner</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setQuickAdd('study')}>
                <BookOpenCheck />
                Study session
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setQuickAdd('project-task')}>
                <FolderPlus />
                Project task
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setQuickAdd('activity')}>
                <ClipboardList />
                Daily activity
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setQuickAdd('assignment')}>
                <CalendarHeart />
                Assignment
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setQuickAdd('habit')}>
                <Sparkles />
                Habit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setQuickAdd('personal')}>
                <CalendarHeart />
                Personal event
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setQuickAdd('sleep')}>
                <Moon />
                Sleep record
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid size-9 place-items-center overflow-hidden rounded-full border border-[var(--line-strong)] bg-[var(--accent-soft)] text-[0.7rem] font-bold text-[var(--accent-ink)] transition-transform hover:scale-105"
                aria-label="Profile and settings"
              >
                {settings.avatarDataUrl ? (
                  <img
                    src={settings.avatarDataUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  initialsFrom(settings.displayName)
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <span className="block truncate">{settings.displayName}</span>
                <span className="block text-[0.65rem] font-normal text-[var(--fg-subtle)]">
                  Local-first account
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/settings')}>
                <SettingsIcon />
                Profile &amp; settings
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate('/analytics')}>
                <Bell />
                Productivity analytics
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <EventFormDialog
        open={quickAdd === 'activity' || quickAdd === 'assignment' || quickAdd === 'personal'}
        onOpenChange={(open) => !open && setQuickAdd(null)}
        defaultCategory={
          quickAdd === 'assignment' ? 'assignment' : quickAdd === 'personal' ? 'personal' : 'study'
        }
      />
      <QuickAddRouter kind={quickAdd} onDone={() => setQuickAdd(null)} />
    </header>
  )
}

/**
 * Quick-add kinds that belong on their own page are routed there with the
 * matching "new item" intent, which keeps one creation form per record type.
 */
function QuickAddRouter({ kind, onDone }: { kind: QuickAddKind | null; onDone: () => void }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!kind) return
    switch (kind) {
      case 'study':
        navigate('/study?new=session')
        break
      case 'project-task':
        navigate('/projects?new=task')
        break
      case 'habit':
        navigate('/habits?new=habit')
        break
      case 'sleep':
        navigate('/sleep?new=session')
        break
      default:
        break
    }
    onDone()
  }, [kind, navigate, onDone])
  return null
}
