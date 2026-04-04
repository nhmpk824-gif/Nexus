import type { SVGProps } from 'react'

export type PetControlIconName =
  | 'chat'
  | 'settings'
  | 'tuning'
  | 'menu'
  | 'pin'
  | 'pointer'
  | 'mic'
  | 'speaker'
  | 'sparkles'
  | 'continuous'
  | 'single-shot'

type PetControlIconProps = SVGProps<SVGSVGElement> & {
  name: PetControlIconName
}

export function PetControlIcon({ name, ...props }: PetControlIconProps) {
  switch (name) {
    case 'chat':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path fill="currentColor" d="M6.5 5A3.5 3.5 0 0 0 3 8.5v5A3.5 3.5 0 0 0 6.5 17H8v3.25a.75.75 0 0 0 1.2.6L13 17h4.5a3.5 3.5 0 0 0 3.5-3.5v-5A3.5 3.5 0 0 0 17.5 5h-11ZM8.5 11a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm3.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Zm3.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z" />
        </svg>
      )
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path fill="currentColor" d="M13.85 3.15a2.5 2.5 0 0 0-3.7 0l-.78.86a1 1 0 0 1-.9.32l-1.15-.18a2.5 2.5 0 0 0-2.61 1.51l-.43 1.08a1 1 0 0 1-.65.58l-1.12.32A2.5 2.5 0 0 0 1.3 10.3l.32 1.12a1 1 0 0 1-.14.95L.7 13.3a2.5 2.5 0 0 0 .6 3.02l.86.78a1 1 0 0 1 .32.9l-.18 1.15a2.5 2.5 0 0 0 1.51 2.61l1.08.43a1 1 0 0 1 .58.65l.32 1.12A2.5 2.5 0 0 0 8.45 25l1.12-.32a1 1 0 0 1 .95.14l.93.78a2.5 2.5 0 0 0 3.02-.6l.78-.86a1 1 0 0 1 .9-.32l1.15.18a2.5 2.5 0 0 0 2.61-1.51l.43-1.08a1 1 0 0 1 .65-.58l1.12-.32a2.5 2.5 0 0 0 1.34-2.66l-.32-1.12a1 1 0 0 1 .14-.95l.78-.93a2.5 2.5 0 0 0-.6-3.02l-.86-.78a1 1 0 0 1-.32-.9l.18-1.15a2.5 2.5 0 0 0-1.51-2.61l-1.08-.43a1 1 0 0 1-.58-.65l-.32-1.12A2.5 2.5 0 0 0 16.5 3l-1.12.32a1 1 0 0 1-.95-.14l-.58-.03ZM12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z" />
        </svg>
      )
    case 'tuning':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path fill="currentColor" fillRule="evenodd" d="M7 2a1 1 0 0 1 1 1v3.17a3.001 3.001 0 0 1 0 5.66V21a1 1 0 1 1-2 0v-9.17a3.001 3.001 0 0 1 0-5.66V3a1 1 0 0 1 1-1Zm10 0a1 1 0 0 1 1 1v9.17a3.001 3.001 0 0 1 0 5.66V21a1 1 0 1 1-2 0v-3.17a3.001 3.001 0 0 1 0-5.66V3a1 1 0 0 1 1-1Z" />
        </svg>
      )
    case 'menu':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path fill="currentColor" d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13a1.5 1.5 0 0 1 0 3h-13A1.5 1.5 0 0 1 4 6.5Zm0 5A1.5 1.5 0 0 1 5.5 10h13a1.5 1.5 0 0 1 0 3h-13A1.5 1.5 0 0 1 4 11.5Zm0 5A1.5 1.5 0 0 1 5.5 15h13a1.5 1.5 0 0 1 0 3h-13A1.5 1.5 0 0 1 4 16.5Z" />
        </svg>
      )
    case 'pin':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path fill="currentColor" d="M16.5 3.5a1 1 0 0 0-1.6-.5L10 7.2 7.3 6a1 1 0 0 0-1.1.2l-1 1a1 1 0 0 0 0 1.4l3.2 3.2-5 5a1 1 0 1 0 1.4 1.4l5-5 3.2 3.2a1 1 0 0 0 1.4 0l1-1a1 1 0 0 0 .2-1.1L14.3 11l4.2-4.9a1 1 0 0 0-.5-1.6l-1.5-1Z" />
        </svg>
      )
    case 'pointer':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path fill="currentColor" d="M5.7 3.1a1 1 0 0 1 1.05-.12l13 7a1 1 0 0 1-.04 1.79l-5 2.2 1.9 5.5a1 1 0 0 1-1.6 1.1L11 16.5l-2.4 4.9a1 1 0 0 1-1.85-.2l-2-14a1 1 0 0 1 .95-1.1Z" />
        </svg>
      )
    case 'speaker':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path fill="currentColor" d="M13 4.06c0-1.12-1.3-1.72-2.16-.99L7.2 6.3H4a2 2 0 0 0-2 2v7.4a2 2 0 0 0 2 2h3.2l3.64 3.23c.86.73 2.16.13 2.16-.99V4.06Z" />
          <path fill="currentColor" d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" opacity=".5" />
        </svg>
      )
    case 'sparkles':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path fill="currentColor" d="M12 2c.4 0 .7.24.84.6l1.68 4.38 4.38 1.68a.9.9 0 0 1 0 1.68l-4.38 1.68-1.68 4.38a.9.9 0 0 1-1.68 0L9.48 12.02 5.1 10.34a.9.9 0 0 1 0-1.68l4.38-1.68L11.16 2.6A.9.9 0 0 1 12 2Z" />
          <path fill="currentColor" d="M18 14c.3 0 .56.2.68.48l.82 2.02 2.02.82a.72.72 0 0 1 0 1.36l-2.02.82-.82 2.02a.72.72 0 0 1-1.36 0l-.82-2.02-2.02-.82a.72.72 0 0 1 0-1.36l2.02-.82.82-2.02A.72.72 0 0 1 18 14Z" opacity=".6" />
        </svg>
      )
    case 'continuous':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path fill="currentColor" d="M12 4a8 8 0 0 1 6.93 4H17a1 1 0 1 0 0 2h4a1 1 0 0 0 1-1V5a1 1 0 1 0-2 0v1.34A10 10 0 0 0 2 12a1 1 0 1 0 2 0 8 8 0 0 1 8-8ZM3 13a1 1 0 0 1 1 1 8 8 0 0 0 13.93 4H16a1 1 0 1 1 0-2h4a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0v-1.34A10 10 0 0 1 2 12a1 1 0 0 1 1-1Z" />
        </svg>
      )
    case 'single-shot':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <path fill="currentColor" fillRule="evenodd" d="M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12Z" />
          <circle fill="currentColor" cx="12" cy="12" r="3.5" />
        </svg>
      )
    case 'mic':
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
          <rect fill="currentColor" x="8.5" y="3" width="7" height="11" rx="3.5" />
          <path fill="currentColor" d="M5 12a1 1 0 0 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V20.5h2.5a1 1 0 1 1 0 2h-7a1 1 0 1 1 0-2H11v-1.57A7 7 0 0 1 5 12Z" />
        </svg>
      )
  }
}
