/* Local, deterministic teaching simulations. No network calls or Python execution. */
(function () {
  'use strict';
  const $ = (s, parent = document) => parent.querySelector(s);
  const $$ = (s, parent = document) => [...parent.querySelectorAll(s)];
  const json = object => JSON.stringify(object, null, 2);
  const arch = $('[data-architecture]');
  if (arch) {
    const descriptions = [
      'A consultant describes the task. The request supplies the intent; missing parameters must be clarified before an operation can run.',
      'The AI agent interprets intent and proposes a plan. LangGraph carries state and controls the route through validation and approval.',
      'LangGraph calls an allowed, validated tool. A reusable Python function prepares a Business Rule request using the configured parameters.',
      'Oracle EPM accepts the request and returns a job ID. The assistant monitors the job; acceptance alone does not establish success.',
      'Only a confirmed terminal success becomes a completed result. The assistant returns an understandable execution summary.'
    ];
    $$('[data-arch-node]', arch).forEach(node => node.addEventListener('click', () => {
      const i = Number(node.dataset.archNode);
      $$('[data-arch-node]', arch).forEach(n => n.setAttribute('aria-pressed', String(n === node)));
      $('[data-arch-count]', arch).textContent = String(i + 1).padStart(2, '0');
      $('[data-arch-detail]', arch).textContent = descriptions[i];
    }));
  }
  const graph = $('[data-graph-explorer]');
  if (graph) {
    let scenario = 'valid', position = -1;
    const next = $('[data-graph-next]', graph), nodes = $$('[data-graph-node]', graph);
    const route = () => scenario === 'valid' ? [0,1,2,4] : [0,1,3,4];
    const names = ['Request received','Validate the members','Call the rule tool','Ask for clarification','Return a structured result'];
    function render() {
      const path = route(), id = position < 0 ? -1 : path[position];
      const state = {operation:'run_rule',scenario:'Forecast',period:scenario === 'valid' ? 'Sep' : null};
      if (position >= 1) state.validated = scenario === 'valid';
      if (position >= 2 && scenario === 'valid') { state.job_id = 1042; state.status = 'submitted'; }
      if (position >= 2 && scenario === 'missing') { state.needs_input = 'period'; state.job_submitted = false; }
      if (position === path.length - 1) state.result = scenario === 'valid' ? 'Monitor job 1042' : 'Which period should I use?';
      $('[data-graph-state]', graph).textContent = json(state);
      nodes.forEach(node => { const n = Number(node.dataset.graphNode), at = path.indexOf(n), available = at !== -1; node.setAttribute('aria-pressed', String(n === id)); node.classList.toggle('visited', at >= 0 && at < position); node.style.opacity = available ? '1' : '.4'; node.setAttribute('aria-disabled', String(!available)); });
      $('[data-graph-step]', graph).textContent = position < 0 ? 'Ready to trace' : 'Step ' + (position + 1) + ' / ' + path.length;
      $('[data-graph-title]', graph).textContent = id < 0 ? 'One request. Two possible paths.' : names[id];
      const descriptions = {
        0:'The request becomes shared state: an operation, scenario and period. Every later node can read these values.',
        1:scenario === 'valid' ? 'Required members are present. The validation node records validated=true; a conditional edge chooses the rule tool.' : 'The period is missing. Validation records validated=false; the conditional edge selects clarification.',
        2:'The allowed mock tool submits the rule and adds a job ID to state. Submitted does not mean the calculation completed.',
        3:'Clarification asks for the missing period. The mock rule tool was skipped and no job was submitted.',
        4:scenario === 'valid' ? 'END returns the job ID for monitoring. The same state now contains both the original request and the submission result.' : 'END returns a clarification question. The caller must supply the missing period before making a new valid request.'
      };
      $('[data-graph-description]', graph).textContent = id < 0 ? 'Step through the graph, or select a node to inspect it. Try removing the period to see the route change.' : descriptions[id];
      next.disabled = position === path.length - 1;
      next.textContent = position === path.length - 1 ? 'Trace complete ✓' : 'Next step →';
    }
    nodes.forEach(node => {
      function choose() { const at = route().indexOf(Number(node.dataset.graphNode)); if (at !== -1) { position = at; render(); } }
      node.addEventListener('click', choose);
      node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    });
    $$('[data-graph-case]', graph).forEach(button => button.addEventListener('click', () => { scenario = button.dataset.graphCase; position = -1; $$('[data-graph-case]', graph).forEach(b => b.setAttribute('aria-pressed', String(b === button))); render(); }));
    next.addEventListener('click', () => { if (position < route().length - 1) position++; render(); });
    $('[data-graph-reset]', graph).addEventListener('click', () => { position = -1; render(); });
    render();
  }
  const api = $('[data-api-lab]');
  if (api) {
    let mode = 'plain';
    function payload() { const p = {jobType:'Rules',jobName:mode === 'plain' ? 'Revenue_Calculation' : 'Revenue_Calculation_RTP'}; if (mode === 'rtp') p.parameters = {Scenario:'Forecast',Period:'Sep',Year:'FY26'}; return p; }
    function clear() {
      $('[data-api-request]', api).textContent = json(payload());
      $('[data-api-status]', api).textContent = 'Awaiting simulated submission';
      $('[data-api-status]', api).removeAttribute('data-tone');
      $('[data-api-response]', api).textContent = '// Submit a request to inspect the response.';
      $('[data-api-note]', api).textContent = 'No connection to Oracle. Responses are illustrative teaching fixtures.';
    }
    $$('[data-api-mode]', api).forEach(b => b.addEventListener('click', () => { mode = b.dataset.apiMode; $$('[data-api-mode]', api).forEach(x => x.setAttribute('aria-pressed', String(x === b))); if (mode === 'plain' && $('[data-api-case]', api).value === 'invalid') $('[data-api-case]', api).value = 'accepted'; clear(); }));
    $('[data-api-case]', api).addEventListener('change', () => {
      if ($('[data-api-case]', api).value === 'invalid') { mode = 'rtp'; $$('[data-api-mode]', api).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.apiMode === mode))); }
      clear();
    });
    $('[data-api-send]', api).addEventListener('click', () => {
      const responseCase = $('[data-api-case]', api).value, state = $('[data-api-status]', api), output = $('[data-api-response]', api), note = $('[data-api-note]', api);
      if (responseCase === 'accepted') {
        state.textContent = 'HTTP 200 · request accepted'; state.dataset.tone = 'good';
        output.textContent = json({jobId:1042,status:-1,descriptiveStatus:'Processing'});
        note.textContent = 'Save jobId 1042. This fixture is still processing; poll the configured job-status endpoint for the terminal outcome.';
      } else if (responseCase === 'auth') {
        state.textContent = 'HTTP 401 · unauthorized'; state.dataset.tone = 'bad';
        output.textContent = json({error:'Unauthorized',jobSubmitted:false});
        note.textContent = 'Check the configured authentication and authorization. Do not retry blindly or log credentials.';
      } else {
        state.textContent = 'HTTP 400 · invalid runtime prompt'; state.dataset.tone = 'bad';
        output.textContent = json({error:'Invalid runtime prompt member',field:'Period',jobSubmitted:false});
        note.textContent = 'This failure fixture assumes the deployed rule does not accept the submitted Period member. Recheck its exact RTP configuration.';
      }
    });
    $('[data-api-reset]', api).addEventListener('click', () => { mode = 'plain'; $('[data-api-case]', api).value = 'accepted'; $$('[data-api-mode]', api).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.apiMode === 'plain'))); clear(); });
    clear();
  }
  const practice = $('[data-payload-practice]');
  if (practice) {
    const feedback = $('[data-practice-feedback]', practice);
    $('[data-practice-check]', practice).addEventListener('click', () => {
      const s = $('[data-practice-scenario]', practice).value, p = $('[data-practice-period]', practice).value, y = $('[data-practice-year]', practice).value;
      const good = s === 'Forecast' && p === 'Sep' && y === 'FY26';
      feedback.dataset.tone = good ? 'good' : 'bad';
      feedback.textContent = good ? '✓ Valid training payload: Scenario=Forecast, Period=Sep, Year=FY26. You can now pass these configured members to the helper.' : !s || !p || !y ? 'Choose all three members. A missing RTP must be clarified before submission.' : 'Recheck the scenario and exact member names. This training rule expects Forecast / Sep / FY26, rather than display labels or calendar-year numbers.';
    });
    $$('select', practice).forEach(s => s.addEventListener('change', () => { feedback.textContent = ''; feedback.removeAttribute('data-tone'); }));
  }
  const approval = $('[data-approval-lab]');
  if (approval) {
    const value = $('[data-approval-value]', approval), approve = $('[data-approval-approve]', approval), reject = $('[data-approval-reject]', approval);
    let decision = 'pending', revision = 1, calls = 0, current = 'Aug', previous = 'Aug';
    function render() {
      const rejected = decision === 'rejected', invalid = decision === 'invalid', accepted = decision === 'approved', pending = decision === 'pending';
      $('[data-approval-badge]', approval).textContent = accepted ? '✓ Approved + mock write' : rejected ? '× Rejected · ended' : invalid ? '! Validation failed' : revision > 1 ? 'Ⅱ Revised · review again' : 'Ⅱ Awaiting approval';
      approve.disabled = !pending; reject.disabled = !pending;
      $('[data-approval-current]', approval).textContent = current;
      // Changes remain available; any edit invalidates the previous decision and starts a new proposal.
      $$('[data-approval-step]', approval).forEach(el => {
        const i = Number(el.dataset.approvalStep);
        el.classList.toggle('done', i === 0 || (i === 1 && !pending) || (i === 2 && accepted) || (i === 3 && accepted));
        el.classList.toggle('current', (pending && i === 1) || (invalid && i === 2));
      });
      $('[data-approval-state]', approval).textContent = json({thread_id:'training-16',proposal_revision:revision,operation:'update_variable',name:'CurrentMonth',previous_value:previous,value:value.value,current_value:current,approved:accepted,write_calls:calls,route:pending ? 'interrupt' : rejected ? 'interrupt → END' : invalid ? 'revalidate → END' : 'revalidate → mock write → END',status:pending ? 'awaiting_approval' : invalid ? 'validation_failed' : accepted ? 'mock_completed' : 'cancelled'});
      const result = $('[data-approval-result]', approval);
      result.dataset.tone = accepted ? 'good' : 'bad';
      result.textContent = accepted ? 'Approved → revalidated → mock write → END. CurrentMonth is now ' + value.value + ' in this simulation. Exactly one mocked call was made.' : rejected ? 'Rejected → END. No write tool was called. CurrentMonth remains ' + current + ' in this simulation.' : invalid ? 'Approval received, but the new value failed validation. END without a write. Choose a valid member to create a new proposal.' : revision > 1 ? 'The proposal changed. Previous approval is cleared. Review this value and make a fresh decision.' : '';
    }
    approve.addEventListener('click', () => { if (decision !== 'pending') return; if (value.value === 'invalid') { decision = 'invalid'; calls = 0; } else { decision = 'approved'; calls = 1; current = value.value; } render(); });
    reject.addEventListener('click', () => { if (decision !== 'pending') return; decision = 'rejected'; calls = 0; render(); });
    value.addEventListener('change', () => { revision++; decision = 'pending'; calls = 0; previous = current; render(); });
    $('[data-approval-reset]', approval).addEventListener('click', () => { value.value = 'Sep'; decision = 'pending'; revision = 1; calls = 0; current = 'Aug'; previous = 'Aug'; render(); });
    render();
  }
})();
