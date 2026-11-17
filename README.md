# PRE FTW League

A responsive, FotMob-inspired tracker for four FPL Draft divisions. Built with
HTML, CSS and JavaScript modules, with no third-party JavaScript dependencies.

## Run locally

Requires Node.js 20 or newer and FFmpeg on PATH. No npm installation step is
needed. The preview generates optimized crest thumbnails before starting.

```sh
node scripts/serve.mjs
```

Open **http://127.0.0.1:4173**. Keep the terminal running and refresh the browser
after edits. Stop the server with Ctrl+C. If the port is already in use, use
the existing server or choose another port in PowerShell:

```powershell
$env:PORT = '4174'
node scripts/serve.mjs
```

Opening `index.html` directly with a file URL does not work; modules and saved
JSON need HTTP.

### Test on a phone

Stop the running server with Ctrl+C, then enable access from your local network:

```sh
node scripts/serve.mjs --lan
```

On the same Wi-Fi, open `http://<your-PC-IP>:4173/` on the phone, for example
`http://192.168.1.4:4173/`. Keep the PC and server running. If Windows Firewall
prompts, allow Node.js on your trusted Private network. The default command
without `--lan` listens only on the PC itself. The LAN option exposes only
the preview's public assets and saved league data, not the repository files.

## Included

- A simple welcome homepage, with links to the divisions, stats and record book.
- Gameweek stats across connected leagues: Week's MVP (most GW team points),
  Absolute Leader (most season points), and Unlucky (most bench points).
  Joint winners are retained, and missing league/bench data is labelled.
- Division standings, weekly highlights and official rank movement.
- Promotion places in green, relegation places in red, and League A's trophy
  place in gold. Top two go up (except A), bottom two go down (except D).
  Status text stays in the legend, with no repeated badges beneath team names.
- Search by team or manager, team cards and shareable team pages.
- Club profiles with season selectors, confirmed cross-season identities,
  weekly results, league position and links to that season's competition.
- A pitch lineup with formation, player positions and gameweek point badges;
  substitutes sit below the pitch and the full player list can be expanded.
- A Head Coach section under each lineup using the team's manager name.
- Official Premier League headshots where available, with shirt fallbacks.
  Larger portraits use a closer face crop with points below the image. If a
  large photo is unavailable, the original image is tried before the shirt.
  Run `npm run update-data` once to add photo codes to older saved squads;
  later scheduled syncs include them automatically. Images load from
  `resources.premierleague.com`; missing or failed images show the fallback.
- Completed public waivers/free-agent moves when accessible without login.
- Daily snapshot selector, update timestamps and stale-data indicators.
- Phone and desktop layouts, keyboard controls and reduced-motion support.
- GitHub Actions testing, daily refresh and GitHub Pages deployment workflow.

| Division | Draft league ID | Initial state |
| --- | --- | --- |
| A | 3887 | Configured, awaiting first sync |
| B | Pending | Awaiting league ID |
| C | Pending | Awaiting league ID |
| D | 10219 | Four teams from the supplied standings |

League D starts with the user's API response, preserved in `data/league-d.json`.
It is labelled as sample data: no verified fetch time or gameweek number.
No players, fixtures or previous seasons have been invented. Table markings
show current projections for next season, not finalized promotion/relegation.

## Update data

### Team crests

Add original crests at `assets/crest/<teamID>.png`, using the public team `id`
shown on the team page (not `leagueEntryId`). For example, `15016.png` belongs
to Pigui FC. Crests appear in standings, team cards, highlights and team pages;
missing images fall back to initials.

Each build and preview startup uses FFmpeg to generate transparent WebP
thumbnails bounded by 192×192 pixels, preserving the full image's aspect ratio.
Generated files live in `assets/crest/thumbs/` and are ignored by Git. Original
PNGs remain untouched and are excluded from the Pages build. The browser loads
only the thumbnails. Deleted crests lose their generated thumbnails on the next
build. A failed conversion stops the build rather than deploying broken assets.

When adding PNGs while the preview is already running, run `npm run build`,
then refresh the browser, or restart the preview to generate them automatically.
GitHub Actions installs FFmpeg and regenerates thumbnails on every build;
there is no manual thumbnail step before deployment.

League emblems use `assets/league/A.png` through `D.png`. The same build and
preview process generates `assets/league/thumbs/<letter>.webp`; originals stay
untouched and are excluded from deployment. Emblems appear in division navigation,
welcome links and division headers, with letter fallbacks for missing images.

The main PRE FTW crest is `assets/crest.png`. Builds and preview startup create
`assets/crest.webp` with the same aspect-ratio and transparency preservation.
The header, sidebar, welcome screen, competition hero and favicon use this
optimized image; the original PNG stays unchanged and is not deployed.

### Fetch standings and squads

```sh
npm run update-data
```

The updater makes read-only, unauthenticated requests to
`https://draft.premierleague.com/api/`:

- `game`, `bootstrap-static` and `event/{gw}/live`
- `league/{leagueId}/details`
- `entry/{entryId}/event/{gw}`
- `draft/entry/{entryId}/transactions` (completed results only)

Browsers read saved same-origin JSON instead of contacting FPL directly.
Standings join `standings[].league_entry` to `league_entries[].id`; squad and
transaction requests use the separate `league_entries[].entry_id`.

Add the remaining numeric IDs in **`data/config.json`** and refresh. Do not use
invitation codes or add passwords, cookies or tokens.

`data/latest.json` stores display data. Successful refreshes save one daily
snapshot in `data/history/YYYY-MM-DD.json` (UTC). League fetch failures preserve
previous standings and return a failing exit code; optional squad/transaction
failures are reported separately. Each division retains its own update time.
Player points are not summed to replace official team totals.

