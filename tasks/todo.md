# FotMob mobile redesign task list

Design specification and research: [plan.md](plan.md). Implementation and emulated verification completed; evidence and device limitations are in [results.md](results.md).

## 1. Mobile shell and visual tokens

Dependencies: none. Scope: medium.

Files: `index.html`, `styles.css`, `src/app.mjs`, `test/app.test.mjs`.

- [x] Implement proposed neutral colors/type sizes and compact mobile app bar using existing search.
- [x] Reuse global navigation for Home/Leagues/Stats/Records bottom bar below 768px; preserve desktop sidebar, route semantics, focus and safe-area spacing.
- [x] Add focused assertions for active states across home/league/club/historical competition/stats/archive and any new DOM hooks.

Verification: `node --test test/app.test.mjs`; browser at 320/390/768px; navigate with keyboard and Back/Forward. All labels/controls fit and no content is covered.

## 2. League header and standings

Dependencies: 1. Scope: medium.

Files: `src/app.mjs`, `styles.css`, `test/app.test.mjs`, `test/standings.test.mjs`.

- [x] Replace duplicate league identity blocks with one compact header and contextual A–D switcher; display Table/Teams/Transfers/History while retaining existing route keys and Overview alias.
- [x] Apply readable compact standings with GW/PTS visible at 360px, restrained place markings and existing legends/status warnings.
- [x] Keep search, team links, snapshot routes, unavailable data and empty results working.

Verification: focused app/standings tests; capture A/D and B/C documented tables, filtered/no-result states and History. First row near the top target without hiding warnings.

### Checkpoint 1

- [x] Run `npm test` and `npm run build`; compare league screenshots at 320/390/1440px. Address regressions before continuing.

## 3. Club identity and lineup

Dependencies: 2. Scope: medium.

Files: `src/clubs.mjs`, `src/lineup.mjs`, `styles.css`, `test/clubs.test.mjs`, `test/lineup.test.mjs`. Avoid modifying lineup markup when CSS suffices.

- [x] Compact club identity, season control, 2 × 2 phone summary and gameweek-results disclosure; retain historical and current data distinctions.
- [x] Reduce pitch height/spacing with readable portraits, names and FPL point badges; keep five-player rows usable at 320px.
- [x] Preserve bench, coach, expanded player list, unknown/negative/zero points and all image fallback behavior.

Verification: focused clubs/lineup tests; current/historical club captures; 3/4/5-player rows and failed images; inspect legacy numeric team page too.

## 4. Remaining screens

Dependencies: 3. Scope: medium.

Files: `src/pages.mjs`, `src/app.mjs`, `styles.css`, `test/pages.test.mjs`, `test/app.test.mjs`.

- [x] Shorten welcome and show divisions as compact rows; compress award cards and unify record-book presentation.
- [x] Apply common controls/typography to transactions, snapshots, team cards, source/status text and empty/error/retry states.
- [x] Preserve joint winners, partial coverage, score definitions, historical selectors, source links and team identities.

Verification: focused pages/app tests; screenshot home, stats for both seasons, archive, teams and transactions. Test long names and unavailable data; inspect historical standings for effects of shared CSS.

### Checkpoint 2

- [x] Run `npm test` and `npm run build`; compare complete mobile route matrix with the plan. No fabricated content or hidden warnings.

## 5. Final verification and documentation

Dependencies: 4. Scope: small documentation slice; fix visual defects in their owning files only when found.

Files: `SPEC.md`, `README.md`; relevant implementation files only for verified defects.

- [x] Complete device-emulated viewport matrix, keyboard/focus, safe-area, zoom, contrast, reduced-motion and desktop checks in `plan.md`.
- [x] Document mobile navigation/labels and retained URL compatibility; include before/after screenshots and disclose physical-device testing limits.
- [x] Record final test/build results; no remaining overlapping players, page overflow or bottom-bar obstruction.

Verification: final test/build run if fixes changed code; otherwise reuse checkpoint results. Inspect `git diff --check` and diff for unintended data/asset changes. Deliver plan acceptance results without deploying.

Physical iOS/Android devices were unavailable. Keyboard checks used Tab navigation and a reduced-height viewport; enlarged-text checks doubled computed font sizes. Native platform behavior remains a manual follow-up, as disclosed in results.md.
