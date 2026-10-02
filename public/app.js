// app.js — 루미아 TRPG 클라이언트. 판정/상태는 전부 서버가 정하고, 여기서는 그리기만 한다.
const $ = (s) => document.querySelector(s), esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ic = (n, c = '') => `<svg class="ic ${c}"><use href="#i-${n}"/></svg>`;
const LS = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
let META = null, S = null, ws = null, sess = LS.get('lumia.sess', null), tab = 'story', sideTab = 'sheet', prefs = Object.assign({ theme: 'paper', fs: 17, sans: false, split: false }, LS.get('lumia.prefs', {}));
let ui = { kind: 'say', luck: false, drawn: 0, chatSeen: 0, first: true, pickedHere: null, open: new Set(), loc: null, draft: '', lobby: { scn: null, role: null } };
const wide = () => matchMedia('(min-width:880px)').matches, split = () => wide() && prefs.split;
const DEG = { crit: ['대성공', 'crit'], ok: ['성공', 'ok'], fail: ['실패', 'fail'], fumble: ['대실패', 'fumble'] };
const statName = (k) => (META.stats.find((s) => s.k === k) || {}).n || k;
const roleOf = (k) => S.scn.roles[k] || { name: k, color: '#999' };
const col = (k) => roleOf(k).color;

function applyPrefs() { const b = document.body; b.dataset.theme = 'paper'; b.dataset.sans = prefs.sans ? 'on' : 'off'; b.dataset.split = prefs.split ? 'on' : 'off'; document.documentElement.style.setProperty('--fs', prefs.fs + 'px');
  document.querySelector('meta[name=theme-color]').content = '#e9e0cc'; LS.set('lumia.prefs', prefs); }
function toast(t) { const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (e.hidden = true), 1800); }

// ── 통신
function connect(first) {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => { if (first) first(); else if (sess) send({ type: 'enter', code: sess.code, token: sess.token, role: sess.role }); };
  ws.onmessage = (e) => { const m = JSON.parse(e.data);
    if (m.type === 'joined') { sess = { code: m.code, token: m.token, role: m.role, scn: m.scn }; LS.set('lumia.sess', sess); }
    else if (m.type === 'snap') LS.set('lumia.snap', m.snap);
    else if (m.type === 'err' && m.code === 'noroom' && !S && sess && (LS.get('lumia.snap', {}) || {}).code === sess.code) { toast('서버에서 방이 사라져 기기에 저장된 기록으로 복구해요…'); send({ type: 'restore', snap: LS.get('lumia.snap'), role: sess.role }); }
    else if (m.type === 'err') { const el = $('#err'); if (el) el.textContent = m.text; else toast(m.text); if (!S) { sess = null; LS.set('lumia.sess', null); } }
    else if (m.type === 'state') onState(m.s); };
  ws.onclose = () => { if (S || sess) { $('#hd') && toast('연결이 끊겼어요. 다시 연결하는 중…'); setTimeout(() => connect(), 1500); } };
}
const send = (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o));

// ── 로비
async function boot() { applyPrefs(); try { META = await (await fetch('/api/meta')).json(); } catch (e) { document.body.innerHTML = '<p style="padding:30px">서버에 연결할 수 없어요.</p>'; return; }
  const q = new URLSearchParams(location.search).get('r'); if (sess && !q) { $('#lobby').hidden = true; connect(); return; } lobby(q || ''); }
function lobby(prefill) {
  const L = $('#lobby'); L.hidden = false; $('#app').hidden = true; ui.lobby.scn = ui.lobby.scn || META.scenarios[0].id; const sc = META.scenarios.find((s) => s.id === ui.lobby.scn);
  ui.lobby.role = ui.lobby.role && sc.roles[ui.lobby.role] ? ui.lobby.role : Object.keys(sc.roles)[0];
  L.innerHTML = `<div class="lb"><h1>루미아</h1><p class="sub">함께 쓰는 역극 TRPG · 혼자서도, 둘이서도</p><div class="orn">${ic('d20')}</div>
  ${META.scenarios.length < 2 ? '' : '<div><div class="h4">시나리오</div>'}${META.scenarios.length < 2 ? '' : META.scenarios.map((s) => `<button class="scn ${s.id === ui.lobby.scn ? 'on' : ''}" data-scn="${s.id}"><b>${esc(s.title)}</b><span>${esc(s.blurb)}</span></button>`).join('<div style="height:8px"></div>')}${META.scenarios.length < 2 ? '' : '</div>'}
  <div><div class="h4">내 역할</div><div class="seg">${Object.entries(sc.roles).map(([k, r]) => `<button class="rolebtn ${k === ui.lobby.role ? 'on' : ''}" style="--c:${r.color}" data-role="${k}"><b>${esc(r.name)}</b><small>${esc(r.sub)}</small></button>`).join('')}</div></div>
  <button class="btn-p" id="mk">새 방 만들기</button><p class="sm mu" style="margin:-8px 0 0;text-align:center">혼자 시작해도 괜찮아요. 상대 역할은 동행자가 자동으로 맡고, 친구가 방 코드로 들어오면 그 자리를 이어받아요.</p>
  <div class="card"><div class="h4">방 코드로 입장</div><div class="seg"><input id="code" maxlength="6" placeholder="방 코드" value="${esc(prefill)}" autocomplete="off" autocapitalize="characters"><button id="jn" style="flex:none;min-width:96px">입장</button></div></div>
  ${sess ? '<button id="rs">이어하기 (' + esc(sess.code) + ')</button>' : ''}<p class="err" id="err"></p></div>`;
  L.querySelectorAll('[data-scn]').forEach((b) => (b.onclick = () => { ui.lobby.scn = b.dataset.scn; lobby($('#code').value); }));
  L.querySelectorAll('[data-role]').forEach((b) => (b.onclick = () => { ui.lobby.role = b.dataset.role; lobby($('#code').value); }));
  const go = (o) => { const f = () => send(Object.assign({ type: 'enter', role: ui.lobby.role, scn: ui.lobby.scn }, o)); if (ws && ws.readyState === 1) f(); else connect(f); };
  $('#mk').onclick = () => go({}); $('#jn').onclick = () => { const c = $('#code').value.trim().toUpperCase(); if (!c) return ($('#err').textContent = '방 코드를 입력하세요.'); go({ code: c }); };
  const rs = $('#rs'); if (rs) rs.onclick = () => { if (ws && ws.readyState === 1) send({ type: 'enter', code: sess.code, token: sess.token, role: sess.role }); else connect(); };
}

// ── 상태 수신
function onState(s) { const prevScene = S && S.scene.id, restarted = S && s.log.length && S.log.length && s.log[0].id < S.log[0].id; S = s;
  if (restarted) { ui.drawn = 0; ui.first = true; [...$('#feed').children].forEach((c) => c.id !== 'choices' && c.remove()); }
  if ($('#app').hidden) { $('#lobby').hidden = true; $('#app').hidden = false; buildApp(); }
  if (prevScene !== s.scene.id) ui.luck = false; renderAll(); }
function buildApp() { $('#comp').innerHTML = `<div class="col"><div class="kinds">${[['say', '대사'], ['act', '행동'], ['narr', '서술']].map(([k, n]) => `<button data-kind="${k}">${n}</button>`).join('')}<span class="gap"></span>${[['()', '( )'], ['…', '…'], ['—', '—']].map(([k, n]) => `<button class="ins" data-ins="${k}" aria-label="${n} 넣기">${n}</button>`).join('')}</div><textarea id="ta" rows="1" placeholder="역극을 이어 써 보세요… (Enter 줄바꿈 · ⌘/Ctrl+Enter 전송)"></textarea></div><button class="ib" id="dbtn" aria-label="주사위">${ic('d20')}</button><button class="ib btn-p" id="sbtn" aria-label="보내기">${ic('send')}</button>`;
  const ta = $('#ta'); ta.oninput = () => { ui.draft = ta.value; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 132) + 'px'; };
  ta.onkeydown = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); sendRp(); } };
  $('#comp').querySelectorAll('[data-ins]').forEach((b) => (b.onclick = () => { const t = ta, s = t.selectionStart, e = t.selectionEnd, v = b.dataset.ins; t.setRangeText(v, s, e, 'end'); if (v === '()') t.setSelectionRange(s + 1, s + 1); t.focus(); t.oninput(); }));
  $('#feed').onclick = (ev) => { const s = ev.target.closest('.sc.old'); if (s && ev.target.closest('small,h3,.pv')) openScene(s.dataset.id); };
  $('#sbtn').onclick = sendRp; $('#dbtn').onclick = diceMenu;
  $('#comp').querySelectorAll('[data-kind]').forEach((b) => (b.onclick = () => { ui.kind = b.dataset.kind; kindUi(); }));
  matchMedia('(min-width:880px)').addEventListener('change', renderAll); }
