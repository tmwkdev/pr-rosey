# Frontend Practices

This doc is the renderer UI guidance for pr-rosey. Keep component choice, styling, and visual-system
rules here.

Use this as an agent-readable component guide. Before inventing markup or styling, identify the UI
job, choose the closest component pattern, and check the "do not use for" notes. The goal is a quiet,
dense desktop app where each component shape means one thing.

## Component Choice

Choose the most specific primitive that matches the job:

1. Plain semantic HTML for structure and ordinary text.
2. A token from `apps/desktop/src/styles/tokens.ts` when a primitive only needs shared styling.
3. A small local helper component when the parent becomes hard to scan or the region has a clear
   name.
4. A feature component when there is meaningful local state, behavior, reuse, or a durable UI region.
5. A shared renderer component only after at least two features need the same behavior-rich element.

Do not create components whose only job is styling a single HTML element. Use tokens for styling;
use components for behavior, state, reuse, or named UI structure. Do not split components just to
reduce line count. A cohesive 60-line component is better than a stack of tiny wrappers with prop
threading and unclear ownership.

## Component Catalog

These descriptions are adapted for pr-rosey from mature product design systems, especially Shopify
Polaris. They are intentionally broad: the app may not have all of these components yet, but agents
should still use this vocabulary when choosing what to build.

| Component pattern | Use for | Do not use for |
| --- | --- | --- |
| Page or app shell | The full-window frame, global navigation, persistent header actions, and the main scrolling region. | Repeated content items, individual panels, or one-off visual grouping. |
| Section | A named region inside a page where related controls or content belong together. | A repeated list item, decorative spacing, or a replacement for a heading. |
| Card or panel | A bounded group of related concepts, settings, summaries, or tasks that should be scanned as one unit. | Page-wide layout bands, tiny metadata, table rows, or nested decorative boxes. |
| Stack, inline, grid | Layout only: vertical groups, horizontal groups, and column alignment. | Conveying status, creating visual emphasis, or hiding semantic structure. |
| Heading | Screen, section, or subsection titles that establish hierarchy. | Labels, badges, buttons, or decorative uppercase text. |
| Body text | Descriptions, explanations, empty-state copy, and readable supporting content. | Metadata lists, status values, or button labels. |
| Metadata text | Secondary facts such as repository, branch, author, timestamp, count context, or source. | Status, warnings, actions, or anything that needs visual priority. |
| Button | A user action such as refresh, open, save, cancel, retry, or dismiss. | Navigation to a different app area, status display, metadata, or passive labels. |
| Icon button | A compact, obvious command with an accessible name, such as refresh, close, copy, open, or settings. | Ambiguous commands, primary actions without nearby context, or status decoration. |
| Link | Navigation to another route, external URL, or document. | Mutating actions, toggles, menu triggers, or button-like commands. |
| Button group | A small set of related actions that need consistent spacing and priority. | Unrelated commands, filters, tabs, or dense row actions that need a menu. |
| Tabs | Switching between peer views of the same object or workflow. | Filtering data, navigating unrelated sections, or showing status counts without content panes. |
| Table | Dense, comparable records with stable columns, sorting potential, and row-level actions. | Narrative content, small option sets, cards masquerading as rows, or mobile-only layouts. |
| List | A vertical set of related items where columns are not needed. | Complex comparable data, key-value details, or unrelated actions. |
| Description list | Key-value facts about one object, such as dependency name and installed version. | Multi-record data, paragraphs, or action groups. |
| Form field | User-entered or user-edited values with a label, validation, and help/error text when needed. | Read-only metadata, filters without persistence, or command buttons. |
| Checkbox | Multiple independent selections or one on/off option inside a form. | Immediate global toggles, radio-style exclusive choices, or status display. |
| Radio group | A short set of mutually exclusive choices. | Multiple selections, binary settings that should read as on/off, or navigation. |
| Select or combobox | Choosing from a larger or dynamic option set where a radio group would be too long. | Primary navigation, command menus, or tiny two-option choices. |
| Search or filter controls | Narrowing a list or table by query, status, owner, repository, or review relationship. | Permanent data entry, navigation, or visual labels. |
| Menu or popover | Secondary actions or contextual choices that would clutter the surface if always visible. | Primary actions, required form content, important warnings, or hidden status. |
| Tooltip | Short clarification for an icon, abbreviated label, or disabled control. | Critical instructions, errors, interactive content, or long explanations. |
| Dialog or modal | Focused decisions, destructive confirmations, or short workflows that must interrupt the current context. | Routine page content, non-blocking feedback, or large multi-step workflows. |
| Banner or alert | Prominent feedback about a page or section: warnings, blocking errors, persistent conditions, or important next steps. | Item metadata, success noise after every small action, or decorative emphasis. |
| Inline message | Local feedback near the field, row, or panel it belongs to. | Page-wide problems, long-form help, or status badges. |
| Empty state | A list, table, or page has no data and the user needs context or a next action. | Loading, errors, filtered-zero results without filter context, or individual blank table cells. |
| Skeleton or spinner | Loading progress while data or UI is not ready. | Empty data, errors, or long-running background state that needs explanation. |
| Progress indicator | A task with meaningful progress or steps. | Unknown wait time, binary status, or decorative activity. |
| Badge | A compact, non-interactive status/count marker attached to an object. | Metadata, headings, categories, filters, buttons, links, or anything with long text. |
| Label or tag | User-defined categories, filterable labels, or contextual metadata that benefits from compact grouping. | Numeric counts, primary status, actions, or page chrome. |
| Status dot plus label | Repeated low-density status rows where text should carry the meaning and color only reinforces it. | Important warnings, actions, or dense metadata. |
| Divider | Separating adjacent groups when spacing and headings are not enough. | Decoration, heavy page structure, or repeated row borders that create visual noise. |

