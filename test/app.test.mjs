import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeLeague } from '../src/model.mjs';

const config = JSON.parse(await readFile(new URL('../data/config.json', import.meta.url), 'utf8'));
const sample = JSON.parse(await readFile(new URL('../data/league-d.json', import.meta.url), 'utf8'));
const community = JSON.parse(await readFile(new URL('../data/community.json', import.meta.url), 'utf8'));
const leagueD = normalizeLeague(sample, 10219);
leagueD.teams[0].benchPoints = 0;
const latest = {
  divisions: { D: leagueD, A: { ...structuredClone(leagueD), leagueId: 3887, name: 'League A' } },
  history: ['2026-11-17'], errors: []
};

for (const division of ['A', 'D']) {
  test(`League ${division} starts and rerenders standings with the correct season rules`, async t => {
    const testCommunity = structuredClone(community);
    const elements = Object.fromEntries(['#app', '#search', '#divisions', '#pages', '#main', '#retry', '#stats-season', '#gameweek', '#club-season', '#historical-week', '#league-gameweek'].map(selector => [selector, {
      innerHTML: '', value: '', attributes: {}, listeners: {},
      addEventListener(name, handler) { this.listeners[name] = handler; }, focus() {},
      setAttribute(name, value) { this.attributes[name] = value; }
    }]));
    const listeners = {};
    const globals = {
      document: { querySelector: selector => elements[selector] ?? null, title: '' },
      window: { addEventListener: (name, handler) => { listeners[name] = handler; } },
      location: { hash: `#league=${division}`, reload() {} },
      history: { replaceState(_state, _title, hash) { globalThis.location.hash = hash; } },
      fetch: async path => {
        assert.ok(!path.includes('/data/history/'), 'Daily snapshots are not loaded by the UI');
        return { ok: true, json: async () => path.endsWith('config.json') ? config : path.endsWith('community.json') ? testCommunity : latest };
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
    let removed = false;
    elements['#app'].listeners.error({ target: { matches: selector => selector === 'img.team-crest', remove: () => { removed = true; } } });
    assert.equal(removed, true, 'Missing crests reveal the initials fallback');
    removed = false;
    elements['#app'].listeners.error({ target: { matches: selector => selector === 'img.league-emblem', remove: () => { removed = true; } } });
    assert.equal(removed, true, 'Missing league emblems reveal the letter fallback');
    globalThis.location.hash = '';
    await listeners.hashchange();
    assert.match(elements['#pages'].innerHTML, /data-nav="home"[^>]*aria-current="page"/);
    assert.match(elements['#app'].innerHTML, /Welcome to PRE FTW League/);
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
    assert.match(elements['#app'].innerHTML, /View club/);
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
  });
}
