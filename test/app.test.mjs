import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeLeague } from '../src/model.mjs';

const config = JSON.parse(await readFile(new URL('../data/config.json', import.meta.url), 'utf8'));
const sample = JSON.parse(await readFile(new URL('../data/league-d.json', import.meta.url), 'utf8'));
const community = JSON.parse(await readFile(new URL('../data/community.json', import.meta.url), 'utf8'));
const leagueD = normalizeLeague(sample, 10219);
leagueD.teams[0].benchPoints = 0;
leagueD.transactions = [
  { id: 3, gameweek: 10, teamId: 130177, kind: 'Free agent', playerIn: 'Newest player', playerOut: 'Legacy player' },
  { id: 2, gameweek: 9, teamId: 50027, kind: 'Waiver', playerIn: 'Top draft pick', playerOut: 'Former player', playerInDraftRank: 1, playerInPoints: 36 },
  { id: 1, gameweek: 8, teamId: 130177, kind: 'Waiver', playerIn: 'Another player', playerOut: 'Top scorer', playerOutDraftRank: 5, playerOutPoints: 95, playerInPhotoCode: 154561, playerOutPhotoCode: 118748 }
];
const latest = {
  divisions: { D: leagueD, A: { ...structuredClone(leagueD), leagueId: 3887, name: 'League A' } },
  history: ['2026-11-17'], errors: []
};

