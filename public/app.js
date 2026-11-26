const $ = (id) => document.getElementById(id);
const API_BASE = String(window.PREP_API_BASE || '').replace(/\/+$/, '');
const API_TIMEOUT = 3000;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (arr) => `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
const chips = (arr, cls = '') => `<div class="chips">${arr.map((x) => `<span class="chip ${cls}">${esc(x)}</span>`).join('') || '<span class="muted">None</span>'}</div>`;

async function fetchWithTimeout(url, options = {}, timeout = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function showOfflineBadge() {
  const b = $('aiBadge');
  b.querySelector('b').textContent = 'Offline mode';
  b.classList.remove('on');
}

if (API_BASE) {
  fetchWithTimeout(`${API_BASE}/api/status`, {}, API_TIMEOUT).then((r) => {
    if (!r.ok) throw new Error('API unavailable');
    return r.json();
  }).then(({ ai }) => {
    const b = $('aiBadge');
    b.querySelector('b').textContent = ai ? 'AI mode' : 'Offline mode';
    b.classList.toggle('on', ai);
  }).catch(showOfflineBadge);
} else {
  showOfflineBadge();
}

async function analyzeOffline(file, company, role, jd) {
  const resumeText = (await window.PrepOffline.extractText(file)).replace(/\u0000/g, '').trim();
  if (resumeText.length < 50) throw new Error('Could not read enough text from this resume. Try a text-based PDF or DOCX.');
  const data = window.PrepOffline.generate({ resumeText, company, role, jdText: jd });
  data.ats = window.PrepOffline.checkResume(resumeText, data.match);
  return data;
}

const drop = $('drop'), input = $('resume');
function setFile(f) {
  if (!f) return;
  const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files;
  $('dropText').innerHTML = `<strong>${esc(f.name)}</strong><small>${Math.max(1, Math.round(f.size / 1024))} KB · click to change</small>`;
  drop.classList.add('has');
}
input.addEventListener('change', () => setFile(input.files[0]));
['dragenter', 'dragover'].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((e) => drop.addEventListener(e, (ev) => { ev.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (ev) => setFile(ev.dataTransfer.files[0]));

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('error'); err.hidden = true;
  if (!input.files[0]) { err.textContent = 'Please upload your resume.'; err.hidden = false; return; }
  $('landing').hidden = true; $('loading').hidden = false;
  try {
    const file = input.files[0];
    const company = $('company').value.trim();
    const role = $('role').value.trim();
    const jd = $('jd').value.trim();
    let data;
    if (API_BASE) {
      try {
        const res = await fetchWithTimeout(`${API_BASE}/api/analyze`, { method: 'POST', body: new FormData(e.target) }, API_TIMEOUT);
        if (res.ok) {
          data = await res.json();
        } else if (res.status >= 500) {
          data = await analyzeOffline(file, company, role, jd);
          data.notice = 'Using the built-in offline engine because the hosted service is unavailable.';
        } else {
          const result = await res.json();
          throw new Error(result.error || 'Analysis request failed.');
        }
      } catch (ex) {
        if (ex.name !== 'AbortError' && !(ex instanceof TypeError)) throw ex;
        data = await analyzeOffline(file, company, role, jd);
        data.notice = 'Using the built-in offline engine because the hosted service is unavailable.';
      }
    } else {
      data = await analyzeOffline(file, company, role, jd);
    }
    saveHistory(data);
    render(data);
  } catch (ex) {
    $('loading').hidden = true; $('landing').hidden = false;
    err.textContent = ex.message; err.hidden = false;
  }
});

$('again').addEventListener('click', () => {
  $('results').hidden = true; $('landing').hidden = false;
  renderHistory();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$('tabs').addEventListener('click', (e) => {
  const t = e.target.dataset.tab; if (!t) return;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b === e.target));
  document.querySelectorAll('.tabpane').forEach((p) => (p.hidden = p.id !== `tab-${t}`));
});

/* ---------- Resume check ---------- */
function renderAts(d) {
  const a = d.ats;
  if (!a) { $('tab-ats').innerHTML = '<p class="muted">Resume check isn’t available for this saved prep. Run a new analysis.</p>'; return; }
  const cls = a.score >= 75 ? 'good' : a.score >= 50 ? 'mid' : 'bad';
  const fails = a.checks.filter((c) => !c.pass);
  $('tab-ats').innerHTML = `
    <div class="cols">
      <div class="card glass">
        <h3>ATS-style resume score</h3>
        <div class="big ${cls}">${a.score}<small>/100</small></div>
        <div class="progress"><i style="width:${a.score}%"></i></div>
        <p class="muted">${fails.length ? `${fails.length} thing${fails.length > 1 ? 's' : ''} to fix to get past automated screening and impress recruiters.` : 'Your resume passes every check. Nice work!'}</p>
        ${fails.length ? `<h3>Fix first</h3>${list(fails.map((c) => c.tip))}` : ''}
      </div>
      <div class="card glass">
        <h3>Checklist</h3>
        ${a.checks.map((c) => `<div class="check ${c.pass ? 'ok' : 'no'}"><span>${c.pass ? '✓' : '✕'}</span>${esc(c.label)}<em>${c.points} pts</em></div>`).join('')}
      </div>
    </div>`;
}

/* ---------- Mock interview ---------- */
function renderMock(d) {
  const groups = [
    ['Technical', d.questions.technical.map((x) => ({ ...x, type: 'technical' }))],
    ['Behavioural', d.questions.behavioral.map((x) => ({ ...x, type: 'behavioral' }))],
    [`About ${d.job.company}`, d.questions.company.map((x) => ({ ...x, type: 'behavioral' }))],
  ];
  const all = groups.flatMap(([, qs]) => qs);
  $('tab-mock').innerHTML = `
    <div class="cols">
      <div class="card glass">
        <h3>Practice question</h3>
        <select id="mqSel">${groups.map(([g, qs]) => `<optgroup label="${esc(g)}">${qs.map((x) => `<option value="${all.indexOf(x)}">${esc(x.q)}</option>`).join('')}</optgroup>`).join('')}</select>
        <textarea id="mqAns" rows="9" placeholder="Type your answer here, or use the mic to speak it…"></textarea>
        <div class="mq-meta"><span id="mqWords">0 words</span><span id="mqTimer">⏱ 0:00</span></div>
        <div class="mq-actions">
          <button class="btn ghost sm" id="mqRand" type="button">🎲 Random</button>
          <button class="btn ghost sm" id="mqMic" type="button" hidden>🎤 Speak</button>
          <button class="btn sm" id="mqGo" type="button">Get feedback</button>
        </div>
      </div>
      <div class="card glass" id="mqFb"><h3>Feedback</h3><p class="muted">Pick a question, answer it like you would in the interview, then click <b>Get feedback</b>. Aim for 1–2 minutes.</p></div>
    </div>`;

  const ans = $('mqAns'), sel = $('mqSel');
  let started = 0, timer = null;
  const tick = () => { const s = Math.floor((Date.now() - started) / 1000); $('mqTimer').textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  ans.addEventListener('input', () => {
    $('mqWords').textContent = `${ans.value.trim().split(/\s+/).filter(Boolean).length} words`;
    if (!started) { started = Date.now(); timer = setInterval(tick, 1000); }
  });
  sel.addEventListener('change', () => { ans.value = ''; ans.dispatchEvent(new Event('input')); clearInterval(timer); started = 0; $('mqTimer').textContent = '⏱ 0:00'; });
  $('mqRand').onclick = () => { sel.value = Math.floor(Math.random() * all.length); sel.dispatchEvent(new Event('change')); };

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    const mic = $('mqMic'); mic.hidden = false;
    let rec = null;
    mic.onclick = () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.continuous = true; rec.interimResults = false; rec.lang = 'en-US';
      const base = ans.value ? ans.value.trim() + ' ' : '';
      let heard = '';
      rec.onresult = (ev) => { heard = [...ev.results].map((r) => r[0].transcript).join(' '); ans.value = base + heard; ans.dispatchEvent(new Event('input')); };
      rec.onend = () => { rec = null; mic.textContent = '🎤 Speak'; };
      rec.start(); mic.textContent = '⏹ Stop';
    };
  }

  $('mqGo').onclick = async () => {
    const q = all[+sel.value]; const fb = $('mqFb'); const btn = $('mqGo');
    btn.disabled = true; btn.textContent = 'Analysing…';
    try {
      let r;
      if (API_BASE) {
        try {
          const res = await fetchWithTimeout(`${API_BASE}/api/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q.q, answer: ans.value, type: q.type, skill: q.skill, company: d.job.company, role: d.job.title }) }, API_TIMEOUT);
          if (res.ok) {
            r = await res.json();
          } else if (res.status >= 500) {
            r = window.PrepOffline.feedback({ question: q.q, answer: ans.value, type: q.type, skill: q.skill, company: d.job.company, role: d.job.title });
            r.notice = 'Offline feedback is based on structure and keywords.';
          } else {
            const result = await res.json();
            throw new Error(result.error || 'Feedback request failed.');
          }
        } catch (ex) {
          if (ex.name !== 'AbortError' && !(ex instanceof TypeError)) throw ex;
          r = window.PrepOffline.feedback({ question: q.q, answer: ans.value, type: q.type, skill: q.skill, company: d.job.company, role: d.job.title });
          r.notice = 'Offline feedback is based on structure and keywords.';
        }
      } else {
        r = window.PrepOffline.feedback({ question: q.q, answer: ans.value, type: q.type, skill: q.skill, company: d.job.company, role: d.job.title });
        r.notice = 'Offline feedback is based on structure and keywords.';
      }
      const cls = r.score >= 75 ? 'good' : r.score >= 50 ? 'mid' : 'bad';
      fb.innerHTML = `<h3>Feedback</h3>
        <div class="big ${cls}">${r.score}<small>/100</small></div><div class="progress"><i style="width:${r.score}%"></i></div>
        ${r.notice ? `<p class="muted">${esc(r.notice)}</p>` : ''}
        ${r.strengths.length ? `<h3>What worked</h3>${list(r.strengths)}` : ''}
        ${r.improvements.length ? `<h3>Improve</h3>${list(r.improvements)}` : ''}
        ${r.betterAnswer ? `<h3>Model answer</h3><p>${esc(r.betterAnswer)}</p>` : ''}`;
    } catch (ex) {
      fb.innerHTML = `<h3>Feedback</h3><p class="error">${esc(ex.message)}</p>`;
    } finally { btn.disabled = false; btn.textContent = 'Get feedback'; }
  };
}