function kindUi() { $('#comp').querySelectorAll('[data-kind]').forEach((b) => b.classList.toggle('on', b.dataset.kind === ui.kind)); const ph = { say: '대사를 적어요…', act: '행동을 적어요… (예: 창가로 몸을 돌린다)', narr: '장면을 서술해요…' }; $('#ta').placeholder = ph[ui.kind]; }
function sendRp() { const ta = $('#ta'), t = ta.value.trim(); if (!t) return; if (!S.players[S.role].built) return;
  const m = /^\/r\s+(.+)$/i.exec(t); if (m) { const a = m[1].trim(), st = META.stats.find((s) => s.n === a || s.k === a.toUpperCase()); send(st ? { type: 'roll', stat: st.k, dc: META.dc.normal } : { type: 'roll', expr: a }); }
  else send({ type: 'rp', kind: ui.kind, text: t }); ta.value = ''; ta.style.height = 'auto'; ui.draft = ''; ta.focus(); }
function diceMenu() { const me = S.players[S.role]; let dc = META.dc.normal;
  modal(`<button class="x" id="mx">${ic('x')}</button><h3>주사위</h3><p class="mu sm">역극 중 즉석 판정을 굴려요. 결과는 모두에게 기록돼요.</p>
  <div class="h4">능력 판정 (d20 + 능력치)</div><input id="dnote" maxlength="200" placeholder="무엇을 시도하나요? 예: 서가 뒤를 살핀다" style="margin-bottom:10px"><div class="seg" id="dcs">${[['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움'], ['extreme', '극한']].map(([k, n]) => `<button data-dc="${k}" class="${k === 'normal' ? 'on' : ''}">${n} ${META.dc[k]}</button>`).join('')}</div>
  <div style="height:10px"></div><div class="rowb">${META.stats.map((s) => `<button data-st="${s.k}">${ic(s.k)} ${s.n} ${me.stats[s.k]}</button>`).join('')}</div>
  <div class="h4">일반 주사위</div><div class="rowb">${['1d6', '1d10', '1d20', '1d100', '2d6'].map((x) => `<button data-ex="${x}">${x}</button>`).join('')}</div>`);
  $('#mx').onclick = closeModal; document.querySelectorAll('[data-dc]').forEach((b) => (b.onclick = () => { dc = META.dc[b.dataset.dc]; document.querySelectorAll('[data-dc]').forEach((x) => x.classList.toggle('on', x === b)); }));
  document.querySelectorAll('[data-st]').forEach((b) => (b.onclick = () => { send({ type: 'roll', stat: b.dataset.st, dc, note: $('#dnote').value }); closeModal(); }));
  document.querySelectorAll('[data-ex]').forEach((b) => (b.onclick = () => { send({ type: 'roll', expr: b.dataset.ex }); closeModal(); })); }
function modal(h) { const m = $('#modal'); m.innerHTML = `<div class="sheet">${h}</div>`; m.hidden = false; m.onclick = (e) => { if (e.target === m) closeModal(); }; }
function closeModal() { $('#modal').hidden = true; }

// ── 그리기
function renderAll() { const me = S.players[S.role]; document.body.dataset.tab = tab; document.body.dataset.ch = S.scene.ch || 0; renderHeader(); renderFeed(); renderChoices(); renderSide(); renderNav(); kindUi(); $('#comp').hidden = !me.built;
  if (!me.built) creation(); else if ($('#modal').dataset.cr) closeModal(); }
function renderHeader() { const me = S.players[S.role], ch = S.scn.chapters[S.scene.ch];
  $('#hd').innerHTML = `<div class="ttl"><b>${esc(S.scn.title)}</b><span>${ch ? esc(ch.title) + ' · ' : ''}${esc(S.scene.title || '')}${S.scene.prog ? ` · ${S.scene.prog[0]}/${S.scene.prog[1]}` : ''}</span><i class="pbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${S.scene.prog ? Math.round(S.scene.prog[0] / S.scene.prog[1] * 100) : 0}" style="--p:${S.scene.prog ? S.scene.prog[0] / S.scene.prog[1] * 100 : 0}%"></i></div>
  <span class="pres">${(() => { const o = S.players[S.role === 'K' ? 'M' : 'K']; return o ? (o.human ? `<i class="${o.online ? 'dot-on' : 'dot-off'}"></i>${esc(o.name)} ${o.online ? '접속' : '오프'}` : `<i class="dot-npc"></i>${esc(o.name)} 자동`) : ''; })()}</span><button id="inv">${ic('link')}<span>${esc(S.code)}</span></button><button id="gear" aria-label="설정">${ic('gear')}</button>`;
  $('#inv').onclick = () => { const u = location.origin + '/?r=' + S.code; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast('초대 링크를 복사했어요'), () => toast('방 코드: ' + S.code)); };
  $('#gear').onclick = settings; }
function para(t) { return String(t).split('\n').map((p) => `<p>${esc(p)}</p>`).join(''); }
function chkHtml(c, who) { if (!c) return ''; const [dn, dk] = DEG[c.deg]; return `<div class="chk deg-${dk}">${ic(c.stat || 'd20')}<span>${esc(statName(c.stat))}</span><span class="die">d20 ${c.die}${c.base != null ? ' + ' + c.base : ''}${(c.mods || []).map((m) => ' · ' + esc(m)).join('')} = ${c.total}</span><span>/ DC ${c.dc}</span><span class="res">${dn}</span></div>`; }
function entryHtml(e) { let h = entryHtml0(e);
  if (e.t === 'roll' && e.check && (e.note || e.narr)) h = h.replace(/<\/div>$/, (e.note ? `<div class="lab">“${esc(e.note)}”</div>` : '') + (e.narr ? `<p class="say">${esc(e.narr)}</p>` : '') + '</div>'); return h; }
function entryHtml0(e) { const c = e.role ? col(e.role) : '';
  if (e.t === 'chapter') return `<div class="chap" data-id="${e.id}"><small>${esc(e.kicker)}</small><h2>${esc(e.title)}</h2><div class="orn">${ic('d20')}</div><p>${esc(e.text)}</p></div>`;
  if (e.t === 'scene') return `<section class="sc" data-id="${e.id}">${e.kicker ? `<small>${esc(e.kicker)}</small>` : ''}<h3>${esc(e.title)}</h3><div class="pv">${esc(String(e.text).split('\n')[0].slice(0, 44))}…</div><div class="tx">${para(e.text)}</div></section>`;
  if (e.t === 'act') return `<div class="act" data-id="${e.id}" style="--c:${c}"><div class="who"><b>${esc(e.name)}</b>${e.npc ? ' · 동행(자동)' : ''}</div><div class="lab">${esc(e.label)}</div>${chkHtml(e.check)}${e.text ? `<p class="say">${esc(e.text)}</p>` : ''}</div>`;
  if (e.t === 'rp') { const k = e.kind === 'act' ? 'act2' : e.kind === 'narr' ? 'narr' : ''; const t = e.kind === 'say' ? `“${esc(e.text)}”` : e.kind === 'act' ? '*' + esc(e.text) + '*' : esc(e.text);
    return `<div class="rp ${k} ${e.npc ? 'npc' : ''}" data-id="${e.id}" style="--c:${c}">${e.kind === 'narr' ? '' : `<b>${esc(e.name)}</b>`}${t.replace(/\n/g, '<br>')}</div>`; }
  if (e.t === 'roll') return `<div class="rl" data-id="${e.id}" style="--c:${c}">${e.check ? `<div class="chk deg-${DEG[e.check.deg][1]}"><b>${esc(e.name)}</b>${chkHtml(e.check).replace(/^<div[^>]*>|<\/div>$/g, '')}</div>` : `<div class="chk"><b>${esc(e.name)}</b>${ic('d20')}<span>${esc(e.expr)}</span><span class="die">[${e.rolls.join(', ')}] = ${e.total}</span></div>`}</div>`;
  if (e.t === 'gm') return `<div class="gm" data-id="${e.id}">${ic('eye')} ${esc(e.text)}</div>`;
  return `<div class="sys" data-id="${e.id}">${esc(e.text)}</div>`; }
