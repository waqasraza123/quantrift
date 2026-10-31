# Product experience

QuantRift presents a chart-first research workflow. Product UI should explain the next useful
action before exposing module names, storage contracts, worker details, or diagnostic metadata.

## Navigation and routes

Keep existing URLs and workspace query parameters compatible:

- Overview: `/command-center`
- Markets: `/dashboard`
- Setups: `/triage`
- Scanner: `/scanner`
- Journal: `/journal`

Other existing routes remain accessible under Research & tools. The shared navigation registry
owns labels and URLs. Mobile navigation retains a workspace selector inside More. Selector IDs
are instance-specific so desktop and mobile markup can coexist.

## Presentation

- Use the shared `--brand-*` palette: white backgrounds, black/charcoal text, and army-green
  (`#4b5320`) actions and highlights, with white labels on green buttons. Product pages retain
  adaptive light/dark themes with white light surfaces and theme-appropriate olive accents.
  Shared status badges and dots use the semantic theme tokens. Accent-filled controls pair
  their background with `--on-accent` so labels remain readable in both themes.
- Prefer one primary page action, a few useful summary counts, and readable lists.
- Keep setup rows responsive without a wide multi-column board or mandatory horizontal scrolling.
- Put configuration, audit trails, and secondary diagnostics in native disclosure sections.
- Keep data warnings visible when they affect interpretation. Do not hide blockers behind success
  language or imply missing data is current.
- Keep the original signal and AI assessment visibly separate. Give charts and AI levels room;
  preserve the saved candle window, timestamps, risk review, and outdated states.
- Provide a way back to the setup list and a direct route to journal writing.
- Preserve GET filter names and hidden workspace context. More filters collapse the form visually;
  their values remain part of submission.
- Disclosure sections open for explicit deep-link state, such as `/journal?compose=1#new-note`,
  selected scan history, or missing scanner configuration.

The public homepage and auth screens share the light brand palette regardless of system theme.
The homepage uses a code-native interactive sample chart. Sample data must remain labeled
illustrative. No live prices, returns, customers, testimonials, or predictive-accuracy claims may
be invented.

## Reusable UI

`PageHeader`, `WorkspaceStats`, `DisclosurePanel`, and `SetupList` provide the primary layout.
Existing review panels and backend contracts remain available inside secondary sections.
`ReviewSurfaceHero` delegates to the shared page header. Product copy uses Overview, Markets,
Setups, and Paper plans while preserving existing route and API identifiers.

## Verification handoff

The user requested no tests, builds, lint, type checks, or browser verification during this work.
The redesign has not been runtime or visually verified. Manual review should cover responsive
navigation, both color schemes, keyboard focus and disclosures, workspace switching, preserved
filters, scan creation/results, journal composition/selection, saved paper plans, and AI chart
history/expiry. Existing browser expectations for old labels and the six-column board will need
review against the new product layout.

## Pricing and teams

Public pricing at `/pricing` and on the homepage reads the API-owned catalog. Keep plan prices,
AI allowances, shared Team seats, unavailable checkout, and cancellation timing clear. Preserve
selected plans through registration, verification, and MFA without starting checkout automatically.
`/billing` and `/team` use the active session workspace; only the owner can manage payments.
Workspace switching updates the server session before navigation. Invitation tokens stay in URL
fragments/session storage and must not enter analytics, logs, or application copy. Setup and
owner-operated validation are documented in `docs/billing.md`.

## Account access

Login, signup, email verification, and optional authenticator verification use the shared
`AuthLayout` and scoped `auth.module.css`, retaining the two-column layout adapted from HVACLine
with the shared QuantRift brand colors. Keep account flows focused on the current step, preserve
local return paths, and keep password/session/challenge secrets out of URLs and browser storage. Retain QuantRift’s
workspace fields and email verification. Authenticator rollout is documented in
`apps/api/docs/auth.md`; it defaults off until configured.

Keep authenticator QR codes black on white for scanning. Error, notice, and recovery-code panels
use the shared semantic colors; primary actions use white text on army-green backgrounds.
