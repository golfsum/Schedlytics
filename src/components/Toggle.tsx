interface ToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
  size?: 'sm' | 'md'
  disabled?: boolean
}

/** On-brand cyan toggle switch used across the app. */
export default function Toggle({ checked, onChange, label, size = 'md', disabled }: ToggleProps) {
  const dims =
    size === 'sm'
      ? { track: 'h-5 w-9', knob: 'h-3.5 w-3.5', shift: 'translate-x-4' }
      : { track: 'h-6 w-11', knob: 'h-4 w-4', shift: 'translate-x-5' }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 ${dims.track} items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-accent/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'gradient-cyan' : 'bg-navy-700'
      }`}
    >
      <span
        className={`inline-block ${dims.knob} transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? dims.shift : 'translate-x-1'
        }`}
      />
    </button>
  )
}