function renderFeed() { const f = $('#feed'), near = f.scrollHeight - f.scrollTop - f.clientHeight < 160 || ui.first; let n = 0, mine = null;
  let top = null; for (const e of S.log) { if (e.id <= ui.drawn) continue; $('#choices').insertAdjacentHTML('beforebegin', entryHtml(e)); ui.drawn = e.id; n++; if (!top && !ui.first && (e.t === 'scene' || e.t === 'chapter')) top = $('#choices').previousElementSibling; if (!ui.first && e.role === S.role && !e.npc && e.check && (e.t === 'act' || e.t === 'roll')) mine = e; }
  fold(); if (n && near) requestAnimationFrame(() => { if (top) f.scrollTo({ top: f.scrollTop + top.getBoundingClientRect().top - f.getBoundingClientRect().top - 12, behavior: ui.first ? 'auto' : 'smooth' }); else f.scrollTop = f.scrollHeight; }); ui.first = false; if (mine) diceAnim(mine); }
// 지난 장면은 제목+한 줄로 접고, 제목을 누르면 그 장면의 이야기 전체(판정·역극 포함)가 펼쳐진다.
function fold() { const f = $('#feed'), els = [...f.children].filter((x) => x.id !== 'choices'); let cur = '', last = '';
  for (const el of els) { if (el.classList.contains('chap')) cur = ''; else if (el.classList.contains('sc')) last = cur = el.dataset.id; el.dataset.g = cur; }
  for (const el of els) { const g = el.dataset.g; if (!g) continue; const old = g !== last, op = ui.open.has(g);
    if (el.classList.contains('sc')) { el.classList.toggle('old', old); el.classList.toggle('open', old && op); } else el.classList.toggle('fold', old && !op); } }
function openScene(id) { ui.open.has(String(id)) ? ui.open.delete(String(id)) : ui.open.add(String(id)); fold(); }
function chance(dc, mod) { return Math.max(5, Math.min(95, (21 - (dc - mod)) * 5)); }
function renderChoices() { const me = S.players[S.role], el = $('#choices'); let h = '';
  if (!me.built) h = ''; else if (S.phase === 'choose') {
    const picked = S.picked.includes(S.role), anyChk = S.opts.some((o) => o.stat), bonus = (me.mind <= 0 ? -2 : 0) + (ui.luck ? META.luckBonus : 0);
    if (picked) h = `<p class="hint">선택을 전달했어요.${S.waiting.length ? ' ' + S.waiting.map((k) => esc(S.players[k].name)).join(', ') + '님을 기다리는 중…' : ''}</p>`;
    else { if (anyChk && me.luck > 0) h += `<div class="tg"><button id="lk" class="${ui.luck ? 'on' : ''}">${ic('luck')} 행운 +${META.luckBonus} ${ui.luck ? '사용 예정' : '사용'}</button><span class="mu">남은 행운 ${me.luck}</span></div>`;
      h += S.opts.map((o) => { const mod = o.stat ? me.stats[o.stat] + bonus : 0, p = o.stat ? chance(o.dc, mod) : 100;
        const meta = o.stat ? `${ic(o.stat)}<span>${esc(statName(o.stat))} ${me.stats[o.stat]}</span><span>DC ${o.dc}</span><span class="pb"><i style="width:${p}%"></i></span><span>${p}%</span>` : `${ic('check')}<span>판정 없음</span>`;
        return `<button class="ch" data-i="${o.i}"><span class="m">${meta}</span><span class="t">${esc(o.label)}</span></button>`; }).join('');
      if (S.waiting.some((k) => k !== S.role)) h += `<p class="hint">상대 오너도 선택 중이에요. 둘이 고른 뒤 함께 판정해요.</p>`;
      else if (S.solo) h += `<p class="hint">동행자(${esc(S.players[Object.keys(S.players).find((k) => k !== S.role)].name)})는 자동으로 행동해요.</p>`; }
  } else if (S.phase === 'after') { const mineReady = S.ready.includes(S.role); h = `<button class="btn-p next" id="nx" ${mineReady ? 'disabled' : ''}>${mineReady ? '상대를 기다리는 중…' : S.gate ? '탐색하러 가기 ▸' : '이어서 ▸'}</button>${mineReady ? '' : S.gate ? '<p class="hint tip">이 장면의 흔적을 한 번 더듬어야 다음 장면이 열려요.</p>' : '<p class="hint tip">역극을 더 이어도 좋아요. 준비되면 넘어가요.</p>'}`; }
  else if (S.phase === 'end') h = `<div class="card" style="text-align:center"><b style="font-family:var(--narr);font-size:19px">막이 내렸어요</b><p class="mu sm">두 사람의 이야기는 여기서 한 번 쉬어 가요.</p><button id="rst">처음부터 다시 시작</button></div>`;
  if (me.built) h = tipCard() + evCard() + h;
  el.innerHTML = h; el.hidden = !h; el.querySelectorAll('[data-ev]').forEach((b) => (b.onclick = () => { b.disabled = true; send({ type: 'evpick', i: +b.dataset.ev }); })); const tx = $('#tipx'); if (tx) tx.onclick = () => { LS.set('lumia.tip', 1); renderChoices(); }; const lk = $('#lk'); if (lk) lk.onclick = () => { ui.luck = !ui.luck; renderChoices(); };
  el.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { el.querySelectorAll('[data-i]').forEach((x) => (x.disabled = true)); b.classList.add('sel'); send({ type: 'pick', i: +b.dataset.i, luck: ui.luck }); }));
  const nx = $('#nx'); if (nx) nx.onclick = () => { if (S.gate) { toast('탐색 탭에서 한 번 움직여야 다음 장면으로 넘어가요'); tab = 'explore'; renderAll(); return; } send({ type: 'next' }); }; const rst = $('#rst'); if (rst) rst.onclick = () => confirm('처음부터 다시 시작할까요? (캐릭터는 유지)') && send({ type: 'restart' }); }

