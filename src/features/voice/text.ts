const STAGE_DIRECTION_STRIP_PATTERN = /[[\uFF08(\u3010][^\uFF09)\u3011\]]{1,32}[\uFF09)\u3011\]]/gu
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/giu
const URL_PATTERN = /https?:\/\/[^\s)]+/giu
const SOFT_SEPARATOR_PATTERN = /\s*[|·]+\s*/gu
const SLASH_SEPARATOR_PATTERN = /\s*\/\s*/gu
const ELLIPSIS_PATTERN = /(?:\.{3,}|…{2,}|~{2,}|～{2,})/gu
const REPEATED_PUNCTUATION_PATTERN = /([，。！？；：,.!?;:])(?:\s*\1)+/gu
const SPACE_BEFORE_PUNCT_PATTERN = /\s+([，。！？；：,.!?;:])/gu
const LEADING_PUNCT_PATTERN = /^[，。！？、；:：\s]+/u
const TRAILING_PUNCT_PATTERN = /[，。！？、；:：\s]+$/u
const DUPLICATED_SPEECH_LABEL_PATTERN = /((?:今天|明天|后天|昨天|今晚|今早|明早|明晚|周[一二三四五六日天]|星期[一二三四五六日天]))[：:]\s*\1(?=[，,])/gu

function normalizeWhitespace(text: string) {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

export function normalizeVoiceDedupText(content: string) {
  return normalizeWhitespace(content).toLocaleLowerCase()
}

export function prepareTextForTts(content: string) {
  const normalized = String(content ?? '')
    .replace(MARKDOWN_LINK_PATTERN, '$1')
    .replace(URL_PATTERN, ' ')
    .replace(STAGE_DIRECTION_STRIP_PATTERN, ' ')
    .replace(SOFT_SEPARATOR_PATTERN, '，')
    .replace(SLASH_SEPARATOR_PATTERN, '，')
    .replace(ELLIPSIS_PATTERN, '。')
    .replace(DUPLICATED_SPEECH_LABEL_PATTERN, '$1')
    .replace(REPEATED_PUNCTUATION_PATTERN, '$1')
    .replace(SPACE_BEFORE_PUNCT_PATTERN, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  return normalizeWhitespace(
    normalized
      .replace(LEADING_PUNCT_PATTERN, '')
      .replace(TRAILING_PUNCT_PATTERN, ''),
  )
}
