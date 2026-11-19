# PRE FTW mobile design, round two

**Handoff, 19 November 2026.** Start with the current working tree, including its uncommitted language and transfer work. The first redesign delivered the dark surfaces, compact pitch, readable standings and four bottom destinations. This pass puts the league, club or gameweek in charge of each screen and makes the new features use the same visual conventions.

[Current mobile screens](fotmob-mobile-baseline.jpg) · [Proposed table and transfer layouts](fotmob-mobile-target.svg)

## What still feels different

I reviewed ten rendered views in Edge device emulation, nine at 390 × 844 in English and League D Transfers at 320 × 740 in Portuguese. Measurements below are CSS pixels from the viewport top at default text size. The contact sheet shows the actual working tree. The earlier acceptance report predates global search, the Bench column, weekly history and several transfer and language changes. [Earlier results](results.md)

| Screen | Observed in PRE FTW | Design decision |
| --- | --- | --- |
| League D | The same crest appears in the title and directly below in a four-button switcher. Table tab, Standings heading, “Total points” subtitle and PTS column all introduce one table. First club row starts at **322px**. | Put division switching in the title. Let the column labels introduce the numbers. |
| League D, History, GW8 | Division metadata, a journal notice, a History panel, a week selector, then a second table panel. First club at **534px**. | Make the selected week the table toolbar. Put the linked source beside its status. |
| League D, Transfers | Three always-visible selects and several labels precede the first player at **585px**. At 320px in Portuguese it starts at **612px**. | Give gameweek a direct control. Put club and sort behind one labeled filter disclosure. Spend the recovered space on paired players. |
| Pigui FC | The crest, season toolbar, four metrics, results disclosure and standalone Transfers link precede the pitch at **605px**. | Group season and identity. Make the existing transfer deep link feel like a club section. Give the pitch its own clear heading and fewer surrounding boxes. |
| Home, Teams, Search | Home shows four separate cards and mainly navigation. Teams gives each club a large card. Search already shows seven compact identity rows for “FC”, using transaction-list CSS. | Use one club/division row pattern. Give Home a saved football result worth opening. |
| Stats and Records | Awards are three full cards with colored top edges. Archive champions already scan well in rows. | Bring that row rhythm to awards. Separate sporting facts, journal prose and source notes by typography. |

**FotMob reference.** In the publisher's dark MLS image the crest and league name lead into local tabs. Compact controls sit together above a table whose rank, crest and points repeat on stable axes. The match list groups several rows beneath a competition header. The lineup image makes the pitch the dominant surface. Use the phone content inside these images as the reference. The proposed sizes below are PRE FTW design targets. [Dark league table](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/1f/0d/73/1f0d7317-308a-ba98-8562-28f29afb977b/08.png/320x480bb.jpg) · [Grouped results](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/d5/e6/34/d5e63458-8860-ee38-0767-41a08a42ac30/01.png/320x480bb.jpg) · [Lineup](https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/80/1e/04/801e0498-c0c2-8a21-3e19-e1dddb03ceb6/04.png/320x480bb.jpg)

## The visual rules

- Use the existing near-black canvas and charcoal surfaces. Put a group of related rows on **one surface** with an 8–12px outer gutter, 12–16px internal inset and quiet dividers. Reserve separate cards for separate subjects. Rails and desktop groups can use the same treatment.
- Align rank, crest, primary name and right-aligned tabular values consistently. Start with 14–15px club/player names, 12–13px supporting text, 16–18px group titles and 22–24px entity titles. Aim for 48–56px identity rows, allowing names and zoomed text to grow. Keep at least 44px hit areas.
- Make the points total the strongest number in each standings row. Use green deliberately for selection, positive movement and incoming transfers. Use text or shape as well as color. Keep gold/red place semantics and the existing accessible legend. Preserve the photo size, shirt fallback and FPL point semantics already established on the pitch.
- Reduce repeated framing. Use a quiet season/week control, a single underline on the active section, and one disclosure style with a visible label and chevron. Use the dark resting surface for utility controls and a strong focus outline when navigating by keyboard. The target drawing uses placeholders for identity art and utility icons. Use real PRE FTW crests, portraits, accessible icons and the existing labeled bottom bar in production.

