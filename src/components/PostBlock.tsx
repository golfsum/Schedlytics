import { GripVertical } from 'lucide-react'
import { PLATFORMS } from '../data'
import type { CalendarPost } from '../types'

interface PostBlockProps {
  post: CalendarPost
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onClick: (post: CalendarPost) => void
  dragging: boolean
}

/** A draggable scheduled-post chip rendered inside a calendar cell. */
export default function PostBlock({
  post,
  onDragStart,
  onDragEnd,
  onClick,
  dragging,
}: PostBlockProps) {
  const platform = PLATFORMS[post.platform]
  const { Icon } = platform

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(post.id)
      }}
      onDragEnd={onDragEnd}
      onClick={() => onClick(post)}
      title={`${platform.name}: ${post.label} (click to edit)`}
      className={`group flex cursor-grab items-center gap-1.5 rounded-lg bg-gradient-to-r ${platform.gradient} px-2 py-1.5 text-white shadow-md transition-all hover:shadow-glow active:cursor-grabbing ${
        dragging ? 'opacity-40' : 'opacity-100'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
      <span className="min-w-0 flex-1 truncate text-xs font-semibold">
        {post.label || platform.name}
      </span>
      <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
    </div>
  )
}