If a component choice feels unclear, write down the sentence "This UI lets the user..." or "This UI
tells the user...". Actions usually become buttons or menus. Navigation becomes links or tabs. Dense
records become tables or lists. Facts become metadata or description lists. Conditions become status
labels, inline messages, or banners.

## Badge Discipline

Badges are compact, non-interactive indicators attached to another element. Use them sparingly for:

- A count tied to a parent element, such as unread items or pending checks.
- A short status label for the associated item, such as `Draft`, `Open`, `Failed`, or `Ready`.
- A small notification marker when the exact count or label is not useful.

Do not use badges for:

- Section labels, headings, eyebrow text, or page chrome.
- Categories, repository names, authors, dates, branch names, or other ordinary metadata.
- Buttons, links, filters, menus, tabs, or anything the user can operate.
- Long prose, explanations, multi-word phrases that wrap, or copy with verbs that sound like an
  action.
- Visual variety when plain text, a table cell, an icon with accessible text, or a status row would
  communicate the information more quietly.

Badge copy should be short, sentence case unless the value is a proper noun or acronym, and free of
punctuation. If more than two or three badges appear in one repeated row, pause and redesign the row:
use columns, metadata text, a status dot plus label, or grouped detail text instead.

## Status, Tags, And Metadata

Status is not always a badge. Pick the status treatment based on density and importance:

- Use a status dot plus nearby text for repeated availability/readiness rows.
- Use a badge only when the status must sit inline with a specific object and needs compact visual
  emphasis.
- Use ordinary muted text for secondary metadata.
- Use a label or tag only for user-defined categories, filterable labels, or contextual metadata. If
  it is clickable, it must look and behave like an interactive control, with keyboard focus and clear
  selected/dismissed states.
- Use alerts, empty states, or inline messages for feedback that needs explanation or action.

Color can support status but must not be the only carrier of meaning. Status treatments need visible
text, an icon, shape, or another non-color cue, and badge text must meet normal text contrast.

## Agent Rules

Agents should treat component selection as a product decision, not a styling decision.

- Start from the catalog above before inventing a new visual shape.
- Prefer existing app primitives and patterns over new generic wrappers.
- Never use one rounded compact style for unrelated concepts. A badge, tag, filter chip, button, and
  metadata value should not all look interchangeable.
- Do not make a component interactive unless it uses native semantics or implements the expected
  keyboard and focus behavior.
- Keep visual density appropriate to the surface: tables and operational panels should be compact;
  empty states and blocking messages can use more space.
- If a source design system has a component for the job, copy the intent and constraints, not the
  brand styling.

## Styling And Tokens

Reuse `apps/desktop/src/styles/tokens.ts` before writing Tailwind classes on primitive elements. Add
a token only when the same primitive class string repeats for the same purpose. Do not add a token
for one-off styling, and do not create a token so broad that it hides the component's intent.

If a repeated class string is really a semantic UI decision, name the token by purpose instead of
shape. For example, prefer a status or metadata token over a generic `pill` token when the style is
only valid for that use. Avoid expanding `tokens.badge` into a catch-all for every rounded compact
element.

## State And Data

Keep state as local as possible. Lift state only when siblings need it, and avoid global stores until
there is a clear cross-cutting concern that ordinary props cannot reasonably handle. Model async work
with explicit loading, error, and data states. Prefer early returns over deeply nested JSX
conditionals.

Use `interface` for object shapes and `type` for unions or aliases. Avoid `any`; move shared types
to a shared file instead of duplicating them across modules.

## Dependencies

Add libraries only when they remove real complexity or cover important edge cases. Good examples are
`date-fns` for date formatting, `clsx` or a `cn()` helper for class composition, accessible UI
primitives for dialogs/dropdowns/tooltips, and TanStack Query only if async state becomes complex
enough to warrant it.

Prefer a small hook or helper over a dependency when React, Tailwind, TypeScript, or vanilla JS
already solves the problem cleanly. Avoid speculative abstractions, unrelated concerns in one
component, hand-rolled replacements for proven libraries, and comments that restate obvious code.

## Reference Sources

This guidance is adapted from public design-system and agent-design-system references:

- [Shopify Polaris component catalog](https://polaris-react.shopify.com/components) and usage docs
  for component taxonomy and product-oriented "what this is for" descriptions.
- [Atlassian Design System components](https://design-system-docs-proxy.services.atlassian.com/components/),
  [Primer Label](https://primer.style/product/components/label/),
  [Designsystemet Badge](https://designsystemet.no/en/components/docs/badge/overview), and
  [Scottish Government Status Tag](https://designsystem.gov.scot/components/status-tag) for badge,
  label, tag, and status distinctions.
- [Wikimedia Codex token structure](https://doc.wikimedia.org/codex/main/design-tokens/definition-and-structure.html)
  for reusable decision tokens versus component-specific exceptions.
- [W3C WCAG use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) and
  [contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) guidance.
- [W3C ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/) for
  native semantics and interaction contracts.
- [Agentic design-system guidance](https://designproject.io/blog/agentic-design-system/) on why
  agents need explicit component intent and anti-patterns, not just visual tokens.
