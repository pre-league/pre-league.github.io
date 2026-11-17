# Mobile redesign acceptance

Completed locally on 2026-11-17 against [plan.md](plan.md). No deployment or Git push was performed.

## Delivered

- Neutral dark surfaces, compact app bar and labeled Home/Leagues/Stats/Records bottom navigation below 768px. Desktop keeps the sidebar and highlights rail.
- One league identity block, contextual A-D switcher and Table/Teams/Transfers/History tabs. Existing route values, Overview aliases, numeric team links and snapshot parameters remain supported.
- Readable standings, compact club identity and season controls, 2-by-2 phone summary, shorter pitch and attached FPL point badges. Bench, coach and full player list remain available.
- Compact welcome division rows, award headings and common controls, notices, empty states and retry presentation.
- Existing score calculations, history, confirmed identities, image fallbacks, unknown values, source links and partial-data warnings retained.

The implementation changes index.html, styles.css, src/app.mjs and src/pages.mjs; navigation assertions were added to test/app.test.mjs. README.md and SPEC.md describe the new presentation. Saved data, model/statistics logic, lineup logic, assets, dependencies, sync scripts and workflows were not changed.

## Measured results

Measurements use real Edge rendering with device-emulated CSS viewports. The user launched a separate headless browser profile; subsequent checks attached to that isolated session over localhost.

| Check | Before | After |
| --- | --- | --- |
| League D first row, 390px viewport | 628.7px from top | 321.5px from top |
| Club formation height, 390px | 538.8px | 414.2px |
| Club formation height, 320 / 430px | - | 391.7 / 440px |
| Standings club / manager text | 11 / 9px mobile CSS | 14 / 12px |
| Mobile navigation | Above page content | Fixed bottom bar, four labeled links |

All four League D teams fit above the bottom bar at 390 x 844. Warnings remain visible and may legitimately move standings farther down on other divisions.

## Browser verification

The matrix captured 18 routes at each of 320 x 740, 390 x 844, 430 x 932, 768 x 1024 and 1440 x 900: **90 combinations**. It includes home, A-D, Teams, Transfers, saved History, current/historical clubs, historical standings, both stats seasons, records, invalid club, legacy numeric team, five-player formation and no-result search.

- No page-wide horizontal overflow or overlapping player portraits in the matrix; no JavaScript runtime exceptions.
- A further 360px standings check kept rank, club, GW and PTS visible without horizontal scrolling.
- Actual 3-, 4- and 5-player rows were checked. Truncated player names retain the complete accessible player list.
- Bottom destinations have at least 76 x 56px hit areas at 320px; division and section controls are at least 44px high. Search and brand links are also at least 44px high.
- Back/Forward restored Home/Leagues selection. Manager and club searches, club season changes, historical league GW10, stats season/GW2 and the saved 2026-11-17 snapshot worked.
- Forty Tab steps through League D found no interactive focus target hidden behind the bottom bar. Skip link and visible focus styling remain available.
- Emulated bottom safe area of 34px produced 114px body compensation and 38px navigation bottom padding. Reduced-motion mode was recognized.
- At a reduced 390 x 420 viewport the focused search remained 16px and navigation stayed at the viewport bottom. This is a keyboard layout proxy, not a real phone keyboard test.
- A separate 200% font-size stress check doubled computed font sizes on league, club, home and stats pages: no page-wide overflow; navigation labels wrapped and pitch badges grew with their text. Edge's native emulated OS text-scale setting was accepted but did not visibly change glyph sizes, so it is not counted as native text-zoom verification.
- Deliberately blocked headshots exhausted both image sizes and revealed all 11 starting shirts. Failed club crests revealed initials; failed division emblems revealed A-D letters. Blocking latest.json showed the error state; unblocking it and pressing Try again restored standings.
- Existing tests cover missing/negative/zero player points, incomplete formations, fallback sequencing, joint winners and unavailable bench scores. No test data was added to production JSON.

Sample computed color contrast ratios: primary text/surface 15.80:1; secondary text/raised surface 6.45:1; accent/selected surface 7.36:1; input border/raised surface 3.10:1; white/pitch 7.83:1; relegation text/row 7.89:1; trophy text/row 10.46:1. These are targeted checks, not a full accessibility certification.

## Screenshots

Evidence is local and ignored by Git under `.tmp-preview/mobile-redesign/`; it is not part of the public build.