## Implementation order

### 1. Prove the direction on League D and History

Work in `src/app.mjs`, `styles.css` and `src/locale.mjs`. Make the current division name and chevron a single labeled switcher on mobile. Prefer a native select styled within the identity row, with the selected emblem adjacent. Reuse the existing division destination logic, including the rule for switching leagues from Transfers. Keep A–D visible in the desktop sidebar. The four existing section links sit immediately below the identity. Keep bookmarked overview and standings routes resolving to Table.

For Table, render the existing caption and column header with a compact source/team-count line. Remove the duplicate visible heading where the selected tab already identifies the table. For History, put the descending GW selector, season context and source alongside the same table. Both use the existing rank/movement, club, GW, Bench and PTS columns. Keep promotion and relegation in current divisions, the archived champion rule in historical competitions, ties, and the distinction between zero and unknown bench points. Preserve unsynced, missing-week and stale warnings inline with their data. Use weekly history and the existing GW query parameter.

**Visual checkpoint.** At 390 × 844, target first club by 250px on the ordinary League D table and 350px on GW8 History, with its source link visible. All four clubs and their PTS should fit across at 390px. At 320px and large text, prioritize names/points and allow the existing focusable table region to scroll if needed. Compare the current and proposed images side by side before propagating shared styles.

### 2. Put league and club transfers on the same footing

Reuse `transferView`, `transactions`, `transferResults`, `transferRow` and `bindTransferControls` in `src/app.mjs`. The chronology, scoring/rank sorts, filter URLs, gameweek groups, counts, player details and club deep links from the transfer plan **already exist**. Work on their presentation. [Transfer behavior](transfers-redesign.md)

- Keep Gameweek visible next to a native Filters disclosure containing Club and Sort on league pages, Sort on club pages. When closed, show the active club or non-default sort and a reset action when applicable. On a direct link, surface the active selections immediately. Keep the results count announced and focus on the changed control after updates.
- Use a low-contrast group header per GW, owner crest/name and move type on one line, then IN and OUT on aligned rows with portrait, name and points. Put season FPL points or draft rank once in the list header. In ranked mode retain per-move GW and the metric that explains the ordering. Keep secondary player details reachable with a native disclosure.
- On a club page omit repeated owner identity, keep the league backlink and retain `section=transfers` on both named club and numeric team URLs. Keep stale, empty, unavailable and no-match states distinct. Switching divisions discards a prior division's club filter.

**Pass when** a full move and its gameweek, owner, both players and values are visible above the bottom bar at 320 × 740 in EN and PT with filters closed. Aim for the first player by 350px at 390px. Changing rank/points/week/club still reproduces the same ordering and count on reload. Verify a long Portuguese label and a long surname in the same view.

### 3. Integrate club identity, lineup and search

In `src/clubs.mjs` and `teamPage` put the back link, club crest, title, manager and season selector together. Place the competition link and a compact **Transfers (count)** link directly below the identity. Use the existing club section route and heading focus. Place position and season points first in a single summary strip. Keep the other two metrics available alongside or on a second line at narrow widths. Move the collapsed weekly results below the lineup on current clubs. Historical clubs put their season results directly beneath the summary. Preserve each legacy team's actual fields and recorded season availability.

Give formation and GW one caption row. Extend the pitch toward the group edges, ease the field markings, and keep points attached below portraits. Check 3-, 4- and 5-player lines, full-name disclosure, substitutes, coach and missing photos. Target the start of Pigui's pitch by 390px on a 390px-wide phone, retaining a visible transfer entry before it. Leave the formation algorithm in `src/lineup.mjs` alone unless a display change actually needs markup.

