import { useRef, useState, type ReactElement } from 'react'

/**
 * Reusable image picker. Renders a hidden file input and exposes:
 *   - preview: a blob URL for the selected image (or the initial url)
 *   - open():  programmatically open the OS file picker
 *   - input:   the hidden <input> element to drop into the tree
 *
 * Used by the New Post media upload, the Media Studio image box, and the
 * Settings avatar.
 */
export function useImageUpload(
  initial?: string,
  onSelect?: (url: string, file: File) => void,
): { preview: string | undefined; setPreview: (u?: string) => void; open: () => void; input: ReactElement } {
  const [preview, setPreview] = useState<string | undefined>(initial)
  const ref = useRef<HTMLInputElement>(null)

  const open = () => ref.current?.click()

  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const url = URL.createObjectURL(file)
        setPreview(url)
        onSelect?.(url, file)
        e.target.value = '' // allow re-selecting the same file
      }}
    />
  )

  return { preview, setPreview, open, input }
}