| View | Before | After |
| --- | --- | --- |
| League, 390px | [Before](../.tmp-preview/mobile-redesign/before-league-390.png) | [After](../.tmp-preview/mobile-redesign/after-league-390.png) |
| Club, 390px | [Before](../.tmp-preview/mobile-redesign/before-club-390.png) | [After](../.tmp-preview/mobile-redesign/after-club-390.png) |
| League, 1440px | [Before](../.tmp-preview/mobile-redesign/before-league-1440.png) | [After](../.tmp-preview/mobile-redesign/after-league-1440.png) |

Additional captures: [five-player pitch at 320px](../.tmp-preview/mobile-redesign/after-pitch-five-player-club-320.png), [home at 320px](../.tmp-preview/mobile-redesign/after-home-320.png), [stats at 390px](../.tmp-preview/mobile-redesign/after-stats-390.png), [historical standings at 320px](../.tmp-preview/mobile-redesign/after-historical-league-320.png), [tablet](../.tmp-preview/mobile-redesign/after-league-768.png), [large-text pitch](../.tmp-preview/mobile-redesign/after-large-text-club.png), [failed-image fallback](../.tmp-preview/mobile-redesign/after-image-fallback.png).

Raw measurements: `before-metrics.json`, `after-metrics.json`, `after-extra.json`, `large-text.json`, `interaction-checks.json` and `final-checks.json` in the same private directory. Portrait overlap and overflow checks were computed from DOM bounding boxes, with representative screenshots visually inspected.

## Automated validation and review

- Full existing Node suite: **54 passed, 0 failed, 0 skipped**.
- Static build: passed, including existing FFmpeg thumbnail generation.
- Navigation assertions catch an intentionally inverted active-page condition; the mutation was restored immediately after the check.
- Final review preserved escaping, fixed image origins, public-file allowlists and existing data/error handling. No dependencies or public modules were added.
- `git diff --check`: clean.

Managed Windows execution required Node's `--preserve-symlinks --preserve-symlinks-main` flags. Commands used were `node --preserve-symlinks --preserve-symlinks-main --test` and `node --preserve-symlinks --preserve-symlinks-main scripts/build.mjs`, which run the same suite/build as the package scripts. RTK was attempted but execution returned Access denied; native commands were used.

## Limits

No physical iOS/Android device, Safari, native software keyboard or native OS text scaling was tested. The redesign follows the documented FotMob-inspired composition and PRE FTW decisions, rather than claiming an exact replica of the installed FotMob app. Local screenshots remain on this computer and will not accompany a Git push unless explicitly copied into a tracked documentation location.

## Follow-up: global search and Bench column

Search now displays results across all current divisions and historical-only clubs without rewriting the route or selecting League D. Clearing search restores the existing page. Standings now include gameweek Bench points in current, snapshot and historical tables. The shared calculation preserves explicit scores, including zero and negatives, and only sums a complete scored bench from the matching gameweek. Unknown totals remain a dash.

These follow-up changes have regression coverage for searches from Home, Stats, Records, league tabs, numeric teams, club profiles and historical competitions. The original screenshot matrix above predates these two changes; no fresh real-browser or physical-device pass was available for this follow-up.

Follow-up validation: all 55 Node tests pass, static build succeeds, and git diff --check is clean. No deployment was performed.

## Follow-up: weekly league History and League C

League History now shows recorded gameweeks in descending order, cumulative standings and weekly GW/Bench scores. Daily snapshot selection and frontend snapshot loading have been removed; legacy snapshot URL parameters are ignored. Weekly movement arrows compare ranks with the previous GW, matching entry IDs before managers and preserving ties. GW1 or a missing previous week has no arrow. Current team names and crests remain in weekly tables.

League C is configured as 8024. Its published standings remain until a successful API sync; live access was not tested from this environment. Internal daily retention and refresh workflows are unchanged. All 57 tests pass, the static build succeeds, and diff whitespace checks are clean. The new History controls have regression tests across A-D, but no fresh browser/device capture was available. No deployment was performed.

League C local sync verified after the user ran npm run update-data: API data for league 8024 was saved at 2026-11-17T20:34:11.671Z, with five teams, 15 players per squad and gameweek 10. There were no standings refresh errors. Published transactions remain unavailable from the public API.

Post-sync checks exposed casing/accent differences in two League C API manager names. A shared comparison now ignores case and accents for confirmed manager joins, current branding, weekly results and movement. All five League C club links, 75 squad players, GW1-10 History and previous-GW ranks were verified against the downloaded data. All 58 tests pass.
