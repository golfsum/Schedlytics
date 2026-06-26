import { AlertCircle } from 'lucide-react'

/**
 * Shown wherever a user can create or publish TikTok content. TikTok is in
 * sandbox during app review, so videos can only post to a Private account until
 * approval. Surfacing this up front avoids the
 * unaudited_client_can_only_post_to_private_accounts error at publish time.
 */
export default function TikTokSandboxNotice({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-200 ${className}`}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        TikTok is in sandbox while our app review is in progress. To publish a video now, your TikTok
        account must be set to Private. Public posting unlocks once TikTok approves the app.
      </span>
    </div>
  )
}
