// `backticks` become code spans. The capture group puts them at odd indices.
export function Inline({ text }: { text: string }) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    i % 2 ? (
      <code key={i} className="rounded bg-line/60 px-1 py-px font-mono text-[0.88em]">
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  )
}