// ── 주사위 연출: 굴러가는 중에 탭하면 그 자리에서 멈추고 결과·문구가 함께 나온다. 멈춘 뒤 다시 탭하면 닫힌다.
function diceAnim(e) { const c = e.check, [dn, dk] = DEG[c.deg], box = $('#dice'); box.hidden = false; let n = 0, done = false;
  const txt = e.text || e.narr || '';
  box.innerHTML = `<div class="dc"><div class="lab2">${esc(e.label || e.note || '')}</div><div class="d20 rolling"><svg viewBox="0 0 24 24"><path d="M12 2.5l8.5 5v9l-8.5 5-8.5-5v-9z"/><path d="M12 7.5l4.5 8h-9z" fill="none"/></svg><b id="dn">20</b></div><div class="eq mu">&nbsp;</div><div class="big">&nbsp;</div><p class="dtx"></p><small class="hint2">탭하면 멈춰요</small></div>`;
  const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches, t = setInterval(() => { const d = $('#dn'); if (d) d.textContent = 1 + Math.floor(Math.random() * 20); if (++n > (reduce ? 1 : 14)) show(); }, 70);
  const close = () => { clearInterval(t); clearTimeout(close.t); box.hidden = true; };
  box.onclick = () => { if (!done) show(true); else close(); };
  function show(manual) { if (done) return; done = true; clearInterval(t); const d = $('#dn'); if (!d) return; d.textContent = c.die; box.querySelector('.d20').classList.remove('rolling'); box.querySelector('.d20').classList.add('stop');
    box.querySelector('.eq').innerHTML = c.base != null ? `d20 ${c.die} + ${esc(statName(c.stat))} ${c.base}${(c.mods || []).map((m) => ' · ' + esc(m)).join('')} = <b>${c.total}</b> <span class="mu">/ DC ${c.dc}</span>` : '';
    const g = box.querySelector('.big'); g.textContent = dn; g.className = 'big ' + (dk === 'ok' || dk === 'crit' ? 'ok' : 'bad'); box.querySelector('.dtx').textContent = txt; box.querySelector('.hint2').textContent = '탭하면 닫혀요';
    close.t = setTimeout(close, manual ? 7000 : txt ? 4200 : 1800); } }

