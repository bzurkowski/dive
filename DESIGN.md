---
name: Dive
description: An interactive walkthrough of real code, one step at a time.
colors:
  bg: "#f2f3f5"
  surface: "#ffffff"
  fg: "#1c1f26"
  muted: "#5b6170"
  line: "#dadde3"
  accent: "#1c1f26"
  mark: "#ffee8a"
  add: "#e3f4e6"
  del: "#fbe8e8"
  chg: "#e0ecff"
  chg-ink: "oklch(48.8% 0.243 264.376)"
  ok: "#1b7a45"
  bad: "#c0271d"
  edge: "#a2560c"
  bg-dark: "#131519"
  surface-dark: "#1a1d23"
  fg-dark: "#e7e9ee"
  muted-dark: "#9ca1ad"
  line-dark: "#2c3039"
  accent-dark: "#e7e9ee"
  mark-dark: "#423a06"
  add-dark: "#13271a"
  del-dark: "#341a1b"
  chg-dark: "#1d2c44"
  chg-ink-dark: "oklch(80.9% 0.105 251.813)"
  ok-dark: "#5ccb8c"
  bad-dark: "#f28b82"
  edge-dark: "#e8ad64"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  narration:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.375
  body:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  note:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  caption:
    fontFamily: "Atkinson Hyperlegible Next Variable, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
  code:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "24px"
  message:
    fontFamily: "Atkinson Hyperlegible Mono Variable, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "12.5px"
    fontWeight: 400
rounded:
  sm: "2px"
  DEFAULT: "4px"
  md: "6px"
  lg: "8px"
  node: "10px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "2.5": "10px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "12": "48px"
  "16": "64px"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
  button-next:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  button-quiet:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.DEFAULT}"
    padding: "4px 8px"
  button-quiet-hover:
    textColor: "{colors.fg}"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  chip-flow-link:
    textColor: "{colors.muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  highlight-mark:
    backgroundColor: "{colors.mark}"
    rounded: "{rounded.sm}"
    padding: "0 4px"
  kbd:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.DEFAULT}"
    padding: "2px 6px"
  step-stage:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  note-card:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.muted}"
    typography: "{typography.note}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  note-card-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
  sequence-callout:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
    width: "300px"
  quiz-option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  rail:
    backgroundColor: "{colors.surface}"
    width: "18rem"
---

# Design System: Dive

## Overview

**Creative North Star: "The Marked-Up Printout"**

A dive looks like a printout of the code that a patient colleague has marked up for you. The ink is graphite on cool paper. Margin notes sit right under the lines they explain, and a yellow highlighter covers the one thing to read now. The mood is patient, guided and clear. The interface sets the pace one step at a time and keeps its own chrome out of the way of the code.

The page has almost no color. Ink and paper carry the structure. A pale page and a white sheet, separated by hairline borders, do the layering, and the highlighter marks focus. Every other hue has a job: green and red for diffs and quiz answers, amber for optional edge cases, blue for changed units in a PR, and a few tints that tell diagram groups apart.

Each screen holds one idea. Code, sequence and diagram steps fill the viewport with one bordered stage. Card, terms and quiz steps sit in a narrow reading column. Anything not in focus fades instead of disappearing, so the reader keeps their place in the whole.

Both themes are complete. The dark theme is the same printout at night, with the same roles and the same rules. The reader's choice is saved as `dive-theme`, and the OS setting applies when nothing is saved.

**Key Characteristics:**
- Graphite and paper, with a single yellow highlighter for the current focus.
- Flat surfaces separated by hairline borders and two paper tones, not by shadows.
- One idea per screen: a narration sentence above one visual, moved with ← and →.
- Whatever isn't in focus fades and stays visible, so context is never lost.
- One type family, Atkinson Hyperlegible, with its Mono cut reserved for real code.
- One offline file: fonts are bundled and nothing is fetched at runtime.

## Colors

The palette is graphite on paper. Color appears only where it carries a meaning.

