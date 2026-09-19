import type { SVGProps } from 'react'

/**
 * Small, dependency-free inline icon set (stroke based) so the app ships
 * without an icon library. Each icon accepts standard SVG props.
 */

type IconProps = SVGProps<SVGSVGElement>

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24'
}

export function ChevronLeft(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="18" height="18" {...props}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

export function ChevronRight(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="18" height="18" {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

export function PlusIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="18" height="18" {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function CloseIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="18" height="18" {...props}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

export function CalendarIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="18" height="18" {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

export function CheckIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="14" height="14" {...props}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

export function TrashIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="16" height="16" {...props}>
      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  )
}

export function PanelIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="18" height="18" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16" />
    </svg>
  )
}

export function ClockIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="14" height="14" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

export function NoteIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="14" height="14" {...props}>
      <path d="M4 4h16v12l-4 4H4z" />
      <path d="M8 4v8M16 4v12" />
    </svg>
  )
}

/** Settings gear (cog) outline. */
export function GearIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="14" height="14" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

/** Share (three connected nodes) icon. */
export function ShareIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="14" height="14" {...props}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  )
}

/** Copy-to-clipboard icon. */
export function CopyIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="14" height="14" {...props}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

/** Undo (arrow curving left) icon. */
export function UndoIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="14" height="14" {...props}>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  )
}

/** Download icon for updates. */
export function DownloadIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="14" height="14" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  )
}

/** Palette icon for category editing. */
export function PaletteIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="14" height="14" {...props}>
      <circle cx="13.5" cy="6.5" r=".5" />
      <circle cx="17.5" cy="10.5" r=".5" />
      <circle cx="8.5" cy="7.5" r=".5" />
      <circle cx="6.5" cy="12.5" r=".5" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  )
}

/** Pencil/edit icon. */
export function PencilIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="14" height="14" {...props}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  )
}

/** Upload icon for importing a pairing code. */
export function UploadIcon(props: IconProps): JSX.Element {
  return (
    <svg {...base} width="14" height="14" {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  )
}