// ── 사이드 패널
function renderNav() { { const n = mailUnread(); if (ui.mailN != null && n > ui.mailN) toast('부엉이가 편지를 가져왔어요'); ui.mailN = n; } const items = [['story', '이야기', 'story'], ['explore', '탐색', 'compass'], ['mail', '편지', 'mail'], ['dream', '꿈세계', 'gate'], ['sheet', '캐릭터', 'user'], ['log', '기록', 'log'], ['codex', '세계', 'book'], ['chat', '잡담', 'chat']]; const sideCur = split() ? sideTab : tab;
  if (sideCur === 'chat') ui.chatSeen = S.chat.length; const unread = S.chat.filter((c, i) => i >= ui.chatSeen && c.role !== S.role).length;
  $('#nav').innerHTML = items.slice(0, 5).map(([k, n, i]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}">${ic(i)}${n}${k === 'explore' && S.ev && S.ev.role === S.role && tab !== 'explore' ? '<span class="dot ev">!</span>' : ''}${k === 'mail' && mailUnread() && tab !== 'mail' ? `<span class="dot">${mailUnread()}</span>` : ''}${k === 'chat' && unread && tab !== 'chat' ? `<span class="dot">${unread}</span>` : ''}</button>`).join('');
  $('#nav').insertAdjacentHTML('beforeend', `<button data-t="more" class="${items.slice(5).some((x) => x[0] === tab) ? 'on' : ''}">${ic('more')}더보기${unread && !items.slice(5).some((x) => x[0] === tab) ? `<span class="dot">${unread}</span>` : ''}</button>`);
  $('#stabs').innerHTML = items.slice(1).map(([k, n, i]) => `<button data-t="${k}" class="${sideTab === k ? 'on' : ''}">${ic(i)}${n}${k === 'chat' && unread && sideTab !== 'chat' ? ` <span class="dot" style="position:static;display:inline-block">${unread}</span>` : ''}</button>`).join('');
  $('#nav').querySelectorAll('button').forEach((b) => (b.onclick = () => { if (b.dataset.t === 'more') return moreMenu(items.slice(5)); tab = b.dataset.t; if (tab !== 'story') sideTab = tab; renderAll(); }));
  $('#stabs').querySelectorAll('button').forEach((b) => (b.onclick = () => { sideTab = b.dataset.t; tab = 'story'; renderAll(); })); }
function moreMenu(it) { modal(`<button class="x" id="mx">${ic('x')}</button><h3>더보기</h3><div class="mg">${it.map(([k, n, i]) => `<button data-mt="${k}">${ic(i)}<b>${n}</b>${k === 'chat' && S.chat.length > ui.chatSeen && S.chat.some((c, j) => j >= ui.chatSeen && c.role !== S.role) ? '<span class="dot2"></span>' : ''}</button>`).join('')}</div>`);
  $('#mx').onclick = closeModal; document.querySelectorAll('[data-mt]').forEach((b) => (b.onclick = () => { tab = sideTab = b.dataset.mt; closeModal(); renderAll(); })); }
function renderSide() { const k = split() ? sideTab : tab; if (k === 'story') return; const el = $('#spanel'); el.classList.toggle('chatmode', k === 'chat'); const keep = $('#cin') ? $('#cin').value : ''; const focused = document.activeElement && document.activeElement.id === 'cin';
  el.innerHTML = '<div class="in">' + (k === 'sheet' ? sheet() : k === 'log' ? logTab() : k === 'codex' ? codexTab() : k === 'explore' ? exploreTab() : k === 'dream' ? dreamTab() : k === 'mail' ? mailTab() : chatTab()) + '</div>'; bindSide(k); if (k === 'mail') bindMail();
  if (k === 'chat') { const c = $('#cin'); if (c) { c.value = keep; if (focused) c.focus(); } const cl = el.querySelector('.cl'); if (cl) cl.scrollTop = cl.scrollHeight; } }
const bar = (label, ic_, v, mx, c) => `<div class="bar"><span>${ic(ic_)} ${label}</span><div class="tr"><i style="width:${Math.max(0, Math.min(100, v / mx * 100))}%;background:${c}"></i></div><span>${v}/${mx}</span></div>`;
function sheet0() { const me = S.players[S.role], r = roleOf(S.role), other = Object.keys(S.players).find((k) => k !== S.role), o = S.players[other];
  const sc = META.stats.map((s) => `<div class="stat"><span>${ic(s.k)}</span><div><b>${s.n}</b><small>${s.d}</small></div><div class="v">${me.pts > 0 && me.stats[s.k] < 8 ? `<button data-sp="${s.k}" aria-label="${s.n} 올리기">${ic('plus')}</button>` : ''}${me.stats[s.k]}</div></div>`).join('');
  return `<div class="pc" style="--c:${r.color}"><div class="av">${esc(me.name[0])}</div><div><b>${esc(me.name)}</b><span>${esc(r.sub)} · Lv.${me.lvl}</span></div></div>
  <div class="bars">${bar('체력', 'hp', me.hp, me.hpMax, '#d9857a')}${bar('마음', 'mind', me.mind, me.mindMax, '#7fa8d9')}${bar('경험', 'story', me.xp, me.need, 'var(--ac)')}<div class="bar"><span>${ic('luck')} 행운</span><div class="pips">${[1, 2, 3].map((i) => `<i class="${i <= me.luck ? 'f' : ''}"></i>`).join('')}</div><span></span></div></div>
  ${me.mind <= 0 ? '<p class="sm" style="color:var(--bad)">마음이 무너졌어요 — 모든 판정 −2. 다음 장(章)에서 회복해요.</p>' : ''}
  <div class="h4">능력치 ${me.pts > 0 ? `<span style="color:var(--ac)">· 배분 가능 ${me.pts}</span>` : ''}</div>${sc}
  <div class="h4">유대 · ${bondStage(S.bond)}</div><div class="meter"><i style="width:${Math.min(100, S.bond)}%"></i></div><p class="sm mu" style="margin:6px 0 0">유대 ${S.bond}${S.heart ? ' · 마음 ' + S.heart : ''}</p>
  <div class="h4">동행</div><div class="pc" style="--c:${col(other)}"><div class="av">${esc(o.name[0])}</div><div><b>${esc(o.name)}</b><span>${o.human ? (o.online ? '<i class="dot-on"></i>접속 중' : '<i class="dot-off"></i>오프라인') : '자동 동행 (NPC)'} · Lv.${o.lvl}</span></div></div>
  <div class="h4">소지품</div>${S.items.length ? S.items.map((i) => { const it = S.scn.items[i] || { name: i, desc: '' }; return `<div class="it"><b>${ic('bag')} ${esc(it.name)}</b><p>${esc(it.desc)}</p></div>`; }).join('') : '<p class="mu sm">아직 아무것도 없어요.</p>'}`; }
function lettersHtml() { const L = S.log.filter((e) => e.t === 'gm' && /^\[편지 ·/.test(e.text)); return `<div class="h4">받은 편지 (${L.length})</div>${L.length ? L.slice().reverse().map((e) => `<div class="it"><p>${esc(e.text)}</p></div>`).join('') : '<p class="mu sm">하루가 지나면 부엉이가 편지를 가져와요.</p>'}`; }
const BST = [[0, '낯선 승객'], [8, '같은 객실'], [20, '별자리와 나비'], [40, '약속을 나눈 사이'], [70, '서로의 이름을 아는 사이'], [110, '돌아올 곳']];
function bondStage(b) { let n = BST[0][1]; for (const [v, t] of BST) if (b >= v) n = t; return n; }
function logTab() { const scenes = S.log.filter((e) => e.t === 'scene' || e.t === 'chapter'); return `<div class="h4">지나온 장면 (${scenes.length})</div>${scenes.slice().reverse().map((e) => `<div class="it ${e.t === 'scene' ? 'sj' : ''}" ${e.t === 'scene' ? `data-sj="${e.id}"` : ''}><b>${esc(e.title)}</b><p>${esc(e.kicker || '')}</p></div>`).join('') || '<p class="mu">기록이 없어요.</p>'}<div class="h4">내보내기</div><button id="exp" style="width:100%">${ic('log')} 이야기 텍스트로 저장 (.txt)</button>`; }
function chatTab() { return `<p class="sm mu" style="margin:0 0 12px">오너끼리 나누는 잡담방이에요. 역극 기록에는 남지 않아요.</p><div class="cl">${S.chat.map((c) => `<div class="bub ${c.role === S.role ? 'me' : ''}"><small>${esc(c.name)}</small>${esc(c.text)}</div>`).join('') || '<p class="mu sm" style="text-align:center">아직 대화가 없어요.</p>'}</div><div class="chatrow"><input id="cin" placeholder="잡담 입력…" maxlength="600"><button class="btn-p" id="csd" style="flex:none">${ic('send')}</button></div>`; }
function codexTab() { const rules = [['판정', 'd20 + 능력치가 난이도(DC) 이상이면 성공. 20은 대성공(유대+1·마음+1), 1은 대실패(마음−1).'], ['난이도', `쉬움 ${META.dc.easy} · 보통 ${META.dc.normal} · 어려움 ${META.dc.hard} · 극한 ${META.dc.extreme}`], ['행운', `장(章)마다 3개. 판정 전에 쓰면 +${META.luckBonus}.`], ['마음', '0이 되면 모든 판정 −2. 새 장이 시작될 때 일부 회복해요.'], ['자유 행동', '역극 중 주사위 버튼 → 하고 싶은 행동을 적고 능력·난이도를 고르면 GM이 판정해 서술해요. 장면당 경험치는 2회까지.'], ['혼자 · 둘이서', '혼자일 땐 동행이 자동으로 움직이고, 둘일 땐 함께 고른 뒤 함께 판정해요.']];
  const cx = S.scn.codex || [], d = (a) => a.map(([t, b]) => `<details class="cx"><summary>${esc(t)}</summary><p>${esc(b).replace(/\n/g, '<br>')}</p></details>`).join('');
  const kp = S.keep || [], kn = kp.filter((k) => k.on).length, kh = kp.length ? `<div class="h4">증표 ${kn}/${kp.length}</div>` + kp.map((k) => `<details class="cx ${k.on ? '' : 'lk'}"><summary>${ic(k.icon)} ${esc(k.n)}</summary><p>${esc(k.text)}</p></details>`).join('') + '<p class="sm mu">증표는 정해진 이야기의 장면을 지나면 떠올라요. 많을수록 기억이 쉽게 흐려지지 않아요.</p>' : '';
  return `<div class="h4">규칙 안내</div>${d(rules)}${kh}<div class="h4">세계관 노트</div>${cx.length ? d(cx.map((c) => [c.t, c.b])) : '<p class="mu sm">이 시나리오에는 아직 노트가 없어요. 시나리오 파일의 codex 에 추가해 보세요.</p>'}`; }
function exploreTab() { return (S.gate ? '<div class="gatebn">' + ic('compass') + '<span><b>다음 장면의 열쇠</b><small>아무 장소에서나 행동 하나를 하면 이야기가 이어져요.</small></span></div>' : '') + exploreTab0() + `<p class="sm mu" style="text-align:center;margin:14px 0 0">오늘 ${S.day}일째 · 행동 ${Math.min(S.per, 3)}/3 · 균열 ${S.rift}/10</p>`; }
function exploreTab0() { const me = S.players[S.role], PN = ['아침', '낮', '저녁', '밤'], TI = ['sunrise', 'sun', 'dusk', 'moon'], bonus = me.mind <= 0 ? -2 : 0, last = [...S.log].reverse().find((e) => e.ex && e.role === S.role);
  const CHN = S.scene.ch || 0, okA = (x) => (!x.ch || x.ch.includes(CHN)) && (!x.who || x.who === S.role), locs = Object.entries(S.loc || {}).filter(([k, L]) => (!L.ch || L.ch.includes(CHN)) && L.a.some(okA)); if (!locs.length) return '<p class="mu sm">이 시나리오에는 탐색 장소가 없어요.</p>';
  const can = S.per <= 3, isOpen = (L) => can && L.at.includes(S.per), myN = me.name, CHL = (S.scn.chapters[CHN] || {}).title || '';
  if (!ui.loc || !locs.some(([k]) => k === ui.loc)) ui.loc = (locs.find(([, L]) => isOpen(L)) || locs[0])[0];
  const L = S.loc[ui.loc], open = isOpen(L);
  const tm = `<div class="tm2"><b>${S.day}일째<small>${esc(CHL)}</small></b><div class="slots">${TI.map((t, i) => `<span class="${i === S.per ? 'on' : i < S.per ? 'past' : ''}">${ic(t)}<small>${PN[i]}</small></span>`).join('')}</div></div>`;
  const gz = `<div class="gz2"><div>${ic('eye')} 단서 ${S.clues}${S.clueNext ? '/' + S.clueNext : ''}<div class="meter"><i style="width:${S.clueNext ? S.clues / S.clueNext * 100 : 100}%"></i></div></div><div>균열 ${S.rift}/10 ${S.anchored ? '· 닻 ✓' : ''}<div class="meter rf"><i style="width:${S.rift * 10}%"></i></div></div></div>`;
  const tiles = `<div class="tiles">${locs.map(([k, l]) => `<button class="tile ${k === ui.loc ? 'on' : ''} ${isOpen(l) ? '' : 'shut'}" data-lc="${k}">${ic(l.icon)}<b>${esc(l.n)}</b><small>${l.at.length >= 4 ? '언제든' : l.at.map((i) => PN[i]).join('·')}</small></button>`).join('')}</div>`;
  const acts = L.a.map((ac, i) => ({ ac, i })).filter(({ ac }) => okA(ac)).map(({ ac, i }) => { const rest = ac.stat === 'rest', p = rest ? 100 : chance(ac.dc, me.stats[ac.stat] + bonus);
    const tags = (ac.who ? `<em class="tg2 me">${esc(myN)} 전용</em>` : '') + (ac.ch && ac.ch.length < 4 ? `<em class="tg2">${ac.ch.map((c) => (S.scn.chapters[c] || {}).title || '').join('·')}</em>` : '');
    return `<button class="ax" data-xl="${ui.loc}" data-xi="${i}" ${open ? '' : 'disabled'}>${ic(ac.stat)}<span><b>${esc(ac.n)}</b>${tags ? `<span class="tgs">${tags}</span>` : ''}<small>${rest ? '휴식 · 체력·마음 +2' : statName(ac.stat) + ' · DC ' + ac.dc + ' · ' + p + '%'}${ac.clue ? ' · 단서' : ''}${ac.bond ? ' · 유대' : ''}${ac.rift ? ' · 균열 주의' : ''}${ac.risk ? ' · 부상 위험' : ''}</small></span></button>`; }).join('');
  const panel = `<div class="lp"><div class="lph">${ic(L.icon)}<b>${esc(L.n)}</b>${open ? '' : `<small>지금은 닫혀 있어요 (${L.at.map((i) => PN[i]).join('·')})</small>`}</div>${acts}${open ? '<p class="sm mu" style="margin:4px 2px 0">이곳에서 행동하면 이따금 이 장소의 사건이 일어나요.</p>' : ''}</div>`;
  const res = last ? `<div class="lastr"><b>${esc(last.label)}</b>${last.check ? chkHtml(last.check) : ''}<p class="clamp">${esc(last.text)}</p></div>` : '';
  return `${evCard()}${tm}${gz}${tiles}${panel}${res}<div class="ft"><button class="ax" id="jnl" ${can ? '' : 'disabled'}>${ic('pen')}<span><b>${S.role === 'M' ? '꿈세계 스케치' : '오늘의 기록'}</b><small>${S.role === 'M' ? '친화' : '의지'} DC 8 · ${chance(8, me.stats[S.role === 'M' ? 'CHA' : 'WIL'] + bonus)}% · 닻</small></span></button><button class="btn-p" id="slp">${ic('moon')} 잠들기</button></div>`; }
function bindSide(k) { document.querySelectorAll('[data-lc]').forEach((b) => (b.onclick = () => { ui.loc = b.dataset.lc; renderSide(); }));
  document.querySelectorAll('[data-sj]').forEach((b) => (b.onclick = () => { ui.open.add(b.dataset.sj); tab = 'story'; renderAll(); const el = $('#feed .sc[data-id="' + b.dataset.sj + '"]'); if (el) el.scrollIntoView({ block: 'start' }); })); document.querySelectorAll('[data-ev]').forEach((b) => (b.onclick = () => send({ type: 'evpick', i: +b.dataset.ev }))); document.querySelectorAll('[data-xl]').forEach((b) => (b.onclick = () => send({ type: 'explore', l: b.dataset.xl, i: +b.dataset.xi }))); const jl = $('#jnl'); if (jl) jl.onclick = () => send({ type: 'journal' }); const sl = $('#slp'); if (sl) sl.onclick = () => send({ type: 'sleep' }); document.querySelectorAll('[data-sp]').forEach((b) => (b.onclick = () => send({ type: 'spend', stat: b.dataset.sp })));
  const c = $('#cin'), go = () => { const t = c.value.trim(); if (t) { send({ type: 'chat', text: t }); c.value = ''; } }; if (c) { c.onkeydown = (e) => { if (e.key === 'Enter' && !e.isComposing) go(); }; $('#csd').onclick = go; }
  const ex = $('#exp'); if (ex) ex.onclick = () => { const L = S.log.map((e) => e.t === 'scene' || e.t === 'chapter' ? `\n■ ${e.title}\n${e.text}\n` : e.t === 'act' ? `[${e.name}] ${e.label}${e.check ? ` (d20 ${e.check.die}+${e.check.base || 0}=${e.check.total}/DC${e.check.dc} ${DEG[e.check.deg][0]})` : ''}\n  ${e.text || ''}` : e.t === 'rp' ? `${e.name}: ${e.text}` : e.text || '').join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([L], { type: 'text/plain' })); a.download = 'lumia-' + S.code + '.txt'; a.click(); }; }

// ── 캐릭터 생성
function creation() { const m = $('#modal'); if (m.dataset.cr && !m.hidden) return; const r = roleOf(S.role), me = S.players[S.role]; let st = { ...me.stats }, name = me.name;
  const rem = () => META.budget - Object.values(st).reduce((a, b) => a + b, 0);
  const draw = () => { m.dataset.cr = 1; m.hidden = false; m.onclick = null; m.innerHTML = `<div class="sheet"><h3>캐릭터 만들기</h3><p class="mu sm" style="margin:0 0 12px">${esc(r.name)} · ${esc(r.sub)}. 능력치는 각 ${META.min}~${META.max}, 총합 ${META.budget}점이에요. 판정은 d20 + 능력치로 정해요.</p>
    <div class="h4">이름</div><input id="cn" maxlength="12" value="${esc(name)}">
    <div class="h4">능력치 <span class="rem ${rem() === 0 ? 'z' : ''}">· 남은 ${rem()}</span></div>${META.stats.map((s) => `<div class="stat"><span>${ic(s.k)}</span><div><b>${s.n}</b><small>${s.d}</small></div><div class="v"><button data-m="${s.k}">${ic('minus')}</button><span style="min-width:1.2em;text-align:center">${st[s.k]}</span><button data-p="${s.k}">${ic('plus')}</button></div></div>`).join('')}
    <div class="rowb" style="margin-top:16px"><button id="cp">추천 배분</button><button class="btn-p" id="cok" ${rem() !== 0 ? 'disabled' : ''}>이 캐릭터로 시작</button></div></div>`;
    $('#cn').oninput = (e) => (name = e.target.value); m.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { if (st[b.dataset.m] > META.min) { st[b.dataset.m]--; draw(); } }));
    m.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => { if (st[b.dataset.p] < META.max && rem() > 0) { st[b.dataset.p]++; draw(); } }));
    $('#cp').onclick = () => { st = { ...(S.scn.roles[S.role].preset) }; draw(); }; $('#cok').onclick = () => { send({ type: 'build', name, stats: st }); m.dataset.cr = ''; closeModal(); }; };
  draw(); }
