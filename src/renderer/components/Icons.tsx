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
