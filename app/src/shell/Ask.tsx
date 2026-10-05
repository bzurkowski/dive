import { useRef, useState } from 'react'
import { askContext, askPrompt, askTargets } from '../ask'
import type { Dive } from '../types'
import type { Pos } from './nav'

export function Ask({
  dive,
  pos,
  agent,
  setAgent,
  className,
}: {
  dive: Dive
  pos: Pos
  agent: string
  setAgent: (a: string) => void
  className: string
}) {
  const [question, setQuestion] = useState('')
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('')
  const panel = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLTextAreaElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const open = useRef<HTMLAnchorElement>(null)
  const timer = useRef(0)
  const ctx = askContext(dive, pos, location.href)
  const prompt = askPrompt(ctx, question)
  const targets = askTargets(ctx, prompt)
  const target = targets.find((t) => t.label === agent) ?? targets[0]
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(''), 1500)
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        popoverTarget="ask"
        title="Ask your agent about this step (A)"
        aria-keyshortcuts="a"
        className={`${className} flex shrink-0 items-center gap-2`}
      >
        <Icon d={target.icon} />
        <span>
          Ask<span className="max-sm:hidden"> your agent</span>
        </span>
      </button>
      <div
        ref={panel}
        id="ask"
        popover="auto"
        role="dialog"
        aria-label="Ask your agent"
        // Opens over its button, kept 1rem inside the screen.
        onBeforeToggle={(e) =>
          e.newState === 'open' &&
          e.currentTarget.style.setProperty('--x', `${trigger.current!.getBoundingClientRect().left}px`)
        }
        onToggle={(e) => e.newState === 'open' && box.current?.focus()}
        className="inset-auto bottom-18 left-[max(1rem,min(var(--x),calc(100vw-25rem)))] m-0 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-4 text-fg shadow-lg"
      >
        <h2 className="font-bold">Ask your agent about this step</h2>
        <div className="mt-3 rounded-lg border border-line bg-bg outline-offset-2 outline-accent has-[textarea:focus-visible]:outline-2">
          <textarea
            ref={box}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
              e.preventDefault()
              if (question.trim()) open.current?.click()
            }}
            rows={3}
            aria-label="Your question (optional)"
            placeholder="Your question (optional)"
            className="block w-full resize-none bg-transparent px-3 pt-2 text-base placeholder:text-muted focus-visible:outline-none!"
          />
          <div className="flex items-center gap-2 p-2">
            <label className="relative mr-auto flex items-center">
              <span className="sr-only">Agent</span>
              <Icon d={target.icon} className="pointer-events-none absolute left-2.5" />
              <select
                value={target.label}
                onChange={(e) => setAgent(e.target.value)}
                className="h-8 rounded-md border border-line bg-surface pr-1 pl-8 text-sm font-medium hover:border-accent"
              >
                {targets.map((t) => (
                  <option key={t.label}>{t.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={copy}
              title="Copy prompt"
              aria-label="Copy prompt"
              className={`${SQUARE} border border-line bg-surface hover:border-accent`}
            >
              <Icon d={copied === 'ok' ? CHECK : COPY} />
            </button>
            <a
              ref={open}
              href={target.href}
              title={`Open in ${target.label} (Enter)`}
              aria-label={`Open in ${target.label}`}
              onClick={() => panel.current?.hidePopover()}
              className={`${SQUARE} bg-accent text-bg hover:opacity-85`}
            >
              <Icon d={PLAY} />
            </a>
          </div>
        </div>
        <p role="status" className="mt-2 text-xs text-muted">
          {copied === 'ok'
            ? 'Copied the prompt.'
            : copied === 'fail'
              ? 'Could not copy: the browser blocked the clipboard.'
              : ctx.cwd
                ? 'The prompt is filled in, not sent: you continue in your agent.'
                : 'No agent here? Copy the prompt into any chat.'}
        </p>
      </div>
    </>
  )
}

const SQUARE = 'grid size-8 shrink-0 place-items-center rounded-md'

const COPY =
  'M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 16H8V7h11z'
const CHECK = 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
const PLAY = 'M8 5v14l11-7z'

const Icon = ({ d, className = '' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={`size-4 shrink-0 fill-current ${className}`}>
    <path d={d} />
  </svg>
)