### Primary
- **Graphite Ink** (`fg`, also `accent`): the text, and the accent itself. Primary buttons, the focus outline, progress, the active note's band and the rail's filled stations are all ink. The accent is deliberately not a brand hue.
- **Highlighter Yellow** (`mark`): the one color that means "read this now". It sits behind the current step in the rail, the active sequence message label and the active code rows. In the dark theme it becomes a deep olive under light ink.

### Secondary
- **Diff Green** (`add`, ink `ok`) and **Diff Red** (`del`, ink `bad`): added and removed lines, `+n −n` counts, and quiz verdicts (correct, your pick). Error messages in sequences use `bad` ink.
- **Change Blue** (`chg`, ink `chg-ink`): only the "changed" badge and the `~` sign on actors and messages that a PR modifies.

### Tertiary
- **Edge Amber** (`edge`): only optional edge cases. It colors the "Edge cases" label and the dashed rule under a flow in the rail.

### Neutral
- **Cool Paper** (`bg`): the page behind everything. Also used for inactive note cards, inputs inside panels and actor boxes.
- **White Sheet** (`surface`): the sheet that content sits on. The rail, header, footer, step stage, cards, popovers and buttons.
- **Pencil Gray** (`muted`): secondary text such as crumbs, reading times, line numbers, captions and inactive rail items.
- **Hairline** (`line`): every border and divider, the sequence lifelines, and future rail stations. At 60% opacity it is also the fill of inline code.

Diagram groups use categorical tints of sky, fuchsia, emerald, violet, rose and teal, at a 10% fill with a 60% stroke. They only tell groups apart and never mean state. Syntax highlighting uses the Shiki `github-light` and `github-dark` themes.

### Named Rules
**The Highlighter Rule.** Yellow marks the current focus and nothing else. If two unrelated things on a screen are yellow, one of them is wrong.

**The Graphite Accent Rule.** The accent is ink. Emphasis comes from weight, a darker border or the highlighter, never from a new hue.

**The Meaning-Only Color Rule.** Every hue has a job: a diff, a verdict, an edge case, a change, or a diagram group. A color that only decorates doesn't ship.

## Typography

**Display Font:** Atkinson Hyperlegible Next (falls back to ui-sans-serif, system-ui)
**Body Font:** Atkinson Hyperlegible Next
**Label/Mono Font:** Atkinson Hyperlegible Mono (falls back to ui-monospace, SF Mono, Menlo, Consolas)

**Character:** It is one family built for legibility, so the prose and the code read as the same voice. Bold, tight-tracked headings do the shouting, and everything else stays plain.

### Hierarchy
- **Display** (800, 2.25rem rising to 3.5rem at ≥640px, line height 1.05, tracking −0.025em, balanced): the dive's title on the cover only.
- **Headline** (700, 1.875rem, 1.25): the title of a card, terms or quiz step. The end screen uses 2.25rem.
- **Title** (700, 1.5rem, 1.25): the title of a code, sequence or diagram step, and drawer headings. The rail's dive title is 1.25rem at weight 800.
- **Narration** (400, 17px, 1.375): the `say` sentence under a visual step's title, capped at max-w-5xl.
- **Body** (400, 1.125rem, 1.625): card text and quiz options. The cover summary is 1.25rem with a 62ch measure, with `backticks` as inline code. Glossary meanings are 1rem.
- **Note** (400, 15px, 1.625): code note cards and diagram notes. The sequence callout uses 14px at 1.375.
- **Label** (500, 0.875rem): header buttons, crumbs, the position counter and the rail's step list. The rail's chapter titles are 15px.
- **Caption** (400, 0.75rem): note meta, reading times, file status and the flow-link chips. Group bands use 11px, weight 600, uppercase, with wide tracking.
- **Code** (Mono, 13px, line height 24px): code rows. Inline code is 0.88em on a `line`/60 pill. Sequence message labels are Mono at 12.5px.

### Named Rules
**The Mono Means Code Rule.** Monospace is only for real code: identifiers, file paths, message labels and code rows. UI never borrows it for flavor.

**The Bundled Type Rule.** Both cuts ship inside the file. A dive renders the same offline, in an email attachment, with no network.

## Layout