function settings() { modal(`<button class="x" id="mx">${ic('x')}</button><h3>설정</h3>
  <div class="setrow"><span>글자 크기</span><div class="seg" style="width:190px"><button id="fm">A−</button><button id="fp">A+</button></div></div>
  <div class="setrow"><span>본문 글꼴</span><div class="seg" style="width:190px"><button data-sa="0" class="${!prefs.sans ? 'on' : ''}">명조</button><button data-sa="1" class="${prefs.sans ? 'on' : ''}">고딕</button></div></div>
  ${wide() ? `<div class="setrow"><span>화면 배치</span><div class="seg" style="width:190px"><button data-sp2="0" class="${!prefs.split ? 'on' : ''}">탭 하나씩</button><button data-sp2="1" class="${prefs.split ? 'on' : ''}">나란히</button></div></div>` : ''}
  <div class="setrow"><span>사건 빈도</span><div class="seg" style="width:190px">${['드묾', '보통', '잦음'].map((n, i) => `<button data-rt="${i}" class="${(S.rate == null ? 1 : S.rate) === i ? 'on' : ''}">${n}</button>`).join('')}</div></div>
  <div class="h4" style="margin-top:14px">장 이동</div><div class="seg" id="jmp">${S.scn.chapters.map((c, i) => `<button data-j="${i}" class="${S.scene.ch === i ? 'on' : ''}">${esc(c.title)}</button>`).join('')}</div><p class="sm mu" style="margin:4px 0 0">고른 장의 첫 장면으로 가요. 지금까지의 기록은 그대로 남아요.</p>
  <div class="setrow"><span>안내 다시 보기</span><button id="tipr" style="min-height:36px;padding:4px 12px">보기</button></div>
  <div class="setrow"><span>방 코드</span><b>${esc(S.code)}</b></div>
  <div class="rowb" style="margin-top:14px"><button id="rst2">처음부터 다시</button><button id="lv">방 나가기</button></div>`);
  $('#mx').onclick = closeModal; document.querySelectorAll('[data-th]').forEach((b) => (b.onclick = () => { prefs.theme = b.dataset.th; applyPrefs(); settings(); }));
  document.querySelectorAll('[data-rt]').forEach((b) => (b.onclick = () => { S.rate = +b.dataset.rt; send({ type: 'cfg', v: S.rate }); settings(); }));
  document.querySelectorAll('[data-sp2]').forEach((b) => (b.onclick = () => { prefs.split = b.dataset.sp2 === '1'; applyPrefs(); renderAll(); settings(); }));
  document.querySelectorAll('[data-j]').forEach((b) => (b.onclick = () => { if (confirm(S.scn.chapters[+b.dataset.j].title + '으로 이동할까요?')) { send({ type: 'jump', i: +b.dataset.j }); closeModal(); tab = 'story'; } }));
  $('#tipr').onclick = () => { LS.set('lumia.tip', 0); tab = 'story'; closeModal(); renderAll(); };
  document.querySelectorAll('[data-sa]').forEach((b) => (b.onclick = () => { prefs.sans = b.dataset.sa === '1'; applyPrefs(); settings(); }));
  $('#fm').onclick = () => { prefs.fs = Math.max(14, prefs.fs - 1); applyPrefs(); }; $('#fp').onclick = () => { prefs.fs = Math.min(24, prefs.fs + 1); applyPrefs(); };
  $('#rst2').onclick = () => { if (confirm('처음부터 다시 시작할까요? (캐릭터는 유지)')) { send({ type: 'restart' }); closeModal(); } };
  $('#lv').onclick = () => { if (confirm('방에서 나갈까요? (방 코드로 다시 들어올 수 있어요)')) { sess = null; LS.set('lumia.sess', null); location.href = '/'; } }; }