for (const division of ['A', 'D']) {
  test(`League ${division} starts and rerenders standings with the correct season rules`, async t => {
    const testCommunity = structuredClone(community);
    const testLatest = structuredClone(latest);
    const elements = Object.fromEntries(['#app', '#search', '#search-toggle', '#search-cancel', '#language-toggle', '#language-flag', '#language-indicator', '#divisions', '#pages', '#main', '#retry', '#stats-season', '#gameweek', '#club-season', '#historical-week', '#league-division', '#league-gameweek', '#transfer-order', '#transfer-week', '#transfer-club', '#transfer-heading', '#transfer-shortcut', '#transfer-count', '#transfer-results', '#transfer-metric', '#transfer-active', '#transfer-active-label', '#transfer-reset'].map(selector => [selector, {
      innerHTML: '', value: '', attributes: {}, listeners: {},
      addEventListener(name, handler) { this.listeners[name] = handler; }, focus() { this.focused = true; }, scrollIntoView() {}, getClientRects() { return [{}]; },
      getAttribute(name) { return this.attributes[name]; }, setAttribute(name, value) { this.attributes[name] = value; }
    }]));
    elements['#search'].dataset = { i18n: 'placeholder aria-label' };
    elements['#search'].attributes = { placeholder: 'Find a club', 'aria-label': 'Search teams and managers' };
    const preferences = new Map();
    const listeners = {};
    const globals = {
      document: { querySelector: selector => elements[selector] ?? null, querySelectorAll: () => [elements['#search']], documentElement: {}, title: '' },
      window: { addEventListener: (name, handler) => { listeners[name] = handler; } },
      location: { hash: `#league=${division}`, reload() {} },
      history: { replaceState(_state, _title, hash) { globalThis.location.hash = hash; } },
      localStorage: { getItem: key => preferences.get(key), setItem: (key, value) => preferences.set(key, value) },
      fetch: async path => {
        assert.ok(!path.includes('/data/history/'), 'Daily snapshots are not loaded by the UI');
        return { ok: true, json: async () => path.endsWith('config.json') ? config : path.endsWith('community.json') ? testCommunity : testLatest };
      }
    };
    const previous = Object.getOwnPropertyDescriptors(globalThis);
    for (const [name, value] of Object.entries(globals)) {
      Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    }
    t.after(() => {
      for (const name of Object.keys(globals)) {
        if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
        else delete globalThis[name];
      }
    });
    await import(`../src/app.mjs?regression=${division}`);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(elements['#app'].attributes['aria-busy'], 'false');
    assert.equal(elements['#main'].attributes['data-page'], 'league');
    assert.match(elements['#pages'].innerHTML, /data-nav="leagues"[^>]*aria-current="page"/);
    assert.match(elements['#pages'].innerHTML, />Home<\/span>/);
    assert.match(elements['#pages'].innerHTML, />Records<\/span>/);
    assert.doesNotMatch(elements['#app'].innerHTML, /taking a breather/);
    assert.match(elements['#app'].innerHTML, /Imperial FC/);
    assert.ok(elements['#app'].innerHTML.includes(`<h1>League ${division}</h1>`));
    assert.doesNotMatch(elements['#app'].innerHTML, /breadcrumb|division-heading/);
    assert.match(elements['#app'].innerHTML, /tab=standings" aria-current="page">Table/);
    assert.match(elements['#app'].innerHTML, /tab=transactions">Transfers/);
    assert.match(elements['#app'].innerHTML, />Bench<span class="sr-only"> points<\/span><\/th>/);
    assert.match(elements['#app'].innerHTML, /class="numeric bench-cell">0<\/td>/);
    assert.match(elements['#app'].innerHTML, /class="numeric bench-cell">—<\/td>/);
    assert.ok(elements['#app'].innerHTML.includes(`./assets/league/thumbs/${division}.webp`));
    assert.match(elements['#divisions'].innerHTML, /assets\/league\/thumbs\/A.webp/);
    assert.match(elements['#app'].innerHTML, /class="team-crest" src="\.\/assets\/crest\/thumbs\/130177.webp"/);
    assert.doesNotMatch(elements['#app'].innerHTML, /assets\/crest\/130734/);
    assert.doesNotMatch(elements['#app'].innerHTML, /assets\/crest\/130177.png/);
    assert.match(elements['#app'].innerHTML, division === 'A' ? /First place wins the PRE FTW League trophy/ : /There is no relegation from League D/);
    globalThis.location.hash = `#league=${division}&tab=standings`;
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /Standings/);
    assert.doesNotMatch(elements['#app'].innerHTML, /taking a breather/);
    globalThis.location.hash = `#league=${division}&tab=overview`;
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /tab=standings" aria-current="page">Table/);
    globalThis.location.hash = `#league=${division}&team=130177`;
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /team-badge color-\d large/);
    assert.match(elements['#app'].innerHTML, /assets\/crest\/thumbs\/130177.webp/);
    assert.match(elements['#app'].innerHTML, /id="transfer-shortcut"[^>]*season=2026%2F27&section=transfers">Transfers \(2\)/);
    assert.doesNotMatch(elements['#app'].innerHTML, /id="transfer-panel"/);
    globalThis.location.hash += '&section=stats';
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /aria-current="page" href="[^"]*&section=stats">Stats/);
    assert.doesNotMatch(elements['#app'].innerHTML, /id="transfer-panel"|class="lineup-pitch"/);
    globalThis.location.hash = `#league=${division}&team=130177&section=transfers`;
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /Gameweek 10[\s\S]*Newest player[\s\S]*Gameweek 8[\s\S]*Top scorer/);
    assert.doesNotMatch(elements['#app'].innerHTML, /Top draft pick/);
    globalThis.location.hash = `#league=${division}&tab=transactions`;
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /id="transfer-heading" tabindex="-1">League transfers<\/h2>[\s\S]*Gameweek 10[\s\S]*Newest player[\s\S]*Gameweek 9[\s\S]*Top draft pick[\s\S]*Gameweek 8[\s\S]*Top scorer/);
    assert.doesNotMatch(elements['#app'].innerHTML, /transfer-controls-club/);
    assert.match(elements['#app'].innerHTML, /id="transfer-week"[\s\S]*<details id="transfer-filters"[^>]*><summary>Filters<\/summary>[\s\S]*id="transfer-club"[\s\S]*id="transfer-order"[\s\S]*<\/details>/);
    assert.match(elements['#app'].innerHTML, /class="transfer-club"[^>]*href="[^"]*club=andre-neto&season=2026%2F27&section=transfers"[^>]*>[\s\S]*?thumbs\/130177\.webp[^>]*><\/span><span>Imperial FC<\/span>/);
    assert.deepEqual([...elements['#app'].innerHTML.matchAll(/class="player-headshot" src="[^"]*\/250x250\/(\d+)\.png"/g)].map(match => match[1]), ['154561', '118748']);
    assert.equal((elements['#app'].innerHTML.match(/class="player-avatar"/g) ?? []).length, 6);
    elements['#transfer-order'].listeners.change({ target: { value: 'rank' } });
    assert.match(elements['#transfer-results'].innerHTML, /<ol[\s\S]*Top draft pick[\s\S]*Top scorer[\s\S]*Newest player/);
    assert.match(elements['#transfer-results'].innerHTML, /transfer-value accent">#1/);
    assert.match(elements['#transfer-results'].innerHTML, /<summary>Player details<\/summary>[\s\S]*36 pts/);
    elements['#transfer-week'].listeners.change({ target: { value: '9' } });
    assert.equal(elements['#transfer-count'].textContent, '1 of 3 moves');
    elements['#transfer-club'].listeners.change({ target: { value: '130177' } });
    assert.equal(elements['#transfer-count'].textContent, '0 of 3 moves');
    assert.match(elements['#transfer-results'].innerHTML, /No transfers match[\s\S]*Clear filters/);
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /<option value="9" selected>GW 9/);
    assert.match(elements['#app'].innerHTML, /<option value="130177" selected>Imperial FC/);
    assert.match(elements['#app'].innerHTML, /<option value="#league=B&amp;tab=transactions">League B<\/option>/);
    assert.match(elements['#app'].innerHTML, /id="transfer-active-label">Imperial FC · Best draft rank/);
    elements['#transfer-reset'].listeners.click();
    assert.equal(elements['#transfer-count'].textContent, '3 of 3 moves');
    assert.equal(elements['#transfer-week'].focused, true);
    assert.equal(globalThis.location.hash, `#league=${division}&tab=transactions`);
    elements['#league-division'].listeners.change({ target: { value: '#league=B&tab=transactions' } });
    assert.equal(globalThis.location.hash, '#league=B&tab=transactions');
    await listeners.hashchange();
    assert.equal(elements['#league-division'].focused, true);
    globalThis.location.hash = `#league=${division}&tab=transactions&gw=38&club=123&sort=points`;
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /3 of 3 moves[\s\S]*<ol[\s\S]*Top scorer[\s\S]*Top draft pick[\s\S]*Newest player/);
    for (const hash of ['#page=club&club=andre-neto&season=2026%2F27&section=transfers', '#league=D&team=130177&season=2026%2F27&section=transfers']) {
      elements['#transfer-heading'].focused = false;
      globalThis.location.hash = hash;
      await listeners.hashchange();
      assert.equal(elements['#transfer-heading'].focused, true);
      assert.match(elements['#app'].innerHTML, /<h1>Imperial FC<\/h1>[\s\S]*id="transfer-heading" tabindex="-1">Imperial FC transfers<\/h2>/);
      assert.match(elements['#app'].innerHTML, /class="history-control transfer-controls transfer-controls-club"/);
      assert.match(elements['#app'].innerHTML, /id="transfer-filters"[\s\S]*id="transfer-order"/);
      const clubDivision = hash.startsWith('#page=') ? 'A' : 'D';
      assert.ok(elements['#app'].innerHTML.includes(`href="#league=${clubDivision}&tab=transactions">League ${clubDivision} transfers`));
      assert.doesNotMatch(elements['#app'].innerHTML, /id="transfer-club"/);
    }
    const fallbackTeam = testLatest.divisions.D.teams.find(team => team.id === 130177);
    const originalTeam = { ...fallbackTeam };
    Object.assign(fallbackTeam, { name: 'Imperial <FC> & Friends', manager: 'Unlisted manager' });
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /<h1>Imperial &lt;FC&gt; &amp; Friends<\/h1>[\s\S]*id="transfer-heading" tabindex="-1">Imperial &lt;FC&gt; &amp; Friends transfers<\/h2>/);
    Object.assign(fallbackTeam, originalTeam);
    const savedMoves = testLatest.divisions[division].transactions;
    globalThis.location.hash = `#league=${division}&tab=transactions`;
    testLatest.divisions[division].transactions = null;
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /Transfers unavailable/);
    globalThis.location.hash = `#league=${division}&team=130177&section=transfers`;
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /id="transfer-shortcut"[^>]*>Transfers<\/a>/);
    assert.match(elements['#app'].innerHTML, /Transfers unavailable/);
    testLatest.divisions[division].transactions = [];
    globalThis.location.hash = `#league=${division}&tab=transactions`;
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /0 of 0 moves[\s\S]*No completed transfers/);
    testLatest.divisions[division].transactions = savedMoves;
    testLatest.divisions[division].transactionsStale = true;
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /Showing saved transfers/);
    let removed = false;
    elements['#app'].listeners.error({ target: { matches: selector => selector === 'img.team-crest', remove: () => { removed = true; } } });
    assert.equal(removed, true, 'Missing crests reveal the initials fallback');
    removed = false;
    elements['#app'].listeners.error({ target: { matches: selector => selector === 'img.league-emblem', remove: () => { removed = true; } } });
    assert.equal(removed, true, 'Missing league emblems reveal the letter fallback');
    globalThis.location.hash = '';
    await listeners.hashchange();
    assert.match(elements['#pages'].innerHTML, /data-nav="home"[^>]*aria-current="page"/);
    assert.match(elements['#app'].innerHTML, /<h1>Divisions<\/h1>/);
    assert.doesNotMatch(elements['#app'].innerHTML, /<table/);
    globalThis.location.hash = '#page=stats';
    await listeners.hashchange();
    assert.match(elements['#pages'].innerHTML, /data-nav="stats"[^>]*aria-current="page"/);
    assert.match(elements['#app'].innerHTML, /Absolute Leader/);
    assert.match(elements['#app'].innerHTML, /Chelas City/);
    assert.doesNotMatch(elements['#app'].innerHTML, /thumbs\/null.webp|team=null/);
    globalThis.location.hash = '#league=B';
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /Published GW 10/);
    assert.match(elements['#app'].innerHTML, /Chelas City/);
    assert.doesNotMatch(elements['#app'].innerHTML, /team=null|thumbs\/null.webp|Sample standings/);
    globalThis.location.hash = '#league=C';
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /await a successful API sync/);
    assert.doesNotMatch(elements['#app'].innerHTML, /await the league ID/);
    for (const key of ['A', 'B', 'C', 'D']) {
      globalThis.location.hash = `#league=${key}&tab=history&snapshot=2026-11-17`;
      await listeners.hashchange();
      assert.match(elements['#app'].innerHTML, /Gameweek history/);
      assert.match(elements['#app'].innerHTML, /value="10" selected>GW 10/);
      for (let week = 1; week <= 10; week++) assert.ok(elements['#app'].innerHTML.includes(`>GW ${week}</option>`));
      assert.ok(elements['#app'].innerHTML.indexOf('>GW 10</option>') < elements['#app'].innerHTML.indexOf('>GW 1</option>'));
      assert.doesNotMatch(elements['#app'].innerHTML, /Daily snapshots|Snapshot date|snapshot=|id="snapshot"/);
      elements['#league-gameweek'].listeners.change({ target: { value: '2' } });
      assert.equal(new URLSearchParams(globalThis.location.hash.slice(1)).get('gw'), '2');
      assert.equal(new URLSearchParams(globalThis.location.hash.slice(1)).get('league'), key);
      await listeners.hashchange();
      assert.match(elements['#app'].innerHTML, /Standings at GW 2/);
      assert.match(elements['#app'].innerHTML, /value="2" selected>GW 2/);
      assert.match(elements['#app'].innerHTML, />Bench<span/);
      assert.doesNotMatch(elements['#app'].innerHTML, /Previous rank unavailable/);
      assert.match(elements['#app'].innerHTML, /class="movement up"/);
      assert.match(elements['#app'].innerHTML, /class="movement down"/);
      const leaderTotal = Math.max(...community.weekly[2][key].teams.map(team => team.totalPoints));
      assert.ok(elements['#app'].innerHTML.includes(`class="numeric points-cell">${new Intl.NumberFormat('en-GB').format(leaderTotal)}</td>`));
      globalThis.location.hash = `#league=${key}&tab=history&gw=38`;
      await listeners.hashchange();
      assert.match(elements['#app'].innerHTML, /Gameweek unavailable/);
      assert.doesNotMatch(elements['#app'].innerHTML, /class="panel standings"/);
    }
    const savedWeeks = testCommunity.weekly;
    testCommunity.weekly = {};
    globalThis.location.hash = '#league=D&tab=history';
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /No gameweeks saved yet/);
    assert.doesNotMatch(elements['#app'].innerHTML, /Snapshot date|id="snapshot"/);
    testCommunity.weekly = savedWeeks;
    globalThis.location.hash = '#league=B&tab=teams';
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /page=club/);
    assert.match(elements['#app'].innerHTML, /class="identity-row"/);
    globalThis.location.hash = '#page=stats&season=2025%2F26&gw=38';
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /1,931/);
    assert.match(elements['#app'].innerHTML, /Mike’s Cold One/);
    assert.match(elements['#app'].innerHTML, /Chelas City/);
    assert.doesNotMatch(elements['#app'].innerHTML, /team=null/);
    assert.match(elements['#app'].innerHTML, /assets\/crest\/thumbs\/15016.webp/);
    elements['#gameweek'].listeners.change({ target: { value: '33' } });
    assert.equal(new URLSearchParams(globalThis.location.hash.slice(1)).get('season'), '2025/26');
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /114<span>points/);
    elements['#stats-season'].listeners.change({ target: { value: config.season } });
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /Chelas City/);
    globalThis.location.hash = '#page=archive';
    await listeners.hashchange();
    assert.match(elements['#pages'].innerHTML, /data-nav="archive"[^>]*aria-current="page"/);
    assert.match(elements['#app'].innerHTML, /Pigui FC/);
    assert.match(elements['#app'].innerHTML, /assets\/crest\/thumbs\/15016.webp/);
    assert.match(elements['#app'].innerHTML, /Mike’s Cold One led his league/);
    assert.doesNotMatch(elements['#app'].innerHTML, /<strong>Mikes<\/strong>|Known as/);
    globalThis.location.hash = '#page=club&club=tiago-ferreira';
    await listeners.hashchange();
    assert.equal(elements['#main'].attributes['data-page'], 'club');
    assert.match(elements['#pages'].innerHTML, /data-nav="leagues"[^>]*aria-current="page"/);
    assert.match(elements['#app'].innerHTML, /Chelas City/);
    assert.match(elements['#app'].innerHTML, /id="club-season"/);
    elements['#club-season'].listeners.change({ target: { value: '2025/26' } });
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /Chelas City/);
    assert.doesNotMatch(elements['#app'].innerHTML, /Known as James/);
    assert.match(elements['#app'].innerHTML, /League 2/);
    assert.match(elements['#app'].innerHTML, /1,639/);
    assert.doesNotMatch(elements['#app'].innerHTML, /promotion-row|relegation-row|Starting XI/);
    assert.match(elements['#app'].innerHTML, /Historical lineups, transfers and bench scores were not supplied/);
    assert.doesNotMatch(elements['#app'].innerHTML, /id="transfer-shortcut"/);
    globalThis.location.hash = elements['#app'].innerHTML.match(/href="([^"]*page=competition[^"]*)"/)[1];
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /<h1>League 2<\/h1>/);
    assert.equal(elements['#main'].attributes['data-page'], 'competition');
    assert.match(elements['#pages'].innerHTML, /data-nav="leagues"[^>]*aria-current="page"/);
    assert.match(elements['#app'].innerHTML, /Miranda/);
    assert.match(elements['#app'].innerHTML, /club=goncalo-miranda/);
    assert.ok(elements['#app'].innerHTML.indexOf('value="38"') < elements['#app'].innerHTML.indexOf('value="1"'));
    assert.doesNotMatch(elements['#app'].innerHTML, /journal-report|Known as|Gameweek results/);
    assert.doesNotMatch(elements['#app'].innerHTML, /promotion-row|relegation-row|PRE FTW trophy/);
    assert.doesNotMatch(elements['#pages'].innerHTML + elements['#divisions'].innerHTML, /League [123]/);
    elements['#search'].value = 'Chelas City';
    elements['#search'].listeners.input();
    assert.match(elements['#app'].innerHTML, /Chelas City/);
    assert.doesNotMatch(elements['#app'].innerHTML, /<strong>James<\/strong>|<strong>GoncaBots<\/strong>/);
    elements['#search'].value = 'No matching club';
    elements['#search'].listeners.input();
    assert.match(elements['#app'].innerHTML, /No clubs match your search/);
    elements['#historical-week'].listeners.change({ target: { value: '33' } });
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /Gameweek 33/);
    globalThis.location.hash = '#page=club&club=tiago-ferreira&season=2025%2F26';
    await listeners.hashchange();
    elements['#search'].value = 'Miranda';
    elements['#search'].listeners.input();
    assert.match(elements['#app'].innerHTML, /Search clubs/);
    assert.match(elements['#app'].innerHTML, /Miranda/);
    assert.doesNotMatch(elements['#app'].innerHTML, />James<\/strong>/);
    globalThis.location.hash = '#page=club&club=tiago-ferreira&season=2025%2F26';
    await listeners.hashchange();
    elements['#club-season'].listeners.change({ target: { value: config.season } });
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /Current season/);
    assert.doesNotMatch(elements['#app'].innerHTML, /Known as James/);
    globalThis.location.hash = '#page=competition&league=A&season=2025%2F26';
    await listeners.hashchange();
    assert.match(elements['#app'].innerHTML, /Competition not found/);
    for (const from of ['', '#page=stats', '#page=archive', '#league=D', '#league=A&tab=transactions', '#league=D&team=130177', '#page=club&club=andre-neto', '#page=competition&league=1&season=2025%2F26']) {
      globalThis.location.hash = from;
      await listeners.hashchange();
      for (const term of ['Chelas City', 'Tiago Ferreira']) {
        elements['#search'].value = term;
        elements['#search'].listeners.input();
        assert.equal(globalThis.location.hash, from, 'Global search does not select a league or rewrite the current route');
        assert.match(elements['#app'].innerHTML, /Search clubs/);
        assert.match(elements['#app'].innerHTML, /Chelas City/);
        assert.match(elements['#app'].innerHTML, /League B/);
        assert.match(elements['#app'].innerHTML, /page=club&club=tiago-ferreira/);
        assert.doesNotMatch(elements['#app'].innerHTML, /Grannies FC/);
      }
      elements['#search'].value = 'Grannies';
      elements['#search'].listeners.input();
      assert.match(elements['#app'].innerHTML, /Grannies FC/);
      assert.match(elements['#app'].innerHTML, /League D/);
      elements['#search'].value = 'No matching club';
      elements['#search'].listeners.input();
      assert.match(elements['#app'].innerHTML, /No clubs match your search/);
      elements['#search'].value = '   ';
      elements['#search'].listeners.input();
      assert.equal(globalThis.location.hash, from);
      assert.doesNotMatch(elements['#app'].innerHTML, /Search clubs/);
    }
    elements['#search'].value = 'Micas';
    elements['#search'].listeners.input();
    assert.match(elements['#app'].innerHTML, /page=club&club=micas&season=2025%2F26/);
    assert.match(elements['#app'].innerHTML, /League 3 &middot; 2025\/26/);

    const searchRoute = location.hash;
    elements['#search-toggle'].listeners.click();
    assert.equal(elements['#search-toggle'].getAttribute('aria-expanded'), 'true');
    assert.equal(elements['#search'].focused, true);
    elements['#search-cancel'].listeners.click();
    assert.equal(elements['#search-toggle'].getAttribute('aria-expanded'), 'false');
    assert.equal(elements['#search-toggle'].focused, true);
    assert.equal(elements['#search'].value, '');
    assert.equal(location.hash, searchRoute);
    elements['#search-toggle'].listeners.click();
    elements['#search'].listeners.keydown({ key: 'Escape', preventDefault() {} });
    assert.equal(elements['#search-toggle'].getAttribute('aria-expanded'), 'false');

    assert.equal(elements['#language-flag'].getAttribute('src'), './assets/flag-gb.svg');
    const transferUrl = '#league=D&tab=transactions&club=130177&gw=8';
    globalThis.location.hash = transferUrl;
    await listeners.hashchange();
    elements['#language-toggle'].listeners.click();
    assert.equal(document.documentElement.lang, 'pt-PT');
    assert.equal(preferences.get('pre-ftw-language'), 'pt-PT');
    assert.equal(elements['#language-indicator'].textContent, 'PT');
    assert.equal(location.hash, transferUrl);
    assert.equal(elements['#language-flag'].getAttribute('src'), './assets/flag-pt.svg');
    assert.equal(elements['#search'].getAttribute('placeholder'), 'Procurar clube');
    assert.match(elements['#pages'].innerHTML, />Início<\/span>/);
    assert.match(elements['#app'].innerHTML, /Transferências da liga[\s\S]*1 de 3 transferências[\s\S]*Jornada 8[\s\S]*Imperial FC[\s\S]*Pedido prioritário/);
    for (const [hash, expected] of [
      ['#page=home', /<h1>Divisões<\/h1>/],
      ['#league=D&tab=standings', /<h2>Classificação<\/h2>/],
      ['#league=D&tab=history', /Histórico de jornadas/],
      ['#league=D&team=130177&section=transfers', /Transferências de Imperial FC[\s\S]*Liga D/],
      ['#page=stats', /Líder absoluto/],
      ['#page=archive', /Campeão da Liga 1/],
      ['#page=competition&league=1&season=2025%2F26', /<h1>Liga 1<\/h1>[\s\S]*aria-label="Classificação da Liga 1"/]
    ]) {
      globalThis.location.hash = hash;
      await listeners.hashchange();
      assert.match(elements['#app'].innerHTML, expected);
    }
    elements['#language-toggle'].listeners.click();
    assert.equal(preferences.get('pre-ftw-language'), 'en');
    assert.equal(document.documentElement.lang, 'en');
    assert.match(elements['#app'].innerHTML, /<h1>League 1<\/h1>/);
  });
}