The app fills the viewport and never scrolls as a page. A 288px rail (`w-72`) sits on the left from 1024px up, and the reader can hide it. Below 1024px the same rail opens as a Chapters drawer (`min(22rem, 90%)`). A slim header holds the position ("Walkthrough, step 3 of 7"), Glossary and the theme toggle, with a 2px progress hairline along its bottom edge. The footer holds Previous, the focus counter ("Note 2 of 6" on code and diagram steps, "Message 5 of 15" on sequences), Skip to the next flow, Ask, and Next. The Next label names its destination ("Next chapter: Recap", "Next: edge cases (optional)").

Steps use one of two layouts:
- **Stage:** used for code, sequence and diagram steps. A crumb, the title and the narration sit at the top, and one bordered `surface` panel fills the rest of the height and scrolls on its own. Padding is 16px, rising to 24px from 640px.
- **Page:** used for card, terms and quiz steps. A centered reading column (max-w-2xl, terms max-w-4xl) with 48–64px of vertical padding.

The cover is a max-w-3xl column with generous top space and a numbered chapter list ruled with hairlines. Above the title, the source line names the kind and links the rail's source ("Pull request: owner/repo #842"). The end screen is the printout's last page, in the same column: the quiz tally ("2 of 3 quiz answers right, 1 skipped"), the review-focus steps as a hairline-ruled "What to check" list that links to each step, then the hand-off. A dive with no review focus or no quiz leaves those parts out. The glossary opens as a right drawer (`min(30rem, 100%)`).

Spacing follows Tailwind's 4px scale. Chrome is snug: header and footer padding is 10px by 16px, and buttons are 8px by 16px. Reading areas get room: drawers have 24px of padding and page steps 48–64px vertically. Some secondary text hides below 640px, such as "your agent" in Ask, the Skip button and the footer counter. Next shortens to "Edge cases →" or a plain "Next" so the footer stays on one line, and its accessible name keeps the full destination.

## Elevation & Depth

The printout is flat. Depth comes from two paper tones (`bg` under `surface`) and 1px hairline borders, and the system has no resting shadows. A shadow shows up only on something that floats over the page: the Ask popover and the sequence note callout. Modal drawers dim the page with a 35% black backdrop. The sticky lane header in sequences is the one translucent surface (`surface` at 90% with a backdrop blur), and the blur is there only to keep the lanes readable over scrolled messages.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): popovers and callouts that sit over content.

### Named Rules
**The Flat Paper Rule.** Surfaces are flat at rest. A shadow means "this floats above the page", so cards, buttons and panels never get one.

**The Fade, Don't Hide Rule.** Focus is shown by fading everything else. Code rows outside the active note drop to 55% opacity. Past messages sit at 60% and future ones at 15%, and both brighten on hover. Unlit diagram nodes fade the same way.

## Shapes

Corners are gently rounded and consistent. 8px (`lg`) is the default for buttons, panels, note cards, inputs, quiz options, actor boxes and popovers. 6px goes on the small square icon buttons, 4px on text-only header buttons and `kbd`, and 2px on the highlighter stroke. Diagram nodes use 10px. Pills are reserved for chips, status tags and the dots on the rail. Borders are 1px hairlines. The 2px exceptions are the quiz options (so verdict colors read) and the rail's station rings. Lines carry meaning: a dashed lifeline is a lane, a dashed message is a return, a dotted strike is removed, and a dashed amber rule marks edge cases.

## Components

### Buttons
- **Shape:** gently rounded (8px).
- **Default:** white sheet, hairline border and ink text at medium weight, with 8px × 16px padding. Used for Previous, and for Ask with the chosen agent's icon and "Ask your agent". On hover the border darkens to ink.
- **Primary:** solid ink with white text and 12px × 24px padding at 1.125rem semibold. Used only for "Start the dive" and the end screen's "Open the pull request ↗", or "Back to the start" when the dive has no URL. On hover it drops to 90% opacity.
- **Next:** solid ink with paper-colored text and 8px × 16px padding, opacity 85% on hover. It is the one filled button in the footer, as the Open square is inside the Ask popover.
- **Quiet:** Pencil Gray text that turns ink on hover. Used for the header actions (Chapters, Glossary, theme, Close) and for "Back to the start" beside the end screen's primary.
- **Focus:** every control shows a 2px ink outline offset by 2px.

