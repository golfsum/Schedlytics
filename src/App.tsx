import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import CalendarView from './components/CalendarView'
import AnalyticsView from './components/AnalyticsView'
import DashboardView from './components/DashboardView'
import SettingsView from './components/SettingsView'
import NewPostPanel from './components/NewPostPanel'
import EditPostModal from './components/EditPostModal'
import UpgradeModal from './components/UpgradeModal'
import LinkToolsView from './components/LinkTools'
import InboxView from './components/InboxView'
import { useToast } from './components/Toast'
import { INITIAL_POSTS } from './data'
import type { CalendarPost, NavId } from './types'

export default function App() {
  const { addToast } = useToast()
  const [nav, setNav] = useState<NavId>('calendar')
  const [posts, setPosts] = useState<CalendarPost[]>(INITIAL_POSTS)
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<CalendarPost | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

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
      <Sidebar active={nav} onNavigate={setNav} onUpgrade={() => setUpgradeOpen(true)} />

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onNavigate={setNav} onUpgrade={() => setUpgradeOpen(true)} />

        <div className="flex min-h-0 flex-1">
          {/* scrollable content */}
          <main className="min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
            {nav === 'calendar' && (
              <CalendarView
                posts={posts}
                setPosts={setPosts}
                onCreateNew={() => setPanelOpen(true)}
                onEditPost={setEditingPost}
              />
            )}

            {nav === 'analytics' && <AnalyticsView />}
            {nav === 'link-tools' && <LinkToolsView />}
            {nav === 'inbox' && <InboxView />}
            {nav === 'settings' && <SettingsView />}

            {nav === 'dashboard' && (
              <DashboardView
                posts={posts}
                onNavigate={setNav}
                onQuickCreate={() => {
                  setNav('calendar')
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
