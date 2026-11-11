# Dashboard UI Refinement Design

## Understanding summary

- Remove the enclosing card treatment around the dashboard's Summary, Meals, Bazar & Deposits, and Admin tab controls.
- Refresh the Summary & Final Balance table and mobile cards with clear row treatments and distinct Due, Refund, and Settled badges.
- Preserve existing print/PDF behavior, WhatsApp actions, meal toggles, and responsive layouts.
- Improve rendering only where current code identifies a concrete opportunity.
- Preserve horizontal scrolling and flexible content; avoid rigid card heights and virtualization.

## Assumptions

- Expected usage remains monthly household/mess data rather than very large public datasets.
- Existing access controls, privacy behavior, and data flow are unchanged.
- Reliability is validated by preserving interactions and passing the production build.
- The project team continues to own the current Next.js and Tailwind component conventions.
- Tables may scroll horizontally on narrow screens; names remain wrappable.

## Final design

### Dashboard tabs

Remove the outer glass, border, background, shadow, and rounded-card appearance from the tab strip in `src/app/dashboard/page.tsx`. Keep its horizontal scrolling, order, and navigation behavior. Retain the active emerald state and make inactive tabs visually quiet so the controls sit naturally in the dashboard.

### Summary and final balance

In `src/components/dashboard/SummaryTable.tsx`, use the existing balance sign semantics for Due, Refund, and Settled and render the corresponding soft rose, emerald, and slate pills consistently in desktop and mobile layouts. Add subtle member-row hover treatments and crisp table typography. Keep the existing print/export path and content; update the export control to a solid emerald style with consistent interaction states. Keep member names flexible and allow horizontal scrolling rather than clipping.

### Performance and layout stability

- Preserve the shared swipe card's existing GPU transform and 400/30 spring settings.
- Add GPU transform hints only to the actual scale-animated empty-state entrance and confirmation dialog, if needed.
- Keep the confirmation modal's existing short opacity/scale transitions.
- In `src/components/dashboard/DailyMealsSheet.tsx`, index meal records by date once per records update and use lookups in both row render paths.
- Use predictable minimum sizing for summary numeric/status columns and meals grid cells while preserving current overflow and content-driven card heights.
- Do not add virtualization, broad data refactors, or unmeasured memoization.

### Validation

- Run `npm.cmd run build` in PowerShell.
- Run targeted ESLint for changed components and `git diff --check`.
- Review the diff for preserved print styles, calculations, interactions, and mobile overflow behavior.

## Decision log

1. **Use targeted UI/rendering refinement.** Broader restyling and virtualization were considered; targeted edits cover the observed problems with less regression risk and complexity.
2. **Remove only the tab strip's enclosing card.** Keep tab navigation and active/inactive states.
3. **Apply the status design to both render modes.** Keep existing balances, labels, and export behavior.
4. **Use bounded layout sizing.** Avoid fixed heights or clipping; retain horizontal scrolling and wrapping on narrow screens.
5. **Optimize evidenced hotspots only.** The swipe spring is already optimized; date-indexing removes repeated scans in the meals sheet without changing the rendering model.

## Follow-up: segmented tabs, expanded summary, and motion

### Understanding summary

- Refine the dashboard tabs into a floating segmented control without an awkward blank card wrapper.
- Expand the summary table naturally to fill its card and use balanced cell spacing.
- Harmonize actual spring transitions, including swipe gestures, while retaining duration-based fades.
- Preserve navigation, print/export, data, and responsive behavior.

### Assumptions

- Current household-scale data does not require virtualization or new dependencies.
- No permissions, privacy, backend, or data-model changes are intended.
- Existing project ownership and Next.js/Tailwind patterns remain unchanged.
- Build success and preserved interactions are the reliability target.

### Follow-up design

Wrap the fitted tab segments in a translucent slate surface with border, blur, rounded corners, and shadow. Keep the existing horizontal-scroll viewport for narrow displays and use emerald active and slate inactive states.

Style the summary report as a white/dark glass card with 3xl rounding, border, shadow, and padding. Use an auto-layout, full-width, left-aligned, border-collapsed table with balanced `px-6 py-4` cell spacing. Remove forced minimum width, fixed layout, and percentage columns; allow the final balance column to take remaining space. Keep long member names wrappable, retain horizontal overflow where needed, and preserve the existing mobile cards and print CSS.

Set all spring-based transitions to stiffness 300 and damping 25, including swipe snap. Preserve the 80px swipe bounds, directional snap logic, and disabled momentum. Keep the modal and empty-state short duration-based opacity/scale transitions. Retain GPU hints on actual transform-animated elements only; avoid blanket hints on static controls.

### Validation

- Run `npm.cmd run build`.
- Run targeted ESLint for changed TSX files and `git diff --check`.
- Verify every actual spring uses 300/25 and duration-based fades remain unchanged.
- Review narrow-width table behavior and existing print overrides.

### Follow-up decision log

1. **Use the floating segmented tab style.** Keep horizontal reachability on narrow screens rather than clipping or wrapping controls.
2. **Use natural table sizing.** Auto layout and balanced padding replace fixed minimum width and percentage columns, reducing unused space and preserving name wrapping.
3. **Apply the selected spring globally to spring transitions.** The swipe spring changes to 300/25 as explicitly confirmed; duration-based fades remain unchanged to avoid unnecessary behavior changes.
4. **Keep GPU hints scoped to animated transforms.** No global blanket hints or shared motion abstraction is introduced.
5. **Preserve existing mobile and print behavior.** Existing overflow and print overrides remain the compatibility boundary.

