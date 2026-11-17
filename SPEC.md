# First release

## Welcome, weekly awards and documented history

Build order: documentation capture → welcome/head coach → weekly statistics →
verified historical import. Existing league and team hash links keep working.

| Capability | Behavior | Evidence |
| --- | --- | --- |
| Welcome | Root URL shows a short welcome with links to divisions, stats and records | User request |
| Head coach | Team lineup includes its manager's name outside the eleven and bench | Team manager field |
| Weekly stats | MVP = highest team GW points; Absolute Leader = highest season total; Unlucky = most bench points | User-confirmed definitions |
| Archive | Capture public Google Site pages and import supported season facts with source links | Documentation site; no inferred winners or results |

Awards compare all available divisions, retain joint winners, and label partial
coverage when a league or bench data is missing. Gameweek results from different
weeks must never be compared. History starts with verified source data; do not
invent past seasons. Add weekly score records to daily fetches so archived awards
can be selected by gameweek, preserving existing records on upstream failures.

The Google Site is currently inaccessible from the agent's web tool and local
outbound network. A read-only crawler can be run on the user's computer to save
same-site pages and their linked sources for inspection without changing the site.

PRE FTW League is a public, read-only tracker for four FPL Draft divisions.
League D (10219) is connected to the supplied league-details sample; League A
(3887) and League C (8024) are configured. League B awaits its ID. No invented players, fixtures or form results.

## Screens and design

- Division overview: standings, points, rank movement and weekly leaders.
- Teams: link to each manager's team, squad and gameweek player points.
- Transactions: published waivers/free agents where the endpoint permits it.
- History: all recorded gameweeks for the division, newest first. Select a GW
  to view positions by cumulative total, plus that week's GW and Bench points.
  Movement compares cumulative rank with the previous GW, matching teams by
  ID before manager; missing previous results keep movement unavailable.
  Daily snapshots serve internal sync retention, not public navigation; ignore
  legacy snapshot parameters. Missing gameweeks remain explicitly unavailable.
- Team detail: summary, starting XI, bench and owner; empty state before sync.
- Keep original team crests at `assets/crest/<entry_id>.png`. Build and preview
  startup generate transparent WebP thumbnails no larger than 192×192 using
  FFmpeg. The app loads `assets/crest/thumbs/<entry_id>.webp`, fitting the whole
  crest without cropping; missing images reveal initials. Generated thumbnails
  are ignored by Git, and original PNGs are excluded from the static deployment.
- League emblems use `assets/league/A.png` through `D.png`, sharing the same
  transparent 192px WebP generation and original-file exclusion. Show them in
  navigation, welcome division links and division headers. Missing images
  reveal division letters without altering the layout.
- The main crest at `assets/crest.png` generates `assets/crest.webp` for the
  header, sidebar, welcome page, competition hero and favicon. Fit the full
  image without stretching; keep the original PNG out of deployment.
- Lineups use a striped pitch with GK, DEF, MID and FWD rows, player shirt
  markers, names, clubs and gameweek points. Bench players remain outside
  the field. Use official player headshots when a valid photo code is present,
  and retain shirt fallbacks for missing codes or failed image loads. Infer
  formation counts from actual starting roles; do not invent
  left/right positions that the Draft API does not provide. Keep the full list
  expandable for long names and accessible reading on phones.
- Portraits are 64px on desktop and scale from 40–48px on phones, with a
  closer face crop, points below the portrait and readable name/club labels.
  Try the larger official image first, then the original portrait once, then
  the shirt fallback; image errors must not cause retry loops.
- References: FotMob Premier League overview and Arsenal team page, inspected
  2026-11-17. Use compact data tables, section navigation and team identity.
- Dark neutral surfaces, green accent, original PRE FTW identity and initials
  badges; external images are limited to official Premier League headshots.
  No external fonts, FotMob assets or dependencies.
