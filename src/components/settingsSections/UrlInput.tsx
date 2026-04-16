import { useState, type InputHTMLAttributes } from 'react'

const URL_PROTOCOL_RE = /^https?:\/\//i

type UrlInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

/**
 * Drop-in replacement for `<input>` that shows a red border when the value
 * is non-empty and does not start with `http://` or `https://`.
 * Does not block saving — visual feedback only.
 */
export function UrlInput(props: UrlInputProps) {
  const { value, onBlur, style, ...rest } = props
  const [touched, setTouched] = useState(false)

  const strValue = typeof value === 'string' ? value : String(value ?? '')
  const invalid = touched && strValue.length > 0 && !URL_PROTOCOL_RE.test(strValue)

  return (
    <input
      {...rest}
      value={value}
      style={{
        ...style,
        ...(invalid ? { borderColor: '#e74c3c', boxShadow: '0 0 0 1px #e74c3c' } : {}),
      }}
      title={invalid ? 'URL should start with http:// or https://' : undefined}
      onBlur={(e) => {
        setTouched(true)
        onBlur?.(e)
      }}
    />
  )
}