/* ---------- History ---------- */
const HKEY = 'preppilot:history';
const readHistory = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch { return []; } };
function saveHistory(d) {
  const h = readHistory().filter((x) => !(x.data.job.company === d.job.company && x.data.job.title === d.job.title));
  h.unshift({ at: Date.now(), data: d });
  try { localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 6))); } catch { /* storage full */ }
}
function renderHistory() {
  const h = readHistory();
  $('history').hidden = !h.length;
  $('historyList').innerHTML = h.map((x, i) => `
    <button class="hist" data-i="${i}"><b>${esc(x.data.job.company)}</b><span>${esc(x.data.job.title)}</span><em>${x.data.match.score}% match</em></button>`).join('');
}
$('historyList').addEventListener('click', (e) => {
  const b = e.target.closest('.hist'); if (!b) return;
  render(readHistory()[+b.dataset.i].data);
});
$('clearHistory').addEventListener('click', () => { localStorage.removeItem(HKEY); renderHistory(); });
renderHistory();

let storeKey = '';
let current = null;
const saved = () => JSON.parse(localStorage.getItem(storeKey) || '[]');
function toggleSaved(id, on) {
  const s = new Set(saved()); on ? s.add(id) : s.delete(id);
  localStorage.setItem(storeKey, JSON.stringify([...s]));
}

