import type { PetThoughtBubbleState } from '../types'

type PetThoughtBubbleProps = {
  bubble: PetThoughtBubbleState
}

export function PetThoughtBubble({ bubble }: PetThoughtBubbleProps) {
  const intensityClass = bubble.urgency >= 60
    ? 'pet-thought-bubble--strong'
    : bubble.urgency >= 30
      ? 'pet-thought-bubble--medium'
      : 'pet-thought-bubble--soft'

  return (
    <aside className={`pet-thought-bubble ${intensityClass}`} aria-live="polite">
      <span className="pet-thought-bubble__icon" aria-hidden="true">💭</span>
      <span className="pet-thought-bubble__text">{bubble.thought}</span>
    </aside>
  )
}
