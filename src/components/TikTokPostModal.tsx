import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, Globe, Users, UserCheck, Lock, AlertCircle } from 'lucide-react'
import Toggle from './Toggle'
import { fetchTikTokCreatorInfo, type TikTokCreatorInfo } from '../lib/socialApi'

export interface TikTokPostSettings {
  privacyLevel: string
  disableComment: boolean
  disableDuet: boolean
  disableStitch: boolean
}

const PRIVACY_META: Record<string, { label: string; Icon: typeof Globe }> = {
  PUBLIC_TO_EVERYONE: { label: 'Public', Icon: Globe },
  MUTUAL_FOLLOW_FRIENDS: { label: 'Friends', Icon: Users },
  FOLLOWER_OF_CREATOR: { label: 'Followers', Icon: UserCheck },
  SELF_ONLY: { label: 'Only me (Private)', Icon: Lock },
}

/**
 * TikTok pre-post confirmation. Required by TikTok's Content Posting UX
 * guidelines: the creator must see their post, explicitly choose a privacy
 * level (we never default-select one), and control comment/duet/stitch before
 * we send it to the Content Posting API. Options come from the creator_info
 * query so we only show what TikTok actually allows for this account.
 */
export default function TikTokPostModal({
  videoPreview,
  caption,
  onConfirm,
  onClose,
}: {
  videoPreview?: string
  caption: string
  onConfirm: (settings: TikTokPostSettings) => void
  onClose: () => void
}) {
  const [info, setInfo] = useState<TikTokCreatorInfo | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [privacy, setPrivacy] = useState<string>('') // empty = nothing chosen yet
  const [allowComment, setAllowComment] = useState(true)
  const [allowDuet, setAllowDuet] = useState(true)
  const [allowStitch, setAllowStitch] = useState(true)

  useEffect(() => {
    fetchTikTokCreatorInfo()
      .then(setInfo)
      .catch((e) => setLoadErr(e instanceof Error ? e.message : String(e)))
  }, [])

  const options = info?.privacyOptions?.length ? info.privacyOptions : ['SELF_ONLY']

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div className="absolute inset-0 bg-navy-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-slide-in-up rounded-2xl border border-white/10 bg-navy-800 p-6 shadow-panel">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-lg font-bold text-white">Post to TikTok</h2>
        <p className="mt-1 text-sm text-slate-400">Review your post and choose who can see it.</p>

        {loadErr ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Couldn't load your TikTok posting options ({loadErr}). Make sure TikTok is connected and try again.</span>
          </div>
        ) : !info ? (
          <div className="mt-6 grid place-items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-accent" />
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* who is posting + preview */}
            <div className="flex gap-3 rounded-xl border border-white/5 bg-navy-900/50 p-3">
              {videoPreview && (
                <video src={videoPreview} muted className="h-24 w-16 shrink-0 rounded-lg object-cover" />
              )}
              <div className="min-w-0">
                {info.creatorNickname && (
                  <div className="text-sm font-semibold text-white">
                    {info.creatorNickname}
                    {info.creatorUsername && <span className="ml-1 font-normal text-slate-500">@{info.creatorUsername}</span>}
                  </div>
                )}
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs text-slate-300">
                  {caption || <span className="text-slate-500">No caption</span>}
                </p>
              </div>
            </div>

            {/* privacy - must be explicitly chosen */}
            <div>
              <div className="mb-2 text-sm font-semibold text-white">Who can view this video</div>
              <div className="grid grid-cols-2 gap-2">
                {options.map((opt) => {
                  const meta = PRIVACY_META[opt] || { label: opt, Icon: Globe }
                  const on = privacy === opt
                  return (
                    <button
                      key={opt}
                      onClick={() => setPrivacy(opt)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                        on
                          ? 'border-cyan-accent/40 bg-cyan-accent/10 text-white'
                          : 'border-white/10 bg-navy-900/60 text-slate-300 hover:text-white'
                      }`}
                    >
                      <meta.Icon className={`h-4 w-4 ${on ? 'text-cyan-accent' : ''}`} />
                      {meta.label}
                    </button>
                  )
                })}
              </div>
              {options.length === 1 && options[0] === 'SELF_ONLY' && (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Only private posting is available until TikTok approves the app for public posting.
                </p>
              )}
            </div>

            {/* interaction settings */}
            <div className="space-y-2.5">
              <InteractionRow
                label="Allow comments"
                checked={allowComment}
                disabled={info.commentDisabled}
                onChange={setAllowComment}
              />
              <InteractionRow
                label="Allow Duet"
                checked={allowDuet}
                disabled={info.duetDisabled}
                onChange={setAllowDuet}
              />
              <InteractionRow
                label="Allow Stitch"
                checked={allowStitch}
                disabled={info.stitchDisabled}
                onChange={setAllowStitch}
              />
            </div>

            {/* compliance disclosure (required) */}
            <p className="text-[11px] leading-relaxed text-slate-500">
              By posting, you confirm this content follows TikTok's{' '}
              <a
                href="https://www.tiktok.com/community-guidelines"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-accent hover:underline"
              >
                Community Guidelines
              </a>{' '}
              and you agree to TikTok's{' '}
              <a
                href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                target="_blank"
                rel="noreferrer"
                className="text-cyan-accent hover:underline"
              >
                Music Usage Confirmation
              </a>
              .
            </p>

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  onConfirm({
                    privacyLevel: privacy,
                    disableComment: !allowComment,
                    disableDuet: !allowDuet,
                    disableStitch: !allowStitch,
                  })
                }
                disabled={!privacy}
                className="rounded-lg gradient-cyan px-4 py-2 text-sm font-bold text-navy-900 disabled:opacity-50"
                title={!privacy ? 'Choose who can view this video first' : undefined}
              >
                Post to TikTok
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

function InteractionRow({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-navy-900/50 px-3.5 py-2.5">
      <span className={`text-sm font-medium ${disabled ? 'text-slate-500' : 'text-slate-200'}`}>
        {label}
        {disabled && <span className="ml-2 text-[11px] text-slate-500">unavailable for this account</span>}
      </span>
      <Toggle checked={checked && !disabled} onChange={onChange} size="sm" label={label} disabled={disabled} />
    </div>
  )
}
