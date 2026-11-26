# Warm Organic Clay-Glassmorphism Design

## Understanding

- Replace the current cool slate/emerald semantic palette with the requested warm cream, sage, and terracotta tokens in light and dark modes.
- Add reusable clay-card, frosted glass-bar, and tactile pill utilities.
- Restyle the desktop/mobile navigation shell and sticky dashboard header while preserving their interactions.
- Add dynamic breadcrumb context for the current dashboard destination.
- Restyle overview KPI cards with the four requested pastel tints and exact one/two/three-column responsive grid.
- Restyle the login page with warm ambient glows, feature pills, a clay card, and terracotta-accented Google sign-in.
- Do not change auth/session logic, Firestore operations, `calculateMessStats`, or dashboard navigation behavior.

## Assumptions and Constraints

- Existing semantic utility names such as `--brand-hover`, `--brand-fill`, and `bg-container` remain available through aliases to the new palette.
- Unspecified `bg-container` follows the warm elevated surface.
- Preserve distinguishable semantic status colors and accessible foreground/background contrast.
- The four KPI tints rotate through existing card order; seven admin cards can leave a partially filled final row.
- Keep the theme toggle and reduced-motion behavior; avoid page-wide blur and limit glass effects to the specified surfaces.
- This is a styling-only change with no new dependencies or data/auth behavior.

## Decision Log

| Decision | Alternatives considered | Rationale |
| --- | --- | --- |
| Centralize the palette in semantic CSS tokens and retain backward-compatible aliases. | Add color values separately in each component. | Keeps the theme consistent and makes future tuning maintainable. |
| Add new clay/glass utilities and apply them only to the requested surfaces. | Replace every existing `.glass-card`/`.glass` surface globally. | Avoids expanding Part 1 into unrelated forms, logs, dialogs, and admin tools. |
| Derive breadcrumb text from the current dashboard route. | Show `Dashboard / Overview` on every page. | Keeps header context accurate across dashboard sections. |
| Keep the existing shared sidebar renderer for desktop and mobile. | Create separate visual/navigation implementations. | Preserves current responsive behavior and keyboard/focus handling. |
| Use four KPI tint tokens cyclically and keep the requested three-column maximum. | Add more breakpoints or special-case final cards. | Follows the supplied palette and avoids sparse extra-wide grids. |
| Preserve login handlers, status meaning, and the Google brand icon. | Rework auth UI behavior or recolor the Google mark. | The request is visual-only and must preserve authentication behavior. |

## Design

### Tokens and utilities

Use the supplied values for `--bg-canvas`, `--bg-sidebar`, `--border-sidebar`, `--bg-surface`, `--bg-elevated`, border, text, and brand tokens. Add mappings for sidebar, strong border, secondary brand, and four light/dark KPI tints to `@theme inline`. Retain existing `--brand-hover`, `--brand-fill`, and `--brand-fill-hover` aliases so existing utility classes continue to resolve. `--bg-container` follows `--bg-elevated`.

`.clay-card` provides a rounded warm surface, one-pixel border, subtle top-left inset highlight, and soft diffused shadow. `.glass-bar` uses a translucent warm surface, border, and backdrop blur with an opaque-surface fallback. `.clay-pill` supplies a full pill shape, subtle depth, and a pressed scale of 0.97; reduced-motion preferences disable its motion.

### Sidebar and header

The desktop sidebar and mobile drawer use the sage sidebar surface and border. Active group/item pills use a crisp surface and soft shadow, with terracotta/sage emphasis; the current shared renderer and collapsible interactions remain intact.

The sticky header uses `.glass-bar`. It displays `Dashboard / <current destination>`; the breadcrumb sits before the month control on desktop and beside the menu trigger on mobile. The centered mobile month row, non-wrapping balance badge, notifications, theme toggle, and profile controls retain current behavior.

### KPI cards and login

KPI cards use the exact sand, terracotta, blush, and sage tints in existing order, with coordinating icon containers and tabular values. The grid remains `grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3`; the last row can be partially filled for seven admin cards.

The login canvas receives CSS-based sage and terracotta radial glows. The central card and session error card use `.clay-card`; feature blocks become pastel tactile pills; the Google sign-in button receives warm surface/border/shadow accents while keeping its existing icon, handlers, and feedback.

## Validation

- Run `npm.cmd run lint`, `npm.cmd run build`, and `git diff --check`.
- Inspect token mappings and compatibility aliases for all existing `bg-*`, `text-*`, and `border-*` semantic utilities.
- Verify target components preserve their event handlers, route destinations, responsive navigation, and theme switching.
- Verify KPI tint rotation and the exact responsive grid classes.
- Visually inspect light and dark styles at mobile and desktop widths when browser preview is available.

## Risks and Limitations

- Backdrop blur support varies by browser; `.glass-bar` must retain a legible warm surface if blur is unavailable.
- Contrast must be checked for text and icons on each pastel KPI tint in both themes.
- Unrelated components using hard-coded colors are intentionally outside this Part 1 scope.

## Part 2: Tables, Forms, Logs, and Modals

- Extend clay surfaces to dashboard tables, admin forms, member management, activity history, notifications, and dialogs while preserving their responsive layouts and interactions.
- Use `bg-elevated/60` with subtle borders and terracotta focus rings for shared form fields. Primary actions and selectable filters use terracotta clay pills; positive status accents use the semantic forest-sage palette.
- Use warm espresso backdrops for modal overlays and clay surfaces for dialogs and popovers. The responsive log editor keeps `.glass-bar` so its existing mobile bottom-sheet corner treatment remains intact.
- Warm the summary print palette to match the on-screen report while retaining its print layout and semantic warning/danger colors.
- Keep authorization, session flows, Firestore operations, and business calculations unchanged.
