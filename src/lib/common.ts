export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function shorten(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`
}

export function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('录音文件读取失败。'))
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('录音文件读取失败。'))
        return
      }

      const [, base64 = ''] = reader.result.split(',', 2)
      resolve(base64)
    }
    reader.readAsDataURL(blob)
  })
}
