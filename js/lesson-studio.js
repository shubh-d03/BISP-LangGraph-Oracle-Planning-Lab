/* Content lives in each static lesson's JSON block.
   This renderer traces deterministic fixtures; it is not a graph runtime. */
(function () {
  'use strict';
  const root = document.querySelector('[data-lesson-studio]');
  const source = document.getElementById('lesson-studio-data');
  if (!root || !source) return;
  let data;
  try { data = JSON.parse(source.textContent); } catch (_) { return; }
  const $ = selector => root.querySelector(selector);
  const select = $('[data-studio-case]');
  const path = $('[data-studio-path]');
  const next = $('[data-studio-next]');
  let caseIndex = 0, position = -1;
  const visitedCases = new Set();
  const current = () => data.cases[caseIndex];
  function stateAt(index) {
    const c = current(), state = Object.assign({}, c.initial);
    for (let i = 0; i <= index; i++) Object.assign(state, c.steps[i].patch);
    return state;
  }
  function render() {
    const c = current(), state = stateAt(position);
    $('[data-studio-state]').textContent = JSON.stringify(state, null, 2);
    $('[data-studio-request]').textContent = c.request;
    $('[data-studio-position]').textContent = position < 0 ? 'Ready to explore' : 'Stage ' + (position + 1) + ' of ' + c.steps.length;
    $('[data-studio-title]').textContent = position < 0 ? 'Inspect the sequence' : c.steps[position].name;
    $('[data-studio-description]').textContent = position < 0 ? 'Choose a stage to inspect a simulated snapshot. Use Next step to follow this case in order.' : c.steps[position].explain;
    [...path.querySelectorAll('button')].forEach((button, index) => {
      button.setAttribute('aria-pressed', String(index === position));
      button.classList.toggle('visited', index < position);
      button.dataset.tone = c.steps[index].tone;
      button.querySelector('.studio-stage-state').textContent = index > position ? 'Inspect stage' : index === position ? (c.steps[index].tone === 'blocked' ? 'Stopped here' : c.steps[index].tone === 'skipped' ? 'Skipped' : c.steps[index].tone === 'waiting' ? 'Awaiting input / evidence' : 'Current snapshot') : c.steps[index].tone === 'blocked' ? 'Failure / stop evidence' : c.steps[index].tone === 'skipped' ? 'Not executed' : c.steps[index].tone === 'waiting' ? 'Pause point' : 'Earlier snapshot';
    });
    const finished = position === c.steps.length - 1;
    next.disabled = finished;
    next.textContent = finished ? 'Trace complete' : 'Next step';
    if (finished) visitedCases.add(caseIndex);
    if (data.kind === 'suite') $('[data-studio-help]').textContent = visitedCases.size + ' of ' + data.cases.length + ' fixtures explored. Run the matching acceptance cases against your own Python assistant and retain its evidence.';
  }
  function makePath() {
    path.replaceChildren();
    current().steps.forEach((step, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'studio-stage';
      const icon = document.createElement('span'); icon.className = 'studio-stage-icon'; icon.setAttribute('aria-hidden','true');
      icon.textContent = ({pipeline:'◇',router:'⑂',conversation:'···',monitor:'◷',architecture:'{ }',suite:'✓',inspect:'{ }',compare:'◇',api:'{ }'})[data.kind] || '◇';
      const text = document.createElement('span'); text.className = 'studio-stage-name'; text.textContent = step.name;
      const badge = document.createElement('small'); badge.className = 'studio-stage-state';
      button.append(icon,text,badge); button.addEventListener('click', () => { position = index; render(); }); path.append(button);
    });
  }
  select.addEventListener('change', () => { caseIndex = Number(select.value); position = -1; makePath(); render(); });
  next.addEventListener('click', () => { if (position < current().steps.length - 1) position++; render(); });
  $('[data-studio-reset]').addEventListener('click', () => { position = -1; render(); });
  makePath(); render();
})();