In `index.html`, `src/app.mjs` and CSS, make search a compact labeled icon button on phones. Activating it expands the existing 16px search input across the bar and focuses it. A visible cancel button and Escape clear the query, restore the underlying route and return focus. Desktop keeps the field visible. In search mode show a result count, the existing club identity row and a separate accessible league/season link. Replace the dependency on `.transaction-list` so polishing transfers cannot alter search. Preserve global club/manager and historical-only results.

Give the language button a small visible EN/PT indicator with its existing translated action label and 44px target. Clarify whether the visible indicator names the current language (recommended) or destination, and use it consistently. Keep the stored preference, translated controls, `html.lang`, localized numbers/dates, user query and transfer filters across redraw. Supply every new string in `src/locale.mjs`, including control names and region labels. Test the existing historical standings region label and team-info division text in Portuguese as part of this pass.

### 4. Make Home, Teams, Stats and Records belong to the same app

| Surface | Proposed composition | Acceptance example |
| --- | --- | --- |
| Home | Short PRE FTW/season heading, then a grouped A–D list. Show the leading club and season points as the second line for each division with saved standings. Use each division's own GW/source context. Keep a meaningful pending state and links to Stats, Records and community documentation. | A returning reader sees who leads and can open their league in one tap. All four rows fit the first 390px-wide screen. A division with missing data shows its current status. |
| Teams | Replace the oversized two-part cards with crest/name/manager rows and a trailing rank or total. Put the other number on the supporting line. Use the same identity alignment as Search and Table. | League A's five clubs fit in one 390 × 844 viewport at default text size. Linked and unavailable clubs remain distinguishable and keyboard accessible. |
| Stats | Group the three awards under the selected GW. Each award leads with winner and score, followed by the award name, with definitions accessible in a disclosure. Put the leaderboard directly after awards. Give journal prose its own disclosure. | All tied winners still appear. Show partial coverage by the affected award and preserve the season/GW controls. Bench-unknown and zero read differently. |
| Records and historical competitions | Use a season heading, champion rows, record holders with right-aligned values, then stories and source links. Reuse the table/control styling on final and historical GW tables. | A reader can follow champion → season → historic table → club and return. Independent 2025/26 competitions retain their historical rules and branding. |

Primary files are `src/pages.mjs`, `src/app.mjs`, `src/clubs.mjs`, `src/locale.mjs` and `styles.css`. Use the existing data helpers and asset fallbacks. Desktop keeps its sidebar and highlights rail, with tighter alignment and the same grouped-list styles. Remove decorative rail slogans when actual league highlights already fill that space.

## Definition of done

1. Capture before/after at 390 × 844 for Table, History, league Transfers, current club, Home, Stats, Teams and search. Add PT at 320 × 740 for transfers and historic standings, a current club transfer deep link, and 1440px desktop Table and Transfers. Record the four vertical measurements from this review with the same routes and data. Treat long text, warnings and zoom as legitimate reasons for content to grow.
2. Walk Home → league → Transfers → filter → club Transfers → Back, and Stats → search → historical club → season standings. Run the first flow in Portuguese. Verify browser history, search cancellation, numeric team URLs, native selects, focus restoration, bottom safe area, failed-image fallbacks and 200% text sizing. Check keyboard access to secondary metrics and source links.
3. Run the existing `npm test` and `npm run build`. Extend `test/app.test.mjs` for search open/cancel, division switching and controls that move into a disclosure. Update renderer assertions in the existing page/club/lineup tests where markup changes. Preserve the scoring, weekly movement, filter, translation and missing-data assertions. Update documentation for the implemented navigation when it lands.

This plan is based on the working tree and published iPhone screenshots. The current-screen contact sheet uses Edge mobile emulation. Physical iPhone and Android interaction needs a separate device check during implementation.