The `weekly` field also retains one score record per team/division/gameweek
for the stats selector. It starts with the verified current snapshot, and daily
syncs preserve previous weeks. Old gameweeks that were never captured are not
fabricated. Bench scores use the official value when supplied, otherwise the
sum of four known bench player scores; incomplete benches remain unavailable.

## Documentation and historical seasons

The community site is https://sites.google.com/view/prefantasydraft.
To save its reachable public pages for historical import, run:

```sh
npm run crawl-docs
```

The read-only crawler saves raw HTML and an indexed source manifest in
`.tmp-preview/documentation/`. It stays within that Google Site, follows links
once, includes the supplied GW10 and 2025/26 pages, records inaccessible pages,
and stops at 200 pages with an explicit incomplete result if needed. It never
publishes raw HTML or changes the Google Site. Run it from a terminal with
internet access; this agent's outbound requests were blocked.

`data/community.json` contains the verified import from 19 reachable pages:
ten 2026/27 reports, 190 team/gameweek score records across all four divisions,
the three 2025/26 league champions, the separate Liga Fantasia podium, six
records and three season stories. Each report and historical record retains
its source link. GW points are differences between consecutive published
cumulative totals; bench scores are included only where published or confirmed
by the league (including Rodrigo's GW1 18 and André's GW2 13).
Missing bench totals remain unknown, and tied scores retain joint winners.

API scores take priority for the same division and gameweek. Published weeks
fill gaps only when their season matches the configured season. B/C currently
show published GW10 standings while their API IDs are pending. Their clubs have
profiles and historical results, while squads await API access. No team IDs
are invented. New gameweeks never mix scores from earlier weeks.
The journal's original prose is preserved; promotion markings follow the
user-confirmed two-up/two-down rules, even where old articles differ.

In 2025/26, League 1, League 2 and League 3 were standalone competitions, with
champions Pigui, Miranda and Mikes. No promotion or relegation applied; the
A–D division system starts in 2026/27. All 16 final standings and 608
team/gameweek scores have been imported from its public workbook. Each team's
38 weekly scores was checked against its published final total. Historical
nicknames are retained; unreported bench scores and team IDs remain unavailable.
The stats page's season selector switches between 2026/27 and all 38 weeks of
2025/26, with three independent leagues for the historical season.

`community.clubs` stores stable club keys and the 14 user-confirmed returning
managers' historical nicknames. Current FPL entry IDs remain separate. DT and
Micas have historical-only profiles; their current identities are unconfirmed.
Current club names and crests are used across all seasons, including historical
profiles, standings, awards and records. Historical aliases remain in the source
data only to join the confirmed identities; no "Known as" labels are displayed.
Profiles show final/current position, points, average/best saved gameweek,
and expandable weekly results. Only recorded seasons are selectable.

Open a club, select 2025/26, then click its League 1/2/3 link to see final or
gameweek standings, with the latest gameweeks first in the selector. Historical
competition pages show standings rather than reports. Tables link back to club profiles, have league
champion markings, and have no promotion/relegation styling or A–D emblems.
Historical leagues are absent from menus. The record book retains champions
and records without publishing a second directory of historical tables.

The source's images return HTTP 403, but its full spreadsheet is downloadable.
To capture the workbook again without retrying those images, run:

```sh
node scripts/capture-history.mjs --workbook
```

This saves `history-workbook.xlsx` and a manifest under
`.tmp-preview/documentation/` without publishing original files. The verified
display data is already in `data/community.json`; no download is needed to
view it or build the app.

Root and `#page=home` open the welcome screen; `#page=stats` opens weekly awards
and `#page=archive` opens the record book. Club links use
`#page=club&club=miguel-fernandes&season=2025%2F26`; historical competitions use
`#page=competition&league=1&season=2025%2F26`, with optional `gw=1` through `38`.
Existing `#league=A` and numeric team links remain supported. Restart the preview
after this update to serve the new club module and community data file.

Public access and optional endpoint payloads still need verification against
the real leagues. Local outbound requests were blocked by the execution
environment. Tests cover normal operation and partial/offline failures.

## Checks and build

```sh
npm test
npm run build
```

Node's built-in tests cover ID joins, payload validation, escaping, missing and
negative points, failed refresh preservation, preview path safety and real
FFmpeg thumbnail generation. FFmpeg/ffprobe are required for the image test.
The build copies public assets and data into `dist/` and checks the output.

## Publish to GitHub Pages

1. Push this repository to GitHub on branch `main`.
2. In **Settings → Pages**, select **GitHub Actions** as the build source.
3. Allow Actions to write repository contents for saved data commits.
4. Run **Test, refresh and publish** from Actions for the first API fetch.

The workflow tests and publishes pushes to `main`, and refreshes daily at
**06:17 UTC**. Schedules can be delayed; the site displays the actual update
time. Public-repository schedules may be disabled after 60 days of inactivity.
Manual runs can refresh the data too.

An incomplete refresh still deploys retained data, then marks the workflow
failed so the issue is visible. If branch rules block its snapshot commit,
the save step fails; adjust those rules or use an allowed update branch.
To roll back, revert the relevant source/data commit and push again.

Hash routes and relative assets support `<owner>.github.io/<repository>/`.
No remote repository or public deployment has been created here.

## Still to confirm

- League B/C IDs.
- Public squad/transaction access, including any season API changes.
- GitHub owner/repository name for publication.

See `SPEC.md` for design and implementation decisions. PRE FTW has its own
crest, initials badges and copy; no FotMob assets are included.