boot();

// ── 오늘의 사건 (일상 사건 선택지) ──
function evCard() { const v = S.ev; if (!v) return ''; const me = S.players[S.role], who = S.players[v.role].name, bonus = me.mind <= 0 ? -2 : 0;
  const body = v.role === S.role ? v.opts.map((o) => `<button class="ax" data-ev="${o.i}" ${o.lock ? 'disabled' : ''}>${ic(o.stat)}<span><b>${esc(o.label)}</b><small>${statName(o.stat)} · DC ${o.dc} · ${chance(o.dc, me.stats[o.stat] + bonus)}%${o.lock ? ' · 능력치·유대 부족' : ''}</small></span></button>`).join('') : `<p class="mu sm">${esc(who)}의 선택을 기다리는 중이에요. 다음 날이 되면 동행자가 대신 고릅니다.</p>`;
  return `<div class="evc"><div class="evh">${ic('eye')}<span>${v.title.startsWith('조우') ? '조우' : '오늘의 사건'}</span><b>${esc(v.title)}</b></div><p class="sm" style="margin:4px 0 8px">${esc(v.scene)}</p>${body}</div>`; }

// ── 꿈세계 전용 화면: 글자 대신 아이콘이 5×5 설계도에 채워진다 ──
const DI = { cotton: 'cotton', bridge: 'bridge', choco: 'choco', bed: 'bed', exit: 'exit', pack: 'bag', shelf: 'book', beacon: 'beacon', skylight: 'luck', flowerbed: 'herb' };
function dreamTab() { const D = S.dream; if (!D) return '<p class="mu sm">꿈세계 정보가 없어요.</p>'; const PN = ['아침', '낮', '저녁', '밤'], L = (S.loc || {}).dream, can = L && S.per <= 3 && L.at.includes(S.per);
  const CL = { M: '#e59ab8', K: '#9db38a' }, cells = Array.from({ length: 25 }, (_, i) => D.built[i] || null);
  const grid = `<div class="dgrid">${cells.map((b) => { const it = b && D.items.find((x) => x.k === b.k); return b && it ? `<div class="dc1 on" style="--c:${CL[b.by]}" title="${esc(it.n)}">${ic(DI[b.k] || 'gate')}</div>` : `<div class="dc1">${ic('plus')}</div>`; }).join('')}</div><div class="dleg"><span style="--c:${CL.M}"><i></i>${esc(S.players.M ? S.players.M.name : '모르포')}</span><span style="--c:${CL.K}"><i></i>${esc(S.players.K ? S.players.K.name : '케야티')}</span><span class="mu">칸이 아이콘으로 채워져요 · ${D.built.length}/25</span></div>`;
  const pips = (n, mx, icn, cls) => `<div class="pp ${cls}">${Array.from({ length: mx }, (_, i) => `<span class="${i < n ? 'f' : ''}">${ic(icn)}</span>`).join('')}</div>`;
  const warn = D.h >= 6 && D.s === 0 ? '아름답지만 나갈 문이 없는 성이에요. 안전한 건물을 지어 두세요. 잠들 때마다 균열이 벌어져요.' : D.s >= 3 ? '안전이 충분해요. 잠들 때마다 시간의 균열이 한 칸씩 메워져요.' : D.exits ? '비상구가 있어요.' : '모르포가 지으면 행복이, 케야티가 지으면 안전이 더 크게 쌓여요. 둘 다 필요해요.';
  const todo = D.items.map((x, i) => ({ x, i })).filter(({ x }) => !x.by);
  const list = todo.length ? `<div class="bgrid">${todo.map(({ x, i }) => `<button class="bld" data-xl="dream" data-xi="${i}" ${can ? '' : 'disabled'}><span class="bi">${ic(DI[x.k] || 'gate')}</span><b>${esc(x.n)}</b><small>${ic('hp')}${x.h} ${ic('WIL')}${x.s}</small></button>`).join('')}</div>` : '<p class="mu sm">모든 건물을 지었어요.</p>';
  const done = D.items.filter((x) => x.by).map((x) => `<span class="chip" style="--c:${CL[x.by]}">${ic(DI[x.k] || 'gate')} ${esc(x.n)}</span>`).join('');
  return `<div class="dtip"><b>이렇게 해요</b><span>① 아래 건물 아이콘을 눌러 짓기 → ② 판정에 성공하면 설계도에 아이콘이 채워져요 → ③ 안전을 3 이상 쌓으면 잠들 때 균열이 메워져요.</span></div>
  <div class="h4">행복 ${D.h}</div>${pips(Math.min(10, Math.ceil(D.h / 2)), 10, 'hp', 'h')}<div class="h4">안전 ${D.s}</div>${pips(Math.min(8, D.s), 8, 'WIL', 's')}<p class="sm mu" style="margin:8px 0">${warn}</p>${grid}
  <div class="h4">짓기 ${can ? '' : `<span class="mu">· 저녁·밤에만 가능 (지금은 ${S.per <= 3 ? PN[S.per] : '깊은 밤'})</span>`}</div>${list}${done ? `<div class="h4">지은 건물</div><div class="chips">${done}</div>` : ''}`; }

// ── 첫 안내 · 전학년 프로필 ──
function tipCard() { if (LS.get('lumia.tip', 0)) return ''; return `<div class="tipc"><b>처음이라면</b><ol><li>장면을 읽고 <b>선택지</b>를 골라요. 판정은 d20 + 능력치예요.</li><li>하루가 지나면 <b>오늘의 사건</b>이 이 자리에 떠요.</li><li><b>꿈세계</b> 탭에서 아이콘을 눌러 건물을 지어요.</li><li>역극은 아래 입력창에서 이어 써요. 탭은 맨 아래에 있어요.</li></ol><button id="tipx" class="btn-p">알겠어요</button></div>`; }
function profHtml(role) { const P = (S.scn.profile || {})[role]; if (!P) return ''; const p = P[S.scene.ch || 0]; if (!p) return ''; const r = roleOf(role);
  const st = p.stats ? `<div class="pst">${['체력', '공격', '방어', '민첩'].map((n, i) => `<span>${n}<i>${'■'.repeat(p.stats[i])}${'□'.repeat(5 - p.stats[i])}</i></span>`).join('')}</div>` : '';
  return `<details class="prof" style="--c:${r.color}" ${role === S.role ? 'open' : ''}><summary><b>${esc(r.name)}</b> · ${esc(p.age)}<small>${esc(p.t)}</small></summary><p class="pq">“${esc(p.q)}”</p><dl><dt>신장/체중</dt><dd>${esc(p.hw)}</dd><dt>소속</dt><dd>${esc(p.house)}</dd><dt>지팡이</dt><dd>${esc(p.wand)}</dd><dt>외관</dt><dd>${esc(p.look)}</dd></dl><div class="chips">${p.items.map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>${st}</details>`; }
