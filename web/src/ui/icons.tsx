// Small inline icons in the spirit of SF Symbols.
type Props = { size?: number; class?: string }

const svg = (size: number, cls: string | undefined, children: preact.ComponentChildren, viewBox = '0 0 24 24') => (
  <svg width={size} height={size} viewBox={viewBox} class={cls} aria-hidden="true" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    {children}
  </svg>
)

export const SearchIcon = ({ size = 18, class: c }: Props) =>
  svg(size, c, <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 20 20" /></>)

export const ClearIcon = ({ size = 18, class: c }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" class={c} aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#000" stroke-width="2" stroke-linecap="round" />
  </svg>
)

export const BackIcon = ({ size = 22, class: c }: Props) => svg(size, c, <path d="M15 5l-7 7 7 7" />)

export const ChevronIcon = ({ size = 14, class: c }: Props) => svg(size, c, <path d="M9 5l7 7-7 7" />)

export const BooksIcon = ({ size = 22, class: c }: Props) =>
  svg(size, c, <>
    <rect x="3.5" y="4" width="4" height="16" rx="1" />
    <rect x="9.5" y="4" width="4" height="16" rx="1" />
    <path d="M15.6 5.2l3.7-1 3 15.4-3.7 1z" />
    <path d="M3.5 8h4M9.5 8h4M3.5 16h4M9.5 16h4" />
  </>)

export const BookIcon = ({ size = 48, class: c }: Props) =>
  svg(size, c, <>
    <path d="M6 3.5h11.5a1 1 0 0 1 1 1v13H7a2 2 0 0 0-2 2v-14a2 2 0 0 1 1-2z" />
    <path d="M5 19.5a2 2 0 0 0 2 2h11.5v-4" />
    <path d="M9.2 14l2.6-7 2.6 7M10.2 11.6h3.2" />
  </>, '0 0 24 24')

export const PlayIcon = ({ size = 12, class: c }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" class={c} aria-hidden="true">
    <path d="M6 3.8v16.4a1 1 0 0 0 1.5.86l13.8-8.2a1 1 0 0 0 0-1.72L7.5 2.94A1 1 0 0 0 6 3.8z" fill="currentColor" />
  </svg>
)

export const SpeakerIcon = ({ size = 14, class: c }: Props) =>
  svg(size, c, <>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />
  </>)

export const WarningIcon = ({ size = 14, class: c }: Props) =>
  svg(size, c, <><path d="M12 3.5 2.5 20h19z" /><path d="M12 10v4.5M12 17.5v.01" /></>)

export const LinkArrowIcon = ({ size = 16, class: c }: Props) =>
  svg(size, c, <>
    <path d="M10 14 19 5M13 5h6v6" />
    <path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </>)

export const TurnRightIcon = ({ size = 16, class: c }: Props) =>
  svg(size, c, <><path d="M5 5v6a3 3 0 0 0 3 3h11" /><path d="M15 10l4 4-4 4" /></>)

export const CheckCircleIcon = ({ size = 24, class: c }: Props) => (
  <svg width={size} height={size} viewBox="0 0 24 24" class={c} aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <path d="M7.5 12.5l3 3 6-6.5" stroke="#000" stroke-width="2.2" fill="none" stroke-linecap="round"
      stroke-linejoin="round" />
  </svg>
)
