import { useMemo } from 'react'

const COLORS = ['#22d3ee', '#0ea5e9', '#a78bfa', '#34d399', '#f472b6', '#ffffff']

/**
 * A one-shot confetti burst that falls across its positioned parent. Drop it
 * inside a relative/fixed container; it is pointer-events-none so it never
 * blocks clicks.
 */
export default function Confetti({ count = 70 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        duration: 2.2 + Math.random() * 1.6,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.round(Math.random() * 6),
      })),
    [count],
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            top: '-5%',
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            borderRadius: 2,
            animation: `sl-confetti ${p.duration}s linear ${p.delay}s forwards`,
          }}
        />
      ))}
      <style>{`@keyframes sl-confetti{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:.9}}`}</style>
    </div>
  )
}