function render(d) {
  current = d;
  storeKey = `prep:${d.job.company}:${d.job.title}`.toLowerCase();
  $('landing').hidden = true;
  $('loading').hidden = true; $('results').hidden = false;
  $('rCompany').textContent = d.job.company;
  $('rTitle').textContent = d.job.title;
  const p = d.profile;
  $('rProfile').textContent = [p.name, p.level, p.years ? `${p.years}+ yrs experience` : ''].filter(Boolean).join(' · ');
  $('notice').hidden = !d.notice; $('notice').textContent = d.notice || '';
  const score = Math.max(0, Math.min(100, +d.match.score || 0));
  $('scoreVal').textContent = score;
  requestAnimationFrame(() => ($('ring').style.strokeDashoffset = 327 - (327 * score) / 100));

  $('tab-job').innerHTML = `
    <div class="cols">
      <div>
        <div class="card glass">
          ${d.job.generated ? '<p class="notice" style="margin:0 0 14px">Sample description for this role — paste the real posting for exact details.</p>' : ''}
          <h3>About the role</h3><p>${esc(d.job.summary)}</p>
          <h3>Responsibilities</h3>${list(d.job.responsibilities)}
          <h3>Requirements</h3>${list(d.job.requirements)}
          ${d.job.niceToHave.length ? `<h3>Nice to have</h3>${list(d.job.niceToHave)}` : ''}
        </div>
      </div>
      <div>
        <div class="card glass">
          <h3>Skills that match</h3>${chips(d.match.matched, 'ok')}
          <h3>Skills to strengthen</h3>${chips(d.match.missing, 'miss')}
          <h3>Found on your resume</h3>${chips(d.profile.skills)}
        </div>
        ${d.tips.length ? `<div class="card glass"><h3>Tips</h3>${list(d.tips)}</div>` : ''}
      </div>
    </div>`;

  const done = new Set(saved());
  $('tab-topics').innerHTML = `
    <div class="muted"><span id="pCount"></span> topics prepared</div><div class="progress"><i id="pBar"></i></div>
    ${d.topics.map((t, i) => `
      <div class="item ${done.has('t' + i) ? 'done' : ''}">
        <div class="head"><label><input type="checkbox" data-id="t${i}" ${done.has('t' + i) ? 'checked' : ''}/><span class="t">${esc(t.name)}</span></label><span class="pri ${esc(t.priority)}">${esc(t.priority)}</span></div>
        <p>${esc(t.why)}</p>${chips(t.subtopics || [])}
      </div>`).join('')}`;
  const total = d.topics.length;
  const updateProgress = () => {
    const n = $('tab-topics').querySelectorAll('input:checked').length;
    $('pCount').textContent = `${n}/${total}`; $('pBar').style.width = `${(n / total) * 100}%`;
  };
  $('tab-topics').onchange = (e) => {
    toggleSaved(e.target.dataset.id, e.target.checked);
    e.target.closest('.item').classList.toggle('done', e.target.checked);
    updateProgress();
  };
  updateProgress();

  const qBlock = (title, qs) => `<div class="card glass qgroup"><h3>${title} · ${qs.length}</h3>${qs.map((x) => `<div class="item q"><span>${esc(x.q)}</span>${x.skill ? `<span class="tag">${esc(x.skill)}</span>`   : ''}</div>`).join('')}</div>`;
  $('tab-questions').innerHTML = qBlock('Technical', d.questions.technical) + qBlock('Behavioural', d.questions.behavioral) + qBlock(`About ${esc(d.job.company)}`, d.questions.company);

  const steps = (arr, a, b) => arr.map((r) => `<div class="item"><span class="step-n">${esc(r[a])}</span><p style="margin:4px 0 0 !important;color:#c3cff0 !important;font-size:.95rem">${esc(r[b])}</p></div>`).join('');
  $('tab-rounds').innerHTML = steps(d.rounds, 'name', 'description');
  $('tab-plan').innerHTML = steps(d.plan, 'day', 'focus');

  renderAts(d);
  renderMock(d);
  document.querySelector('#tabs button[data-tab="job"]').click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
