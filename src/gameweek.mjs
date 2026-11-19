import { gameweekLabel, t } from './locale.mjs';

export function weekControl(id, label, weeks, selected, leadingOption = '') {
  const arrow = (direction, symbol, name) => `<button type="button" id="${id}-${direction}" aria-controls="${id}" aria-label="${t(name)}">${symbol}</button>`;
  return `<div class="control-field week-field"><label for="${id}">${t(label)}</label><div class="week-stepper">
    ${arrow('prev', '&#8249;', 'Previous gameweek')}<select id="${id}">${leadingOption}${weeks.map(week => `<option value="${week}"${String(week) === String(selected) ? ' selected' : ''}>${gameweekLabel(week)}</option>`).join('')}</select>${arrow('next', '&#8250;', 'Next gameweek')}</div></div>`;
}

// Options run newest to oldest. A leading summary or placeholder is outside the GW sequence.
export function bindWeekButtons(id) {
  const select = document.querySelector(`#${id}`);
  const prev = document.querySelector(`#${id}-prev`);
  const next = document.querySelector(`#${id}-next`);
  if (!select || !prev || !next) return;
  const first = Number(select.options[0].value) > 0 ? 0 : 1;
  function sync() {
    prev.disabled = select.selectedIndex >= select.options.length - 1;
    next.disabled = select.selectedIndex <= first;
  }
  for (const [button, step] of [[prev, 1], [next, -1]]) {
    button.addEventListener('click', () => {
      select.selectedIndex += step;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      if (button.disabled) select.focus();
    });
  }
  select.addEventListener('change', sync);
  sync();
  return sync;
}