## Follow-up: full-width summary and print fidelity

### Understanding summary

- Make the summary card and table fill the available width with balanced cell padding.
- Use an inline SVG in the print header so the logo does not depend on external image loading.
- Format browser print output for A4 with printer-safe margins and preserve badge colors.
- Hide interactive controls and continue printing only the summary report.
- Preserve report data, existing mobile layout, and the `window.print()` workflow.

### Assumptions

- A4 with 12mm margins is a printer-safe default; zero physical printer margins are not assumed.
- A simple inline vector mark using the existing emerald/slate brand colors is acceptable because no dedicated vector asset was specified.
- The printed report contains the same information already visible in the summary; permissions and data handling are unchanged.
- The project remains household-scale and requires no PDF library or data-model changes.
- Validation covers build, targeted lint, and CSS/diff review; it does not claim physical-printer verification.

### Follow-up design

In `src/components/dashboard/SummaryTable.tsx`, use the requested full-width, white/dark, rounded-3xl card with border, shadow, clipped overflow, and `p-6 sm:p-8`. Keep print overrides authoritative over screen padding. Use a full-width, left-aligned, border-collapsed table with `px-6 py-4` on all headers and cells, without fixed layout or a minimum width. Preserve mobile summary cards and use a small inline SVG mark in the print header instead of Next Image.

In `src/app/globals.css`, add `@page { size: A4; margin: 12mm; }`. In the existing print media rules, preserve summary-only visibility isolation; reset screen-only card styles; set report/table width to 100%; allow table overflow to print visibly; and apply exact print color adjustment so status colors are retained. Hide the print button via `print:hidden` and the existing print selector, and continue hiding chat links and mobile cards. Let long reports paginate naturally.

### Validation

- Run `npm.cmd run build`.
- Run targeted ESLint on `SummaryTable.tsx` and `git diff --check`.
- Review A4 sizing, width resets, color adjustment, hidden controls, and report-only printing.
- Do not claim physical-printer verification.

### Follow-up decision log

1. **Keep the browser-print workflow.** A separate print tree or PDF library was considered but would duplicate content or add dependencies without addressing a demonstrated need.
2. **Use A4 with 12mm margins.** This favors printer-safe output over zero-margin layouts that may clip on physical printers.
3. **Use an inline SVG logo.** This removes external image loading dependency from the print-header path.
4. **Preserve summary-only visibility and natural pagination.** Reset screen styles and force print colors without changing report content or shrinking long reports to one page.

## Follow-up: matching logo and modern PDF

### Understanding summary

- Replace the print-only substitute logo with the exact app-header logo asset, `/logo-512.png`.
- Improve the summary table's balance by aligning the final-balance heading and values to the right edge.
- Give the printed report a polished visual hierarchy that matches the on-screen summary.
- Preserve full-width table behavior, data, mobile cards, browser printing, and A4 settings.

### Assumptions

- `/logo-512.png` is authoritative because it is used by the dashboard header.
- The perceived right-side gap is due to the final-balance column's left alignment; right alignment will make the full-width table read as balanced.
- "Modern PDF" means refinements to existing print CSS and report markup, not a new export workflow or new data.
- Existing access controls, privacy, household-scale usage, and ownership remain unchanged.
- Browser print settings may influence output; a successful build is not physical-printer verification.

### Follow-up design

In `src/components/dashboard/SummaryTable.tsx`, use the same local `/logo-512.png` image source as `DashboardNav`, sized as a contained 48px square. Check the installed Next.js image guidance for print-safe eager/preload behavior before editing. Keep the report data and markup as the single source of truth. Keep the table full-width and right-align the final-balance header and badge content on screen and in print, while retaining left-aligned preceding columns and wrapping member names.

In `src/app/globals.css`, retain the existing A4 portrait/12mm page rule, print-only report isolation, hidden controls, and color adjustment. Improve print-only header hierarchy, table readability, row dividers, and the rose/emerald/slate badges to match the screen design. Preserve full-width table behavior and natural pagination; do not force content onto one page or set all table-cell backgrounds to white.

### Validation

- Read installed Next.js image docs for image loading recommendations before implementation.
- Run `npm.cmd run build`, targeted ESLint on `SummaryTable.tsx`, and `git diff --check`.
- Review logo source/visibility, table width/alignment, print typography/badges, and hidden interactive controls.
- Do not claim physical-printer verification.

### Follow-up decision log

1. **Reuse the app's actual logo.** Replace the approximate SVG with `/logo-512.png`, matching the dashboard header.
2. **Right-align the final balance column.** This uses the already full-width table and resolves the perceived right-side whitespace without distorting other columns.
3. **Refine the existing print report.** Keep one source of truth and avoid duplicate markup or a PDF-generation dependency.
4. **Match the screen's hierarchy in print.** Use readable spacing, dividers, and colored balance pills while retaining the approved A4 page settings and natural pagination.
5. **Keep the change local.** Touch only summary rendering, print styling, and this decision record.

This follow-up supersedes the earlier inline-SVG logo decision: the print header now reuses the actual app logo asset. The report month remains in the summary heading, so the print brand header shows the export date without repeating the month.
