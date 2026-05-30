# OpenChat — DESIGN.md

A plain-text design system for AI agents and contributors. OpenChat uses a
**Linear-style light** language: neutral gray surfaces, a single restrained
indigo accent, hairline borders, minimal shadows, tight radii, and one sans
typeface. Source of truth for tokens is `src/styles.css` (`:root`).

## 1. Visual Theme & Atmosphere

- **Mood:** calm, precise, engineering-grade. Content first, chrome quiet.
- **Density:** medium-high; generous line-height, restrained padding.
- **Philosophy:** borders and spacing define structure, not shadows or color.
  Color is reserved for meaning (the accent marks the primary/active path).
- **Default theme:** Linear light. Alternate themes (`dark`, `forest`, `sky`,
  `lavender`, `cream`, `mint`, `peach`) remain opt-in via the theme switcher and
  are not part of the core identity.

## 2. Color Palette & Roles

Hand-rolled tokens (used directly in `styles.css`):

| Token | Hex | Role |
|------|------|------|
| `--bg-primary` | `#fbfbfc` | App canvas (near-white, faint cool tint) |
| `--bg-secondary` | `#f4f4f6` | Sidebar / secondary surfaces, hover fills |
| `--bg-panel` / `--bg-panel-solid` | `#ffffff` | Cards, panels, popovers |
| `--border` | `#e9e9ec` | Hairline borders, dividers |
| `--border-subtle` | `rgba(0,0,0,.04)` | Faint internal separators |
| `--text-primary` | `#1c1d20` | Headings, primary body |
| `--text-secondary` | `#5c5f66` | Secondary text, labels |
| `--text-muted` | `#8a8d94` | Captions, placeholders, meta |
| `--accent` | `#5e6ad2` | Indigo accent: primary actions, active, links |
| `--accent-hover` | `#4f5ac4` | Accent hover/pressed |
| `--accent-soft` | `rgba(94,106,210,.10)` | Accent tint backgrounds (active nav, chips) |
| `--success` | `#3d9a50` | Success states |
| `--warning` | `#c2820a` | Warning states |
| `--error` | `#e5484d` | Error / destructive |

shadcn/ui HSL tokens (consumed by Tailwind utilities via `@theme`). **Note:** the
three tokens that would otherwise collide with the hand-rolled hex tokens are
prefixed `--sh-*` (`--sh-accent`, `--sh-border`, `--sh-muted`). Do not rename
back — the collision silently breaks `var(--accent)`/`var(--border)` colors.

| Token | HSL | Role |
|------|------|------|
| `--background` | `240 20% 99%` | shadcn surface |
| `--foreground` | `228 8% 12%` | shadcn text |
| `--primary` | `232 56% 60%` | = accent indigo |
| `--secondary` / `--sh-muted` / `--sh-accent` | `240 9% 96%` | subtle gray fills/hovers |
| `--sh-border` / `--input` | `240 6% 92%` | borders, inputs |
| `--destructive` | `358 70% 59%` | destructive |
| `--ring` | `232 56% 60%` | focus ring (indigo) |

## 3. Typography

- **Family:** `--font-sans` = `"Inter", -apple-system, BlinkMacSystemFont,
  "Segoe UI", system-ui, sans-serif`. No serif. `--font-body` and
  `--font-display` both alias `--font-sans`.
- **Base:** 14px / line-height 1.5, `-webkit-font-smoothing: antialiased`.

| Level | Weight | Notes |
|------|--------|-------|
| Display / H1 | 600 | Tight tracking, `--text-primary` |
| Heading / H2–H3 | 600 | |
| Body | 400 | `--text-primary` |
| Secondary / label | 500 | `--text-secondary`, often 0.7–0.88rem |
| Caption / meta | 500 | `--text-muted`, uppercase labels use `letter-spacing: .06em` |

## 4. Component Styling

- **Buttons (primary):** `background: var(--accent)`; `color:#fff`; radius
  `--radius-sm`→`--radius-md`; hover → `--accent-hover`; no heavy shadow.
- **Buttons (secondary/ghost):** transparent or `--bg-secondary`; `1px solid
  var(--border)`; hover fill `--bg-secondary` / `--accent-soft`.
- **Inputs:** `1px solid var(--border)`; focus → border `--accent` + `box-shadow:
  0 0 0 3px var(--accent-soft)` (ring, no glow).
- **Cards / panels:** `--bg-panel`, `1px solid var(--border)`, `--shadow-sm`,
  radius 10px (`--radius-lg`/literal).
- **Nav items:** active/hover use `--accent-soft` fill + `--accent` text.
- **Popovers / dropdowns / modals:** `--bg-panel-solid`, `1px solid var(--border)`,
  `--shadow-lg`, radius 10px.

## 5. Layout Principles

- Sidebar width `--sider-width: 280px`; message column max
  `--message-list-max-width: 880px`, padding `--message-list-padding: 44px`.
- Structure with borders + whitespace; avoid nesting elevated cards.
- 4px spacing rhythm (gaps of 4/6/8/10/12px are typical).

## 6. Depth & Elevation

Minimal, neutral, black-based — never colored:

| Token | Value | Use |
|------|-------|-----|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,.04)` | Resting cards, buttons |
| `--shadow-md` | `0 2px 4px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.04)` | Hover, sticky bars |
| `--shadow-lg` | `0 6px 20px rgba(0,0,0,.08), 0 1px 4px rgba(0,0,0,.04)` | Overlays, modals |

Radius scale: `--radius-sm 6px`, `--radius-md 8px`, `--radius-lg 12px`; shadcn
`--radius 0.5rem`. Pills use `999px`, avatars `50%`.

## 7. Do's and Don'ts

- ✅ Use design tokens; never hardcode hex/shadow/radius in new rules.
- ✅ Keep one accent; use neutral grays for everything structural.
- ✅ Prefer a `1px` border over a shadow to separate surfaces.
- ❌ No colored/glowy shadows, no large blur on resting elements.
- ❌ No serif fonts, no gradients on text or primary surfaces.
- ❌ Don't reintroduce bare HSL `--accent`/`--border`/`--muted` (use `--sh-*`).
- ❌ Avoid radii > 12px on cards/inputs (pills/avatars excepted).

## 8. Responsive Behavior

- Single sans stack scales by base font-size token; respects user font-size pref.
- Sidebar collapses to icons; touch targets ≥ 36px.
- Message column is fluid up to `--message-list-max-width`, then centered.

## 9. Agent Prompt Guide

> Build it in OpenChat's Linear-style light system: canvas `#fbfbfc`, white
> panels with `#e9e9ec` hairline borders, near-black text `#1c1d20`, secondary
> `#5c5f66`, single indigo accent `#5e6ad2` (hover `#4f5ac4`) reserved for
> primary/active/links. Inter font, 14px base. Radii 6–12px, pills `999px`.
> Shadows minimal and neutral (`rgba(0,0,0,.04–.08)`), never colored. Always use
> the CSS variables in `src/styles.css`; do not hardcode colors.
