# Visual Design Direction

## Reference Mood

User-selected inspiration:

`C:\Users\poppa\Downloads\Best-Websites-for-Web-Design-Inspiration-Brilliant-Examples-to-Boost-Your-Creativity-scaled.jpeg`

The preferred direction is not a plain government dashboard. The UI should feel more like an immersive command center: vivid gradient, fluid shapes, side rail, dotted rhythm, bold poster-like hero type, dark preview panels, and visible motion.

## Translation To PR-OS

Do not copy the reference literally. Translate its visual language into a practical municipal public relations operations system.

Use:

- Coral, peach, deep blue, violet, and dark ink accents
- Liquid gradient shapes as branded energy, not decoration everywhere
- Side rail pattern for operational timeline/navigation cues
- Dot grid/timeline to suggest scheduled work
- Dark preview panel for monitor/live status
- Loader ring and pulse effects for live operational states
- Large type only in the hero/monitor; dense readable tables elsewhere

Avoid:

- Generic admin template look
- Static flat cards with no motion
- Excessive glass blur that hurts readability
- Overusing purple/blue gradient on every surface
- Decorative animation with no status or interaction meaning
- Hiding important operational data behind visual spectacle

## Motion Requirements

Motion is a required part of the PR-OS prototype so the interface does not feel like AI slop.

Required motion layer:

- Hero liquid blobs drift slowly
- Hero signal sweep moves across the stage
- KPI cards and rows enter with slight stagger
- Live status dot pulses
- Important/cancel/change statuses pulse subtly
- Monitor screen has refresh sweep and live rail pulse
- Monitor screen can include a live ticker, glint sweep, and subtle sparkle points when they reinforce operational awareness
- Buttons have pressed feedback without layout shift
- All animations respect `prefers-reduced-motion`

## Typography Direction

Use a modern Thai sans-serif stack that works without runtime CDN dependency:

- Primary UI: `LINE Seed Sans TH`, `IBM Plex Sans Thai`, `Noto Sans Thai`, `Leelawadee UI`, `Segoe UI`, system sans-serif
- Display headings: same modern Thai sans-serif stack, heavier weight for command-center confidence
- Data and times: `Cascadia Code`, `Segoe UI Mono`, Consolas, Thai fallback, with tabular numeric styling

Typography rules:

- Thai body text must stay readable at normal office-monitor distance
- Keep body text at 16px or larger
- Use heavier weights for headings and KPI numbers, not tight letter spacing
- Use tabular numbers for time, KPI, and monitor displays to prevent visual jitter
- Avoid importing web fonts from a CDN unless production deployment policy allows it

## Premium Quality Gate

Luxury for PR-OS should feel precise, confident, and operational, not ornamental.

Before accepting a redesign, check:

- Is the first screen visually memorable within three seconds?
- Do gradients, shadows, and dark surfaces support hierarchy instead of covering weak layout?
- Is Thai text still readable at office-monitor distance?
- Are animations tied to live status, navigation, loading, or feedback?
- Does the screen still work if animations are disabled?
- Are repeated work surfaces calmer than the hero area?
- Do reports and management summaries look trustworthy, not like a marketing poster?

## Optional TypeUI Workflow

TypeUI can be used before another major redesign pass to turn this direction into a more structured design system for Codex.

For now, TypeUI is a documented option only. Do not install, enable, or connect its MCP workflow until the project owner explicitly confirms.

Use it for:

- Creating PR-OS-specific color, typography, spacing, and component rules
- Generating multiple layout variations before choosing one direction
- Keeping future Codex UI edits consistent with the chosen visual language
- Reviewing markdown source rules before publishing them to an MCP workflow

Do not use it as a substitute for testing the real Next.js screens in browser. The selected design still needs live verification for Thai readability, responsive behavior, animation smoothness, and office-work usability.

## Prompt For Figma Or Lovable

Create a PR-OS municipal public relations operations dashboard inspired by an immersive editorial web design with coral-to-blue gradient, fluid liquid shapes, dark glass preview panels, vertical side rail, dotted schedule rhythm, bold operational hero typography, and meaningful motion. Keep it usable for real office work: readable Thai text, dense but organized schedule table, monitor-safe display mode, assignment acknowledgement states, KPI cards, and management summary. Avoid generic admin template styling. Use animation for live status, refresh sweep, row stagger, and pressed feedback. Maintain accessibility, contrast, and responsive layouts.