### Chips
- **Flow link:** a hairline pill above the code that reads "Ky#fetch → Ky#retry · `label`". It jumps back to the message in the flow.
- **File status / change badges:** small hairline pills for file status (`modified`), and opaque tinted tags (`new`, `changed`, `removed`) that sit on an actor box's border.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** `surface` on the `bg` page. Inactive note cards invert this and sit on `bg` inside the white stage.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** 1px hairline. The active note card's border turns ink.
- **Internal Padding:** 12px × 16px.

### Inputs / Fields
- **Style:** a hairline border on white, 8px corners and a muted placeholder. Used for glossary search and the Ask agent select.
- **Composer:** the Ask question box sits inside a hairline frame on `bg`, with the agent select on the left and Copy and Open on the right. The frame takes the focus ring when the textarea is focused.

### Navigation
- **The depth line (rail):** the dive title links to the cover, with the source (`owner/repo #842`) linked under it. Chapters are stations on a vertical 2px line. Passed stations and segments are filled ink, the current station is an open ring with a soft ink halo, and future ones are hairline. Each chapter shows its reading time on the right. Only the current chapter expands, listing its steps and its flows as smaller stations on the same line. The current step is highlighter-marked, and edge cases follow under a dashed amber rule.
- **Header:** quiet buttons only, with the 2px progress hairline.
- **Keyboard:** ← and → (also j and k, or Space) move. `g` opens the glossary and `a` opens Ask. Shortcuts are shown with `kbd` on the cover.

### Code view (signature)
Each file has a sticky header with its path in Mono (truncated from the left so the file name survives), its status, `+n −n`, and "Open on GitHub ↗" that deep-links the active lines. Rows use the diff tints for adds and deletes. The rows owned by the active note get the highlighter (when they aren't diff rows) and a 4px ink band on the left. Rows owned by other notes get a faint 3px band, and every row outside the active note drops to 55% opacity. Note cards sit right under the lines they explain, with their line range. The footer counter says which note is active. Collapsed runs show as "⋯ 14 unchanged lines" and expand on click.

### Sequence diagram (signature)
Actors are boxes on dashed lifelines, under optional uppercase group bands, and "Group by app" merges lanes. Messages appear one at a time. The active message draws its line (0.45s), gets a highlighter-backed Mono label, and drops a callout card under it with its note and "Show code →" or "Go to flow →". Calls are solid lines, returns dashed, async messages have open arrowheads, errors are in `bad`, and removed messages are struck through.

### Quiz option
A white option with a 2px hairline border that turns ink on hover. After a pick, the correct option turns green and is labeled "Correct", a wrong pick turns red and is labeled "Your pick", and the rest fade to 70%. Each option shows its one-line why. The pick and the shuffled order hold for the visit, so a revisit shows the same verdict.

## Do's and Don'ts

### Do:
- **Do** show one idea per screen: a title, one narration sentence, and one visual.
- **Do** use Highlighter Yellow (`mark`) only for the current focus.
- **Do** fade what isn't in focus (55%, 60%, 15%) instead of hiding it.
- **Do** keep the accent graphite. Emphasize with weight, an ink border or the highlighter.
- **Do** define every color in both themes and check a change in light and dark.
- **Do** put motion behind `prefers-reduced-motion`. The draw (0.45s), pop (0.3s, 4px rise) and fade (0.2s) are the whole vocabulary.
- **Do** bundle fonts and assets. The file has to work offline.

### Don't:
- **Don't** make it look like a SaaS dashboard: no KPI tiles, card grids or colorful status badges.
- **Don't** add marketing gloss: no gradients, glassmorphism, glows or decorative illustration.
- **Don't** turn it into a docs site with long scrolling pages and heading sidebars. A dive moves in steps.
- **Don't** clone an IDE: no editor tabs, minimaps or file trees. Code always appears inside a step, framed by narration.
- **Don't** give resting cards, panels or buttons a shadow. Shadows are only for floating layers.
- **Don't** introduce a brand hue or use green, red, amber or blue outside their meanings.
- **Don't** use monospace for UI text.
