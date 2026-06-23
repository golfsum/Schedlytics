import { useState } from 'react'
import { Send, CheckCheck, Circle, RefreshCw, Loader2, ThumbsUp } from 'lucide-react'
import { PLATFORMS } from '../data'
import { useToast } from './Toast'
import { useNotifications } from './Notifications'
import { backendEnabled, replyToYouTubeComment } from '../lib/socialApi'
import { useInbox } from './Inbox'

export default function InboxView() {
  const { addToast } = useToast()
  const { push } = useNotifications()
  const {
    messages,
    selectedId,
    unreadCount,
    loading,
    source,
    ytConnected,
    select,
    markAllRead,
    loadYouTube,
  } = useInbox()
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)

  const selected = messages.find((m) => m.id === selectedId) ?? null

  // Send a reply. Pass `quick` to post a one-tap emoji reaction without touching
  // the typed draft.
  const send = async (quick?: string) => {
    if (!selected || sending) return
    const text = (quick ?? reply).trim()
    if (!text) return

    // Real YouTube comment: post the reply through the Data API.
    if (selected.commentId && backendEnabled) {
      setSending(true)
      try {
        await replyToYouTubeComment(selected.commentId, text)
        addToast(`Reply posted to ${selected.name} on YouTube 📨`)
        if (!quick) setReply('')
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e)
        addToast('Could not post reply. See the bell for details.', 'info', 6000)
        push({ type: 'error', title: 'Reply failed', message: 'Tap to see the full reason', detail })
      } finally {
        setSending(false)
      }
      return
    }

    // Demo / non-YouTube message: optimistic confirmation.
    addToast(`Reply sent to ${selected.name} 📨`)
    if (!quick) setReply('')
  }

  const REACTIONS = ['👍', '❤️', '🔥', '😂', '🙏', '👏']

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white">Inbox</h1>
        {source === 'youtube' && messages.length > 0 && (
          <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300">
            Live YouTube comments
          </span>
        )}
        {unreadCount > 0 && (
          <span className="rounded-full border border-cyan-accent/20 bg-cyan-accent/10 px-3 py-1 text-xs font-semibold text-cyan-accent">
            {unreadCount} unread
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {backendEnabled && ytConnected && (
            <button
              onClick={loadYouTube}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-white/5 bg-navy-800/70 px-3.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-white disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? 'Loading…' : 'Refresh comments'}
            </button>
          )}
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 rounded-lg border border-white/5 bg-navy-800/70 px-3.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:text-white"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* conversation list */}
        <div className="card overflow-hidden">
          <div className="divide-y divide-white/5">
            {messages.map((m) => {
              const p = PLATFORMS[m.platform]
              const { Icon } = p
              const active = m.id === selectedId
              return (
                <button
                  key={m.id}
                  onClick={() => select(m.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                    active ? 'bg-cyan-accent/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img src={m.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br ${p.gradient} ring-2 ring-navy-800`}
                    >
                      <Icon className="h-2.5 w-2.5 text-white" />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{m.name}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-slate-500">{m.time}</span>
                    </div>
                    <p className={`truncate text-xs ${m.unread ? 'text-slate-200' : 'text-slate-500'}`}>
                      {m.text}
                    </p>
                  </div>
                  {m.unread && <Circle className="h-2 w-2 shrink-0 fill-cyan-accent text-cyan-accent" />}
                </button>
              )
            })}
            {messages.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                {loading
                  ? 'Loading…'
                  : ytConnected
                    ? 'No comments yet. New comments on your videos will show up here.'
                    : 'Connect a channel in Settings to see comments and messages here.'}
              </div>
            )}
          </div>
        </div>

        {/* conversation detail */}
        <div className="card flex min-h-[420px] flex-col">
          {selected ? (
            <>
              {/* header */}
              <div className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
                <img src={selected.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                <div>
                  <div className="font-semibold text-white">{selected.name}</div>
                  <div className="text-xs text-slate-500">
                    via {PLATFORMS[selected.platform].name}
                  </div>
                </div>
              </div>

              {/* thread */}
              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div className="flex justify-start">
                  <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-navy-900/70 px-4 py-2.5 text-sm text-slate-200">
                    {selected.text}
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{selected.time} ago</span>
                      {typeof selected.likeCount === 'number' && (
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" /> {selected.likeCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {source === 'demo' && (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-sm gradient-cyan px-4 py-2.5 text-sm font-medium text-navy-900">
                      Thanks for reaching out! 💛
                      <div className="mt-1 text-[10px] text-navy-900/60">just now</div>
                    </div>
                  </div>
                )}
              </div>

              {/* quick emoji reactions (posted as a reply) */}
              <div className="flex items-center gap-1.5 border-t border-white/5 px-4 pt-3">
                <span className="mr-1 text-[11px] font-medium text-slate-500">React:</span>
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => send(emoji)}
                    disabled={sending}
                    title={`Reply with ${emoji}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-lg transition-colors hover:bg-white/5 disabled:opacity-50"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* reply */}
              <div className="flex items-center gap-2 px-4 pb-4 pt-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  disabled={sending}
                  placeholder={`Reply to ${selected.name}…`}
                  className="flex-1 rounded-lg border border-white/5 bg-navy-900/60 px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-accent/40 focus:outline-none focus:ring-2 focus:ring-cyan-accent/20 disabled:opacity-60"
                />
                <button
                  onClick={() => send()}
                  disabled={sending || !reply.trim()}
                  className="flex items-center gap-2 rounded-lg gradient-cyan px-4 py-2.5 text-sm font-bold text-navy-900 transition-transform hover:scale-[1.02] disabled:opacity-60"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sending ? 'Posting…' : 'Send'}
                </button>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-slate-500">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
