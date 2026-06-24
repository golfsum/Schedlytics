import { useState, useEffect, useCallback, useRef } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import CalendarView from './components/CalendarView'
import InsightsView from './components/InsightsView'
import MediaStudioView from './components/MediaStudioView'
import DashboardView from './components/DashboardView'
import CampaignsView from './components/CampaignsView'
import SettingsView from './components/SettingsView'
import NewPostPanel from './components/NewPostPanel'
import EditPostModal from './components/EditPostModal'
import PostDetailDrawer from './components/PostDetailDrawer'
import UpgradeModal from './components/UpgradeModal'
import LinkToolsView from './components/LinkTools'
import InboxView from './components/InboxView'
import AdminView from './components/AdminView'
import { useToast } from './components/Toast'
import { useAuth } from './components/Auth'
import { useSeededState } from './lib/usePersisted'
import { demoMode } from './lib/socialApi'
import { fetchAdminMe } from './lib/admin'
import { INITIAL_POSTS } from './data'
import type { CalendarPost, NavId } from './types'

export default function App() {
  const { addToast } = useToast()
  const { user } = useAuth()
  const [nav, setNav] = useState<NavId>(
    () => (window.history.state?.slNav as NavId) || 'calendar',
  )

  // Keep in-app navigation in the browser history so Back/Forward move between
  // views inside the app instead of leaving it. Each navigate() pushes an entry;
  // popstate restores the view from that entry.
  const navRef = useRef(nav)
  navRef.current = nav
  const navigate = useCallback((id: NavId) => {
    if (id === navRef.current) return
    window.history.pushState({ slNav: id }, '')
    setNav(id)
  }, [])

  useEffect(() => {
    if (window.history.state?.slNav == null) {
      window.history.replaceState({ slNav: navRef.current }, '')
    }
    const onPop = (e: PopStateEvent) => setNav((e.state?.slNav as NavId) || 'calendar')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const [posts, setPosts] = useSeededState<CalendarPost[]>('sl_posts', INITIAL_POSTS, [])
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<CalendarPost | null>(null)
  const [detailPost, setDetailPost] = useState<CalendarPost | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Reveal the Admin item only for allow-listed admins. Re-checks whenever the
  // signed-in user changes so the token request runs after Firebase auth lands.
  useEffect(() => {
    let cancelled = false
    if (!user) {
      setIsAdmin(false)
      return
    }
    fetchAdminMe().then((ok) => {
      if (!cancelled) setIsAdmin(ok)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  /** Append a freshly scheduled post to the calendar grid. */
  const addPost = (post: Omit<CalendarPost, 'id'>) =>
    setPosts((prev) => [...prev, { week: 0, ...post, id: `p${prev.length + 1}-${++idSeq}` }])

  /** Persist edits from the edit modal. */
  const savePost = (updated: CalendarPost) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    setEditingPost(null)
    addToast('Post updated ✏️')
  }

  /** Remove a post from the calendar. */
  const deletePost = (id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id))
    setEditingPost(null)
    addToast('Post removed', 'info')
  }

  // The New Post panel only makes sense alongside the calendar.
  const showPanel = panelOpen && nav === 'calendar'

  return (
    <div className="flex h-screen overflow-hidden bg-navy-900 text-slate-200">
      <Sidebar
        active={nav}
        onNavigate={navigate}
        onUpgrade={() => setUpgradeOpen(true)}
        isAdmin={isAdmin}
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
      />

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onNavigate={navigate}
          onUpgrade={() => setUpgradeOpen(true)}
          posts={posts}
          onMenu={() => setMobileNav(true)}
        />

        {demoMode && (
          <div className="flex items-center gap-2 border-b border-cyan-accent/20 bg-cyan-accent/10 px-4 py-2 text-xs text-cyan-accent sm:px-6">
            <span className="font-semibold">Demo mode</span>
            <span className="text-cyan-accent/80">
              You are exploring with sample data. Connections are simulated and nothing is saved.
            </span>
            <a
              href="/app/"
              className="ml-auto rounded-md border border-cyan-accent/30 px-2.5 py-1 font-semibold hover:bg-cyan-accent/10"
            >
              Exit demo
            </a>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {/* scrollable content */}
          <main className="min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
            {nav === 'calendar' && (
              <CalendarView
                posts={posts}
                setPosts={setPosts}
                onCreateNew={() => setPanelOpen(true)}
                onOpenPost={setDetailPost}
              />
            )}

            {nav === 'media-studio' && (
              <MediaStudioView onSchedule={addPost} onScheduled={() => navigate('calendar')} />
            )}
            {nav === 'campaigns' && <CampaignsView />}
            {nav === 'insights' && <InsightsView />}
            {nav === 'links' && <LinkToolsView />}
            {nav === 'inbox' && <InboxView />}
            {nav === 'settings' && <SettingsView />}
            {nav === 'admin' && isAdmin && <AdminView />}

            {nav === 'dashboard' && (
              <DashboardView
                posts={posts}
                onNavigate={navigate}
                onQuickCreate={() => {
                  navigate('calendar')
                  setPanelOpen(true)
                }}
              />
            )}
          </main>

          {/* right slide-in panel */}
          {showPanel && (
            <div className="w-full max-w-sm shrink-0">
              <NewPostPanel onClose={() => setPanelOpen(false)} onSchedule={addPost} />
            </div>
          )}
        </div>
      </div>

      {/* post detail drawer */}
      {detailPost && (
        <PostDetailDrawer
          post={detailPost}
          onClose={() => setDetailPost(null)}
          onEdit={() => {
            setEditingPost(detailPost)
            setDetailPost(null)
          }}
        />
      )}

      {/* edit-post modal */}
      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSave={savePost}
          onDelete={deletePost}
        />
      )}

      {/* upgrade modal */}
      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
    </div>
  )
}

// Monotonic id source for newly created posts.
let idSeq = 0