- Desktop (768px+): sidebar navigation, main table and weekly highlights rail.
  Mobile: compact 56px app bar with 16px search input, fixed Home/Leagues/Stats/
  Records links, safe-area/content spacing, and a four-item A–D switcher only
  in league context. Keep the same navigation tree at both breakpoints.
- One compact league header replaces repeated competition/division identities.
  Display Table/Teams/Transfers/History using existing standings/teams/
  transactions/history route keys. Overview remains a Table alias. Leagues in
  global navigation preserves the last current division and defaults to A.
- Search is global across current divisions and historical-only clubs. It keeps
  the current route while showing results and restores that page when cleared.
  Results use current branding and link to each club and its competition.
- Standings include gameweek Bench points, using explicit known totals or four
  scored substitutes from the same gameweek. Missing data stays unavailable.
  Use the same calculation as the Unlucky award; never sum a partial bench.
- Phone tables use 14px club names and points, 12px secondary text, restrained
  place strips and full legends. Summary cards use two columns on phones.
  Pitch height responds to width (about 380–440px) without changing formations
  or obscuring five-player rows. Award headings keep score and title together.
- Native links/buttons, visible keyboard focus, labelled controls, useful loading,
  empty and error states, reduced-motion support. No page-wide horizontal scroll.

## Data and deployment

Static HTML/CSS/ES modules on GitHub Pages. Node 20+ built-ins fetch public
Draft endpoints daily through GitHub Actions. Browsers only fetch same-origin
saved JSON, avoiding FPL CORS and login requirements for visitors.

Refresh preserves previous data on upstream failures, labels its age and fails
the scheduled job when a configured league cannot refresh. Optional squad or
transaction failures are visible separately. Snapshots start when fetching works;
past daily snapshots cannot be reconstructed from the supplied standings.
League IDs live in one JSON configuration file. Hash routes work under any
GitHub Pages repository path. Top two teams move up except in League A;
bottom two move down except in League D. League A's first team wins the PRE
FTW League trophy. Mark projected places using full table order, with green/red/gold styling
and a legend.
Keep row status labels screen-reader-only to avoid repeating the legend visually.

Community documentation supplies sourced GW1–10 scores for 19 teams, journal
reports, previous division champions, a separate Liga Fantasia podium and
historical records. Derive weekly points from consecutive published totals;
never infer unreported bench scores. API scores override published scores for
the same week/division, and documentary data is limited to its matching season.
Until successful API refreshes, published standings remain labelled with the
report gameweek and source; unavailable team IDs must not produce squad links. The
2025/26 workbook supplies all 16 final standings and 608 weekly team scores.
Each 38-week sum must match its published final total. The stats season selector
supports all 38 historical gameweeks across League 1/2/3, preserving nicknames and
keeping unavailable bench totals and team IDs unknown.

## Trust boundaries and checks

Club profiles link the 14 user-confirmed identities across seasons using stable
club keys, independent of FPL entry IDs. Confirmed manager comparisons ignore
case and accents so API spelling variants keep the same club history. DT/Micas remain historical-only.
In 2025/26, League 1/2/3 were standalone leagues with no promotion/relegation;
store them under numeric league keys. A club season selector shows its points,
position and weekly results and links to that season's competition. Historical
tables and gameweek standings are reached through club profiles, not competition
menus. Keep only A–D in division navigation; the record book has no old tables.
Use current club names and crests throughout historical views; source aliases
serve only as identity joins and never appear in "Known as" labels. Historical
league pages show standings and a gameweek selector ordered newest first.
Missing historical squads, bench scores or team IDs must remain unavailable.

API JSON and URL parameters are untrusted. Validate IDs, numeric scores,
relationships and payload shapes. Escape API text before inserting HTML.
Use fixed HTTPS API origin, request timeouts, read-only public endpoints and
minimal workflow permissions. Never include authentication or private tokens.

Use Node's built-in tests for ID joins, missing scores, payload rejection,
snapshot preservation and partial upstream failures. Check the static build and
browser runtime if available. Network and Git permissions may limit local checks.
