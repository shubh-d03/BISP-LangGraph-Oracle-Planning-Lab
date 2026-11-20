/* Offline lesson narration plus optional local English device voices.
   No microphone, external speech service, framework or content fetch. */
(function () {
  'use strict';
  const root = document.querySelector('[data-voice-help]');
  const data = document.getElementById('voice-help-data');
  if (!root || !data) return;
  let lesson;
  try { lesson = JSON.parse(data.textContent); } catch (_) { return; }
  const $ = selector => root.querySelector(selector);
  const audio = $('[data-voice-audio]'), play = $('[data-voice-play]');
  const partSelect = $('[data-voice-part]'), voiceSelect = $('[data-voice-choice]');
  const rateSelect = $('[data-voice-rate]'), seek = $('[data-voice-seek]');
  const status = $('[data-voice-status]'), clock = $('[data-voice-clock]');
  const key = 'bisp-narration-v1';
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  const supportsSpeech = synth && typeof window.SpeechSynthesisUtterance === 'function';
  const parts = lesson.parts, rates = [0.8, 1, 1.15, 1.3, 1.5];
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) {}
  rateSelect.value = String(rates.includes(Number(prefs.rate)) ? Number(prefs.rate) : 1);
  let localVoices = [], queue = [0, 1, 2], queuePos = 0;
  let state = 'idle', generation = 0, pendingSeek = null, loadedPart = -1;
  let pieces = [], pieceIndex = 0, pieceOffset = 0, boundary = 0;
  let utterance = null, startTimer = null, pickedVoice = false, dragging = false;
  const isDevice = () => voiceSelect.value !== 'audio';
  const rate = () => Number(rateSelect.value);
  const currentPart = () => queue[queuePos];
  function savePrefs() {
    prefs = {rate:rate(),voice:voiceSelect.value};
    try { localStorage.setItem(key, JSON.stringify(prefs)); } catch (_) {}
  }
  function duration() { return queue.reduce((sum, n) => sum + parts[n].duration, 0); }
  function timeText(seconds) {
    seconds = Math.max(0, Math.floor(seconds || 0));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2,'0');
  }
  function cancelSpeech() {
    clearTimeout(startTimer); startTimer = null;
    if (supportsSpeech && utterance) synth.cancel();
    utterance = null;
  }
  function progress() {
    if (isDevice()) {
      seek.hidden = true; $('[data-voice-device-progress]').hidden = false;
      const value = state === 'ended' ? pieces.length : pieceIndex;
      $('[data-voice-device-progress]').max = Math.max(1,pieces.length);
      $('[data-voice-device-progress]').value = value;
      clock.textContent = state === 'ended' ? 'Explanation finished' : pieces.length ? 'Passage ' + Math.min(pieceIndex + 1,pieces.length) + ' of ' + pieces.length : 'Ready to listen';
    } else {
      seek.hidden = false; $('[data-voice-device-progress]').hidden = true;
      let elapsed = state === 'idle' ? 0 : queue.slice(0,queuePos).reduce((sum,n) => sum + parts[n].duration,0) + (pendingSeek ? pendingSeek.time : audio.currentTime || 0);
      if (state === 'ended') elapsed = duration();
      if (!dragging) seek.value = String(Math.min(100,elapsed / duration() * 100));
      seek.setAttribute('aria-valuetext',timeText(elapsed) + ' of ' + timeText(duration()));
      clock.textContent = timeText(elapsed) + ' / ' + timeText(duration());
    }
  }
  function render(message) {
    root.dataset.voiceState = state;
    const active = state === 'playing', waiting = state === 'loading';
    play.disabled = waiting;
    play.textContent = active ? 'Pause explanation' : state === 'paused' ? 'Resume explanation' : waiting ? 'Starting audio…' : 'Play explanation';
    play.setAttribute('aria-pressed',String(active));
    $('[data-voice-stop]').disabled = state === 'idle';
    $('[data-voice-current]').textContent = parts[currentPart()].title;
    const nextStatus = message || ({idle:'Ready when you are.',loading:'Starting the selected explanation…',playing:'Playing: ' + parts[currentPart()].title,paused:'Paused. Resume when you are ready.',ended:'Finished. Replay any part or return to the lesson.',error:'Playback could not start. Read the transcript or try the included narrator.'})[state];
    if (status.textContent !== nextStatus) status.textContent = nextStatus;
    root.querySelectorAll('[data-voice-transcript-part]').forEach(el => {
      const selected = Number(el.dataset.voiceTranscriptPart) === currentPart() && ['playing','paused','loading'].includes(state);
      el.classList.toggle('voice-current',selected);
      if (selected) el.setAttribute('aria-current','true'); else el.removeAttribute('aria-current');
    });
    progress();
  }
  function halt() {
    generation++; state = 'idle'; pendingSeek = null;
    audio.pause(); cancelSpeech();
    try { audio.currentTime = 0; } catch (_) {}
    queuePos = 0; pieceIndex = 0; pieceOffset = 0; boundary = 0;
  }
  function fail(message) {
    generation++; state = 'error'; pendingSeek = null; audio.pause(); cancelSpeech(); render(message);
  }
  function loadAudio(offset = 0, shouldPlay = true) {
    const token = ++generation;
    state = shouldPlay ? 'loading' : 'paused'; audio.pause(); cancelSpeech();
    loadedPart = currentPart(); pendingSeek = {token,time:offset};
    audio.src = parts[loadedPart].audio; audio.playbackRate = rate(); audio.load();
    render();
    if (shouldPlay) startAudio(token);
  }
  function startAudio(token = generation) {
    state = 'loading'; render();
    let promise;
    try { promise = audio.play(); } catch (_) { fail('Audio could not start. Check that the extracted audio folder is present.'); return; }
    Promise.resolve(promise).then(() => {
      if (token !== generation || audio.paused) return;
      state = 'playing'; render();
    }).catch(error => {
      if (token !== generation || error.name === 'AbortError') return;
      fail('Audio could not start. Press Play again and keep the audio files with the course. The transcript is available below.');
    });
  }
  function makePieces() {
    pieces = [];
    queue.forEach(section => {
      const text = parts[section].speech;
      // Small passages avoid relying on a single multi-minute utterance.
      const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
      let chunk = '';
      sentences.forEach(sentence => {
        sentence = sentence.trim();
        if (chunk && chunk.length + sentence.length + 1 > 220) {
          pieces.push({section,text:chunk}); chunk = '';
        }
        sentence.split(/\s+/).forEach(word => {
          if (chunk && chunk.length + word.length + 1 > 220) {
            pieces.push({section,text:chunk}); chunk = '';
          }
          chunk += (chunk ? ' ' : '') + word;
        });
      });
      if (chunk) pieces.push({section,text:chunk});
    });
  }
  function speakPiece() {
    if (pieceIndex >= pieces.length) { state = 'ended'; utterance = null; render(); return; }
    const selected = localVoices.find(v => 'local:' + v.voiceURI === voiceSelect.value);
    if (!selected) { fail('This device voice is unavailable. Select Included narrator to listen offline.'); return; }
    const token = ++generation, piece = pieces[pieceIndex];
    queuePos = queue.indexOf(piece.section); boundary = 0;
    const text = piece.text.slice(pieceOffset).trimStart();
    if (!/[A-Za-z0-9]/.test(text)) { pieceIndex++; pieceOffset = 0; speakPiece(); return; }
    try {
      utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = selected; utterance.lang = selected.lang; utterance.rate = rate();
    } catch (_) { fail('The device voice is unavailable. Select Included narrator.'); return; }
    let started = false;
    state = state === 'playing' && pieceIndex > 0 ? 'playing' : 'loading'; render();
    utterance.onstart = () => { if (token !== generation) return; started = true; clearTimeout(startTimer); state = 'playing'; render(); };
    utterance.onboundary = event => { if (token === generation && Number.isFinite(event.charIndex)) boundary = event.charIndex; };
    utterance.onend = () => { if (token !== generation) return; clearTimeout(startTimer); pieceIndex++; pieceOffset = 0; utterance = null; speakPiece(); };
    utterance.onerror = event => { if (token !== generation) return; fail('The device voice stopped (' + (event.error || 'speech error') + '). Select Included narrator or read the transcript.'); };
    try {
      synth.speak(utterance);
      if (synth.paused) synth.resume();
      clearTimeout(startTimer);
      startTimer = setTimeout(() => { if (token === generation && !started) fail('The device voice did not start. Select Included narrator to listen.'); },8000);
    } catch (_) { fail('The device voice is unavailable. Select Included narrator.'); }
  }
  function start() {
    if (isDevice()) {
      if (state !== 'paused') { halt(); makePieces(); }
      speakPiece();
    } else if (state === 'paused' && loadedPart === currentPart()) startAudio();
    else { halt(); loadAudio(); }
  }
  function pause() {
    if (isDevice()) {
      // Cancellation also works on devices that cannot reliably pause speech.
      if (pieces[pieceIndex]) {
        const text = pieces[pieceIndex].text;
        pieceOffset = Math.min(text.length - 1,pieceOffset + boundary);
        while (pieceOffset > 0 && !/\s/.test(text[pieceOffset - 1])) pieceOffset--;
      }
      generation++; state = 'paused'; cancelSpeech(); boundary = 0;
      render('Paused. A device voice may repeat the current phrase when resumed.');
    } else { state = 'paused'; audio.pause(); render(); }
  }
  function choosePart(value, autoplay) {
    halt(); partSelect.value = value;
    queue = value === 'all' ? [0,1,2] : [Number(value)];
    makePieces(); render(); if (autoplay) start();
  }
  play.addEventListener('click', () => { if (state === 'playing') pause(); else start(); });
  $('[data-voice-stop]').addEventListener('click', () => { halt(); render('Stopped. Press Play to begin this explanation again.'); });
  $('[data-voice-restart]').addEventListener('click', () => { halt(); makePieces(); if (isDevice()) speakPiece(); else loadAudio(); });
  $('[data-voice-stuck]').addEventListener('click', () => choosePart('2',true));
  root.querySelectorAll('[data-listen-part]').forEach(button => button.addEventListener('click', () => choosePart(button.dataset.listenPart,true)));
  partSelect.addEventListener('change', () => choosePart(partSelect.value,false));
  voiceSelect.addEventListener('change', () => { halt(); pickedVoice = true; makePieces(); savePrefs(); updateVoiceNote(); render('Voice selected. Press Play to start.'); });
  rateSelect.addEventListener('change', () => {
    const wasPlaying = state === 'playing';
    if (isDevice() && (wasPlaying || state === 'loading')) { pause(); speakPiece(); }
    else audio.playbackRate = rate();
    savePrefs();
  });
  seek.addEventListener('focus', () => { dragging = true; });
  seek.addEventListener('blur', () => { dragging = false; progress(); });
  seek.addEventListener('input', () => { dragging = true; const elapsed = Number(seek.value) / 100 * duration(); clock.textContent = timeText(elapsed) + ' / ' + timeText(duration()); });
  seek.addEventListener('change', () => {
    const shouldPlay = state === 'playing' || state === 'loading';
    let target = Number(seek.value) / 100 * duration();
    queuePos = 0;
    while (queuePos < queue.length - 1 && target >= parts[currentPart()].duration) { target -= parts[currentPart()].duration; queuePos++; }
    dragging = document.activeElement === seek;
    target = Math.min(target,Math.max(0,parts[currentPart()].duration - 0.05));
    if (loadedPart === currentPart() && audio.readyState >= 1) {
      pendingSeek = null;
      try { audio.currentTime = target; } catch (_) {}
      state = shouldPlay ? 'playing' : 'paused'; render();
      if (shouldPlay && audio.paused) startAudio();
    } else loadAudio(target,shouldPlay);
  });
  audio.addEventListener('loadedmetadata', () => {
    if (isDevice() || !pendingSeek || pendingSeek.token !== generation) return;
    audio.playbackRate = rate();
    try { audio.currentTime = Math.min(pendingSeek.time,Math.max(0,(audio.duration || parts[currentPart()].duration) - 0.05)); } catch (_) {}
    pendingSeek = null; progress();
  });
  audio.addEventListener('timeupdate', () => { if (!isDevice()) progress(); });
  audio.addEventListener('pause', () => { if (!isDevice() && audio.paused && !audio.ended && state === 'playing') { state = 'paused'; render(); } });
  audio.addEventListener('ended', () => {
    if (isDevice() || !['playing','loading'].includes(state)) return;
    if (queuePos < queue.length - 1) { queuePos++; loadAudio(); }
    else { state = 'ended'; render(); }
  });
  audio.addEventListener('error', () => { if (audio.error && !isDevice() && ['playing','loading','paused'].includes(state)) fail('This audio file could not be loaded. Keep the assets/audio folder with the extracted course. You can still read the text explanation.'); });
  function updateVoiceNote() {
    $('[data-voice-note]').textContent = isDevice() ? 'Using a local English device voice. Phrase timing may differ from the included recording.' : 'Included synthetic English narration. Works from the extracted audio files without a speech service.';
  }
  function refreshVoices() {
    const previous = voiceSelect.value;
    let supplied = [];
    try { supplied = supportsSpeech ? synth.getVoices() : []; } catch (_) {}
    localVoices = supplied.filter(v => v.localService === true && /^en(?:[-_]|$)/i.test(v.lang)).sort((a,b) => (a.lang + a.name).localeCompare(b.lang + b.name));
    voiceSelect.replaceChildren();
    const included = document.createElement('option'); included.value = 'audio'; included.textContent = 'Included narrator'; voiceSelect.append(included);
    localVoices.forEach(v => { const option = document.createElement('option'); option.value = 'local:' + v.voiceURI; option.textContent = v.name + ' · ' + v.lang + ' (device)'; voiceSelect.append(option); });
    const available = [...voiceSelect.options].map(o => o.value);
    const wanted = !pickedVoice && state === 'idle' ? prefs.voice : previous;
    voiceSelect.value = available.includes(wanted) ? wanted : 'audio';
    if (previous !== voiceSelect.value && state !== 'idle') { halt(); render('The voice changed. Press Play to start again.'); }
    updateVoiceNote(); progress();
  }
  window.addEventListener('pagehide', () => { halt(); render(); });
  if (supportsSpeech) synth.addEventListener('voiceschanged',refreshVoices);
  makePieces(); refreshVoices(); render();
})();