// ── 정체성 · 플랜 카드 (캐릭터 탭 맨 위) ──
// 케야티 성인기: 시간의 균열이 깊을수록 사고 장부의 숫자가 흔들린다
function ledgerCard() { if (S.role !== 'K' || S.scene.ch !== 3) return ''; const r = S.rift, lines = r < 3 ? ['공식 기록 — 사망자 0명 · 구조 32명', '근무자 명단에 서명이 있다.'] : r < 7 ? ['기록마다 숫자가 다르다 — 0명 · 3명', '사망자 명단에도 이름이 남아 있다.'] : ['0명, 3명, 혹은 그보다 많은 명단', '어느 기록에는 구조자가 아니라 사망자로 적혀 있다.'];
  return `<div class="lastr" style="border-left:3px solid #9db38a;margin-bottom:10px"><div class="h4">성 뭉고 제3병동 사고 장부</div><p class="sm" style="margin:4px 0">${lines[0]}</p><small class="mu">${lines[1]} ${S.anchored ? '오늘의 닻이 내려져 있다.' : '오늘의 기록을 쓰면 숫자가 덜 흔들린다.'}</small></div>`; }
function sheet() { const me = S.players[S.role], I = me.idn; const other = Object.keys(S.players).find((k) => k !== S.role), pf = `<div class="h4">전학년 프로필</div>${profHtml(S.role)}${profHtml(other)}`; if (!I) return ledgerCard() + sheet0() + pf;
  const mods = Object.entries(I.mod).map(([k, v]) => `${statName(k)} ${v > 0 ? '+' : '−'}${Math.abs(v)}`).join(' · '), plan = S.role === 'K' ? `<div class="h4" style="margin-top:8px">플랜 B·C ${'●'.repeat(me.plan)}${'○'.repeat(Math.max(0, 2 - me.plan))}</div><p class="sm mu" style="margin:2px 0 0">판정에 실패하면 한 번 더 굴려요. 새 장이 시작되면 채워져요.</p>` : '';
  return `<div class="lastr" style="border-left:3px solid #e59ab8;margin-bottom:10px"><div class="h4">지금의 나 · ${esc(I.n)}</div><p class="sm" style="margin:4px 0">${esc(I.t)}</p><small class="mu">${mods}</small>${plan}</div>` + ledgerCard() + sheet0() + pf; }

// ── 편지함 (v5.10): 받은 편지 · 쓰기 · 보낸 편지. 받은 편지에는 답장 선택지, 쓴 편지는 다음 날 아침 도착(NPC면 답장이 온다).
const mailUnread = () => (S.mail || []).filter((m) => !m.read && m.fromRole !== S.role).length;
function mailTab() {
  const v = ui.mv || 'in', o = S.players[S.role === 'K' ? 'M' : 'K'], inb = (S.mail || []).filter((m) => m.fromRole !== S.role).sort((x, y) => y.deliver - x.deliver || (y.id > x.id ? 1 : -1)), out = (S.mail || []).filter((m) => m.fromRole === S.role && !m.sys).reverse();
  const seg = `<div class="seg" id="mseg">${[['in', `받은 편지${mailUnread() ? ' · ' + mailUnread() : ''}`], ['new', '편지 쓰기'], ['out', '보낸 편지']].map(([k, n]) => `<button data-mv="${k}" class="${v === k ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  const stamp = (m) => `<span class="stamp">${m.deliver > S.day ? '배달 중' : m.day + '일째'}</span>`;
  if (v === 'new') return seg + `<div class="lt"><div class="lt-h">${esc(o.name)}에게</div><input id="msub" placeholder="제목 (선택)" maxlength="30" value="${esc(ui.dsub || '')}"><div class="chips">${['안부를 묻는다', '오늘 있었던 일', '보고 싶다는 말', '다음 약속'].map((t) => `<button data-ch="${t}">${t}</button>`).join('')}</div><textarea id="mtxt" rows="9" maxlength="900" placeholder="편지지에 마음을 적어요…">${esc(ui.draft || '')}</textarea><div class="lt-f"><small class="mu">${o.human ? '내일 아침 부엉이가 전해 줘요.' : o.name + '의 답장은 이틀 뒤에 도착해요.'}</small><button class="btn-p" id="msend">${ic('send')} 보내기</button></div></div>`;
  if (v === 'out') return seg + (out.map((m) => `<div class="it ml"><b>${esc(m.subj || '제목 없음')}</b> ${stamp(m)}<p>${esc(m.text)}</p></div>`).join('') || '<p class="mu sm">보낸 편지가 없어요.</p>');
  const op = ui.mo && inb.find((m) => m.id === ui.mo);
  if (op) return seg + `<button class="ghost" id="mback">‹ 목록</button><div class="lt open"><div class="lt-h">${esc(op.from)}의 편지 ${stamp(op)}${op.to !== S.role ? `<small class="mu"> · ${esc(S.players[op.to].name)} 앞으로 온 편지</small>` : ''}</div>${op.subj ? `<b>${esc(op.subj)}</b>` : ''}<p>${esc(op.text)}</p>${op.sys ? (op.replied ? '<small class="mu">✓ 답장을 보냈어요.</small>' : `<div class="rep">${['정성껏 길게 답장한다 (유대+1 · 마음+1)', '짧게 안부만 적는다 (마음+1)'].map((t, i) => `<button data-rp="${i}" data-id="${op.id}">${t}</button>`).join('')}</div>`) : `<div class="rep"><button id="mrep">이 사람에게 답장 쓰기</button></div>`}</div>`;
  return seg + (inb.map((m) => `<div class="it ml ${m.read ? '' : 'new'}" data-mo="${m.id}"><b>${m.read ? '' : '● '}${esc(m.from)}</b> ${stamp(m)}<p>${esc(m.subj || m.text).slice(0, 46)}…</p></div>`).join('') || '<p class="mu sm" style="text-align:center;margin-top:30px">아직 편지가 없어요.<br>하루가 지나면 부엉이가 찾아와요.</p>');
}
function bindMail() {
  document.querySelectorAll('[data-mv]').forEach((b) => (b.onclick = () => { ui.mv = b.dataset.mv; ui.mo = null; renderSide(); }));
  document.querySelectorAll('[data-mo]').forEach((b) => (b.onclick = () => { ui.mo = b.dataset.mo; send({ type: 'read', id: b.dataset.mo }); renderSide(); }));
  document.querySelectorAll('[data-rp]').forEach((b) => (b.onclick = () => { send({ type: 'reply', id: b.dataset.id, i: +b.dataset.rp }); toast('답장을 보냈어요'); }));
  const bk = $('#mback'); if (bk) bk.onclick = () => { ui.mo = null; renderSide(); }; const mr = $('#mrep'); if (mr) mr.onclick = () => { ui.mv = 'new'; renderSide(); };
  document.querySelectorAll('[data-ch]').forEach((b) => (b.onclick = () => { const t = $('#mtxt'); t.value += (t.value ? '\n' : '') + ({ '안부를 묻는다': '잘 지내고 있어? 밥은 챙겨 먹었고?', '오늘 있었던 일': '오늘은 이런 일이 있었어. ', '보고 싶다는 말': '보고 싶다. 이 말은 꼭 적어 두고 싶었어.', '다음 약속': '다음에 만나면 같이 ' })[b.dataset.ch]; ui.draft = t.value; t.focus(); }));
  const t = $('#mtxt'), s = $('#msub'); if (t) { t.oninput = () => (ui.draft = t.value); s.oninput = () => (ui.dsub = s.value); $('#msend').onclick = () => { if (!t.value.trim()) return toast('내용을 적어 주세요'); send({ type: 'letter', text: t.value, subj: s.value }); ui.draft = ui.dsub = ''; ui.mv = 'out'; toast('편지를 부쳤어요'); renderSide(); }; }
}
