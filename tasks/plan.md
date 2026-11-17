# FotMob-inspired redesign — mobile first

Prepared 2026-11-17. Implementation handoff; no application changes made.

## Objective

Make PRE FTW feel like a compact football app on a phone, taking preference from FotMob's mobile design. Keep PRE FTW branding, existing FPL data, functionality, routes and static architecture. Desktop should inherit the same visual language while retaining its useful sidebar and highlights rail.

The primary change is information hierarchy, not another green color scheme. Put useful league/club information near the top, move global navigation within thumb reach, increase small text, and reduce decorative space.

## Evidence and reference limits

- [FotMob homepage](https://www.fotmob.com/) and [Premier League page](https://www.fotmob.com/leagues/47/overview/premier-league): inspected live page structure. Competition identity, season selector and section navigation are clear separate levels. Web extraction did not expose a complete rendered table.
- [Published FotMob Android screenshots](https://fotmob.bd.aptoide.com/versions): mobile reference for compact contextual headers, horizontal section tabs, headshots and attached numeric badges. Downloaded and visually inspected the [Liverpool lineup screenshot](https://cdn.aptoide.com/imgs/0/e/b/0eb9083d523deaf591e1fc5f9b67d349_screen.png). It is a light-theme marketing screenshot; use its composition, not its background colors. Third-party listings can lag the current release.
- [Michael Watchmaker's FotMob work](https://michaelwatchmaker.com/fotmob/): visually inspected the [dark mobile lineup concept](https://michaelwatchmaker.com/static/fotmob-2-44145a4a8db16252a32c8c868dbedf30.jpg). Useful for neutral dark surfaces, readable names, restrained cards and labeled bottom navigation. The designer identifies this as 2024 exploration: it is **a concept, not proof of the shipping app**.
- Repo inspection: `index.html`, all render modules, `styles.css`, relevant tests, `SPEC.md`, `README.md`, build and preview allowlists. Captured local league and club pages in isolated headless Edge. Captures are under `.tmp-preview/design-league-mobile.png` and `.tmp-preview/design-club-mobile.png`. The narrow-window capture is clipped by headless viewport behavior; do not use it as evidence of an actual 390 CSS-pixel overflow defect. True device emulation remains an implementation check.
- The root `Screenshot 2026-11-17 150726.png` shows an earlier lineup appearance. Current source and the new club capture take precedence: portraits and point badges have already changed.

All measurements and colors below are **proposed PRE FTW targets**, not values measured from FotMob. Do not promise a pixel-identical replica. Reference images remain research material and must not be deployed as product assets.

## Current design compared with the target

| Area | Current repo | Change to make |
| --- | --- | --- |
| Mobile shell | Topbar, page links and four division cards appear above every page | Compact app bar; persistent four-item bottom navigation; division switcher only in league context |
| League identity | Breadcrumb, PRE FTW hero, section tabs, then a second division heading | One division identity block with season and competition context, followed by local controls and tabs |
| Table | 18px vertical cell padding; 11px team names and 9px manager text at narrow widths | Approximately 56–64px two-line rows, 14px names, 12px supporting text, aligned numbers |
| Color | Green-tinted surfaces, lime highlights, colored whole rows | Neutral near-black/charcoal surfaces; green for selected state and positive meaning; restrained status strips |
| Club page | Global navigation, large identity spacing, separate season toolbar, summary and results disclosure before pitch | Tight identity and season block, compact summary, existing results disclosure, then lineup |
| Pitch | 600px minimum formation height; 520px below 480px; nested margins | Width-led mobile pitch around 380–440px high at 390px viewport, subject to five-player-row legibility |
| Stats | Tall award cards with 40px scores stack vertically | Compact vertical award cards with scores aligned beside their titles and winners below |
| Home | Centered welcome/marketing block and large actions | Short welcome heading and immediately visible division list |

Retain the good parts: dark mode, real crests, semantic tables, native controls, hash links, meaningful empty states, photo fallbacks, saved-data labels and source links.

## Target mobile structure

```text
LEAGUE                             CLUB
Compact PRE FTW bar + search        Compact PRE FTW bar + search
Division crest / League D           Back to league
PRE FTW · season · team count       Crest / club name / manager
A   B   C   D                       Season selector / league link
Table Teams Transfers History      Compact 2 × 2 summary
Data status / relevant warning     Gameweek results disclosure
Standings                          Lineup · formation · GW
  #  Club                 GW PTS   Pitch / point badges / names
  1  Crest + club name     53 500   Bench / coach / full player list
     Manager                       Transactions / team information
Legend / weekly highlights         Data source / update time
Home  Leagues  Stats  Records       Home  Leagues  Stats  Records
```

### Navigation and routes

- Mobile breakpoint: below 768px. Use a 56px topbar, one brand link and the existing search field in a flexible row. Remove the tagline and season tag here. Search input should be 16px to avoid iOS input zoom. Allow a second row only if accessibility text sizing requires it; never clip the field.
- Bottom bar: four equal items, 56–64px plus `env(safe-area-inset-bottom)`, each with a simple local SVG icon and visible label: Home, Leagues, Stats, Records. Use normal links and `aria-current="page"`. Give content matching bottom padding and account for the bar in focus scrolling. Add `viewport-fit=cover` if using safe-area padding.
- Home maps to `#page=home`; Stats to `#page=stats`; Records to `#page=archive`. Leagues uses the current A–D league when available and otherwise `#league=A`. Club and historical competition routes select Leagues in the bottom bar. Historical leagues must not enter the main division menu.
- Reuse `#pages` as the global navigation container where practical. Extend its existing rendering with the Leagues link and icons, then position it at the bottom on mobile. Keep one active navigation tree, avoiding duplicated IDs and hidden focusable copies.
- Show the A–D switcher on current league screens, not above home/stats/records/club screens. Use four equal-width labeled items that fit 320px. Preserve actual league emblems and missing-image fallbacks.
- League tabs: display **Table, Teams, Transfers, History** mapped to existing `standings`, `teams`, `transactions`, `history` route values. `overview` and bare `#league=D` remain supported and select Table. Overview currently repeats the standings view; do not build a new dashboard just to distinguish it.
- Keep horizontal tab scrolling when genuinely needed. Initially keep the topbar and local tabs in normal flow; only the bottom bar needs fixed positioning. Avoid multiple stacked sticky bars.
- Preserve browser Back/Forward, search behavior, snapshot parameters, season/week selectors and route-change focus handling. Do not use `href="#lineup"` for in-page navigation: the app interprets the URL fragment as its router state.

### Visual targets

| Token / element | Proposed starting value |
| --- | --- |
| Page / surface / raised surface | `#101010` / `#1b1b1b` / `#252525` |
| Divider | `#303030`, 1px |
| Primary / secondary text | `#f5f5f5` / `#a8a8a8` |
| Accent / accent surface | `#55d86a` / `#183421` |
| Negative / trophy | Keep existing red and gold semantics; verify contrast |
| Horizontal page gutter | 12px at 320–430px; 16px on larger mobile widths |
| Spacing rhythm | 4, 8, 12, 16, 24px |
| Panel radius | 10–12px; pills only for selectors/badges |
| Page title / panel title | 22–24px / 16px |
| Team names / body / metadata | 14px / 14px / 12px |
| Table numbers | 14px, tabular numerals; total points semibold |
| Touch target | At least 44 × 44px for interactive controls |
| Standard card padding | 12–16px |

Use the existing system-font stack; Inter is named but not bundled. Do not add remote fonts or a UI library. Replace platform-dependent decorative glyphs with a small consistent set of inline SVGs only where needed. Retain text labels. No gradients, decorative shadows, giant background numerals or promotional side cards on mobile.

Text and layout may grow: dimensions are starting targets, not fixed boxes that clip translated text, long names or zoomed content. Verify normal text at 4.5:1 contrast and controls/focus indicators at 3:1 where applicable.

### Screen-specific decisions

**League and tables:** Replace the duplicate competition hero/division heading with one League A–D header. Keep season, team count, relevant status and source visible. Make the first data row appear within roughly 320 CSS pixels of the top at 390 × 844 when there is no extended warning. Warnings may push it down; never hide stale/partial data warnings to meet a layout target. Keep rank, club, GW and total visible without horizontal scrolling at 360px. Names can wrap; avoid squeezing supporting text below 12px. Use a thin promotion/relegation/champion stripe with a subtle background tint, retaining the existing legends and screen-reader status. Historical standings keep independent championship rules.

**Home:** Keep the root welcome route and welcome content, but shorten the hero. Present four division rows with crest, name, team count/status and chevron. Keep stats, record book and community links reachable. Do not invent fixtures, live scores or news to imitate FotMob.

**Club:** Keep the club identity and confirmed current branding across seasons. Combine identity and season selection visually; retain real select controls and league links. Use a compact 2 × 2 summary on phones. Preserve different summary metrics for the legacy numeric team view and club-season view. Keep the existing gameweek results disclosure compact. Historical clubs do not gain invented lineups or transfers. Do not introduce club tabs or a new routing subsystem for this pass.

**Lineup:** Keep the existing formation calculation and FWD-to-GK ordering. Use a muted green pitch (for example `#195d40` / `#1b6244`) with low-contrast stripes/markings. Portraits approximately 40–48px on phones; each five-player row must fit 320px without overlap. Keep point badges attached below the portrait, 11–12px names, small club labels, and the complete accessible player list for truncated names. Reduce excess vertical spacing rather than shrinking everything. Aim for 380–440px formation height at 390px, but grow when content needs it. Preserve zero, negative and unknown points, actual formation roles, separate bench and Head Coach, and the large-photo → original-photo → shirt fallback chain. These numbers are FPL points, never FotMob ratings; do not copy rating thresholds or invent match events.

**Stats and records:** Make award cards compact, showing title and points in one row with winner(s) below. Retain all joint winners, definitions, source information, partial coverage and unknown bench scores. Keep season and GW selectors grouped. Record book uses consistent section headers and compact rows/cards. Wide stats tables may scroll inside a labeled region; primary league standings should fit. Do not hide data columns merely to imitate a reference.

**Transactions, snapshots, empty/error states:** Apply the same card/header/type rules. Retain IN/OUT labels, dates, team links, snapshot selection, unavailable-data explanations and retry actions. Missing data stays visibly unavailable, never zero or fabricated.

**Desktop:** At 768px and above keep navigation in the sidebar and remove the bottom bar/content compensation. At larger widths retain the existing main/insights layout. Keep shared typography and neutral surfaces. Preserve existing 1000px and 1199px layout behavior unless rendered evidence justifies adjustments.

## Implementation reach

| File | Work / dependencies |
| --- | --- |
| `styles.css` | Tokens, shell, navigation, headers, tables, cards, pitch, responsive rules. Edit existing rules rather than append competing overrides. |
| `index.html` | Shell markup, navigation container placement if necessary, viewport/theme metadata. Preserve CSP, skip link and main focus target. |
| `src/app.mjs` | Global navigation rendering/selection, page-context attributes, display labels vs route keys, league header, table/rail/team/transaction templates. Preserve `state`, route helpers, data loading and filtering semantics. |
| `src/pages.mjs` | `renderWelcome`, `renderStats`, `renderArchive`; reuse `leagueEmblem` and supplied team-link callbacks. |
| `src/clubs.mjs` | Presentation in `renderClubSeason` and `renderHistoricalLeague`; preserve identity joins, routes, selectors and history calculations. |
| `src/lineup.mjs` | Only presentation changes genuinely needed by CSS; preserve `buildLineup` and `handleHeadshotError`. |
| `test/app.test.mjs` | Navigation state, overview alias, route transitions/search; update DOM doubles if new selectors are required. |
| `test/pages.test.mjs`, `test/clubs.test.mjs`, `test/lineup.test.mjs`, `test/standings.test.mjs` | Adjust changed presentation assertions; keep existing behavioral/data guarantees. |
| `SPEC.md`, `README.md` | Document final mobile layout, labels and compatibility after implementation. |

Do not change saved JSON, `src/model.mjs`, `src/stats.mjs`, refresh scripts, crest source images, dependencies or workflows for a visual redesign. Existing asset and image-error helpers already cover this work. No new module is expected. If a new public module/asset is unavoidable, update **both** `scripts/build.mjs`'s copy/check list and `scripts/serve.mjs`'s public allowlist plus their relevant tests; do not loosen the allowlist generically.

## Ordered delivery

Detailed acceptance checks are in [todo.md](todo.md).

1. Shared mobile shell and tokens, including navigation behavior tests.
2. League identity and compact standings; verify current and historical route compatibility.
3. Club identity and lineup presentation.
4. Home, stats, archive and remaining states.
5. Responsive/accessibility/regression verification and documentation.

Work sequentially: most slices share `styles.css` and `src/app.mjs`. Keep each step usable. No implementation requires a framework migration, server, account system or new FPL fetch.

## Verification and completion

- Capture before/after with **device-emulated CSS viewports**, not just headless window sizes: 320 × 740, 390 × 844, 430 × 932, tablet 768 × 1024 and desktop 1440 × 900. Check `window.innerWidth` when capturing.
- Route matrix: home; A and D standings; B/C documented standings; Teams; Transactions; History with a saved snapshot; current club `#page=club&club=miguel-fernandes`; historical club `#page=club&club=miguel-fernandes&season=2025%2F26`; historical league `#page=competition&league=1&season=2025%2F26`; stats in both seasons; record book; invalid club; search without results.
- Test bottom navigation, selected state, Back/Forward, search by manager/club, season/week/snapshot changes and existing numeric team links. Check focus after navigation and keyboard use with the software keyboard open. Use real iOS/Android if available; report when only emulated.
- No page-wide horizontal overflow; no content or focus covered by bottom navigation; all four bottom destinations and division controls fit. Table numbers align and long names remain usable. Check 200% text zoom and reduced-motion mode.
- Check 3-, 4- and 5-player formation rows; missing photos and crests; negative/zero/unknown points; long names; incomplete squads; bench and coach separation.
- Run focused existing Node tests after relevant markup changes, then `npm test` and `npm run build`. FFmpeg/ffprobe are required by existing asset checks. Use the repo-mandated `rtk` prefix when executable. Rendering/DOM assertions alone are not visual verification.
- Compare each final mobile screenshot against the reference composition: compact hierarchy, useful content high on screen, readable dense lists, restrained surfaces, clear active state and thumb-reachable navigation. Explain any remaining difference.
- Deliver changed-file summary, test results and mobile/desktop screenshots. Do not call the work complete based only on a successful build.

## Risks and limits

- Navigation and template edits can break DOM-stub tests or existing shared URLs: preserve route values and update test doubles rather than remove coverage.
- Fixed mobile navigation can obscure content, keyboard focus or controls: reserve space including safe areas and verify keyboard/zoom behavior.
- Increasing type size while reducing padding can expose long-name and five-player-row problems: verify at 320px before polishing larger screens.
- Broad table/CSS selectors also affect historical standings, statistics and player lists: inspect every renderer, not only League D.
- Research used public mobile imagery rather than direct access to the installed FotMob app. Latest native behavior, exact colors and sizes were not verified. Follow the explicit PRE FTW decisions above; do not reverse-engineer inaccessible features.

No implementation approval question is needed to use this handoff once the user assigns the implementation. This document itself is a plan, not an instruction to publish or deploy.
