import { createHighlighterCore, type HighlighterCore, type LanguageInput, type ThemedToken } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import type { FileData } from '../types'
import { sideText, type Row } from './rows'

type Lines = ThemedToken[][]
export interface Tokens {
  old: Lines | null
  new: Lines | null
}

// Each grammar adds to the template size.
// ponytail: no ruby (its embedded grammars add ~2 MB). Ruby renders as plain text.
const LANGS: Record<string, LanguageInput> = {
  typescript: () => import('shiki/langs/typescript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  kotlin: () => import('shiki/langs/kotlin.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  swift: () => import('shiki/langs/swift.mjs'),
  php: () => import('shiki/langs/php.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  shellscript: () => import('shiki/langs/shellscript.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  xml: () => import('shiki/langs/xml.mjs'),
}

// dive.py ids that differ from the grammar name. tsx covers jsx, one grammar less.
const ALIASES: Record<string, string> = { ts: 'typescript', js: 'javascript', jsx: 'tsx', bash: 'shellscript' }

let core: Promise<HighlighterCore> | undefined
const highlighter = () =>
  (core ??= createHighlighterCore({
    themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
    engine: createJavaScriptRegexEngine(),
  }))

async function tokenize(code: string, lang: string): Promise<Lines | null> {
  const id = ALIASES[lang] ?? lang
  if (!LANGS[id]) return null
  const h = await highlighter()
  await h.loadLanguage(LANGS[id])
  const themes = { light: 'github-light', dark: 'github-dark' }
  return h.codeToTokens(code, { lang: id, themes, defaultColor: false }).tokens
}

const cache = new WeakMap<FileData, Promise<Tokens>>()

export function highlightFile(file: FileData, rows: Row[]): Promise<Tokens> {
  let hit = cache.get(file)
  if (!hit) {
    hit = Promise.all([
      file.diff ? tokenize(sideText(rows, 'old'), file.lang) : null,
      tokenize(sideText(rows, 'new'), file.lang),
    ])
      .then(([o, n]) => ({ old: o, new: n }))
      .catch(() => ({ old: null, new: null }))
    cache.set(file, hit)
  }
  return hit
}
