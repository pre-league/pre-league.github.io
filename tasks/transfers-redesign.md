# Transfers redesign plan

Make league Transfers answer “Who moved this gameweek?” and club Transfers answer “Who has this club brought in and released this season?” Both views can use the same completed moves, row design and ordering rules.

## Findings from the current app

| Observation | Consequence |
| --- | --- |
| The November 18 snapshot has 106, 55, 51 and 41 moves in leagues A through D. The league default ranks by the higher season points total of the two players. League D opens with GW5, GW8 and GW6 although it contains GW10 moves. | A returning reader must change the sort to see what happened recently. An outgoing player can determine which move appears “hottest.” |
| In the 1440px league capture, the gameweek is at the far left, the owner at the far right, and the player pair spans most of the panel. At 320px, each player still gets half a row with a 40px portrait. | Identifying the owner takes a sweep across the desktop row. On the phone, even “Verbruggen” breaks mid-word on the club page. |
| On Imperial FC’s current-season page, the transfer panel starts about 1,418 CSS pixels down at 320px wide and 1,566 at 1440px. League transfer links open the club overview. | Following a move to the club requires scrolling past the lineup to recover transfer context. |
| Rows contain season points and draft rank for each player. The model records accepted moves and has no points-earned-since-transfer field. Older club seasons have no transfer records. | Ranking copy and archive states must reflect what the snapshot can establish. |

Visual evidence comes from the existing League D captures and a fresh headless Edge inspection of Imperial FC at 320px and 1440px, both at 900px viewport height. These are design observations, without user-testing data.

## Proposed experience

**League.** Keep the existing Transfers tab and give the panel a stable heading, “League transfers.” Open on newest moves, grouped under gameweek headings with a move count. Put the linked club crest and name first in each row, with “Waiver” or “Free agent” beside it. When switching divisions from this tab, open Transfers for the chosen division and clear the previous division’s club filter.

**Club.** Add a “Transfers (4)” section link near the current-season club header, using the actual count when known. It opens the existing inline panel, gives its heading focus, and supports a direct URL. A league row’s club link lands at this same section. Keep gameweek and move type, omit the repeated club identity, and provide a route to the division’s Transfers tab. On historical seasons retain the existing archive availability message. For an unavailable current-season feed use “Transfers” without a count.

**One move on a phone.** Use the full row width for each name. Keep each incoming/outgoing pair together, with labels in text, a small portrait if space permits, and the move type outside the player lines. For example, the current League D data would read:

~~~text
Gameweek 8
Imperial FC                       Waiver
In    Verbruggen                  57 pts
Out   Lammens                     21 pts
~~~

Label the metric once per list as “Season FPL points.” On desktop, align Club / In / Out in adjacent columns, with the kind beneath the club name. On the club page the first column can carry the type. Keep points close to their player. Show draft rank as the primary number when sorting by rank. Keep both players’ points and ranks available in a native “Player details” disclosure when the default row omits a metric. Reuse existing portraits, crest fallbacks, dark panels and accent tokens. A missing photo must leave the name and direction readable.

**Finding moves.** Start with native Gameweek and Club selectors on the league view and Gameweek on the club view. Default to all available weeks and clubs. Show filtered and total counts and offer “Clear filters” for an empty match. Keep the sort selector and existing sort URLs. Label the alternatives “Highest season points” and “Best draft rank,” with a short note that either player can determine the order. In ranked mode use a single ordered list, include the gameweek on every row, and emphasize the value that sets the rank. Keep newest-first tie breaking and sort unknown values last. Keep transfer controls local to the panel since the header search navigates to club results.

## Delivery order and acceptance

1. **Ship the shared row and chronological default.** Update the shared renderer and order handling in `src/app.mjs` and scope the CSS to the transfer panel. Club search results reuse the existing transaction list classes. Check that the first league and club rows are their most recent moves, old sort links still work, and changing the sort keeps keyboard focus. At 320px, “Verbruggen” must fit on one line with the sample values above. At 1440px a reader must be able to associate each club with its player pair in one row.
2. **Connect the two views.** Support the club section via the existing hash router for both named clubs and team-ID fallback routes. Keep the season in the URL. A reader should reach Imperial FC’s transfer history from a League D move in one action. Verify direct load, browser Back, season changes and the current-season club header shortcut.
3. **Add filters and verify the full path.** Store valid filter selections with the existing hash parameters and restore them on reload. Validate selections against the active division and season. Distinguish unavailable data, a successful feed with zero moves, saved data after a failed refresh, and zero matching rows. Extend `test/app.test.mjs` for defaults, routes, filtering and these states. Check the 106-move league, a four-move club, missing metrics, keyboard focus, announced result counts and mobile bottom navigation in the browser.

All proposed interactions can use the saved snapshot and the existing static app. Points gained from a transfer would require historical points and ownership intervals, so the proposed metric is explicitly season FPL points.
