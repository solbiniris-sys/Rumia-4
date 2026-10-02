// world.js — 구(舊) 루미아 게임의 이벤트 엔진·꿈세계·편지를 TRPG 서버에 이식한 어댑터.
// legacy/ 는 원본 데이터(ch1~7 사건, 편지, 꿈세계 건물) 그대로. 여기서는 판정·기록 형식만 TRPG 규칙으로 바꾼다.
const AD = require('./legacy/data'); require('./legacy/content')(AD);
const AE = require('./legacy/engine')(AD);
const SM = { 상상: 'MAG', 호기심: 'INS', 다정: 'CHA', 관찰: 'INS', 신중: 'WIL', 용기: 'AGI' }; // 옛 6능력치 → 현 5능력치
const CHMAP = { 0: 0, 1: 3, 2: 6 };                                                           // TRPG 장 → 옛 장 (성인기는 일상 사건 없음)
const LM = { field: 'garden', hogsmeade: 'village', greenhouse: 'garden', forbidden: 'library', infirmary: 'dorm', library: 'library', tower: 'tower', lake: 'lake', hall: 'hall', stairs: 'stairs' }; // TRPG 장소 → 옛 사건 장소
const jong = (c) => { const n = c.charCodeAt(0) - 0xAC00; return n < 0 || n > 11171 ? 0 : n % 28; };
const josa = (t) => t.replace(/([가-힣])(이\(가\)|은\(는\)|을\(를\)|와\(과\)|으로\(로\))/g, (m, c, j) => { const f = jong(c), h = f > 0; return c + ({ '이(가)': h ? '이' : '가', '은(는)': h ? '은' : '는', '을(를)': h ? '을' : '를', '와(과)': h ? '과' : '와', '으로(로)': h && f !== 8 ? '으로' : '로' })[j]; });

const PE = require('./place_events');
const ENC = [
  { s: '{L}에서 {M}와(과) {K}이(가) 같은 자리에 닿았다. 서로 여기 있을 줄은 몰랐다는 얼굴이다.', o: [
    ['먼저 말을 건다', '다정', 8, '짧은 인사가 이어져 어느새 나란히 걷고 있었다.', '말이 엇갈려 어색하게 웃었다. 그래도 자리를 뜨지는 않았다.', 2, 1],
    ['말없이 곁에 선다', '신중', 8, '말하지 않아도 되는 침묵이 한동안 편안하게 이어졌다.', '침묵이 길어져 먼저 눈을 피했다. 곁은 지켰다.', 2, 1],
    ['모른 척 하던 일을 계속한다', '관찰', 7, '곁눈질로 서로의 손놀림을 확인했다. 같은 속도라는 걸 알았다.', '결국 둘 다 손을 멈추고 웃어 버렸다.', 1, 1]] },
  { s: '{M}와(과) {K}이(가) 같은 것을 찾으러 {L}에 와 있었다. 손끝이 거의 닿을 뻔했다.', o: [
    ['양보하고 같이 찾자고 한다', '다정', 8, '둘이 찾으니 절반의 시간이면 충분했다.', '서로 양보하다 끝내 아무도 가져가지 못했다. 웃음만 남았다.', 2, 1],
    ['먼저 손을 뻗는다', '용기', 9, '손이 먼저 닿았다. 상대가 못 이긴다는 듯 어깨를 으쓱했다.', '손이 겹쳐 둘 다 움찔했다. 얼굴이 조금 붉어졌다.', 1, 1],
    ['어디서 들었는지 맞춰 본다', '호기심', 9, '같은 소문에서 출발했다는 걸 알았다. 이야기가 길어졌다.', '추측이 엇나갔다. 그래도 서로의 생각을 조금 알게 되었다.', 2, 1]] },
  { s: '해가 기울자 {L}의 그림자가 길어졌다. {M}와(과) {K}은(는) 돌아갈 길이 같다.', o: [
    ['같이 돌아가자고 한다', '다정', 7, '발걸음이 자연스럽게 맞춰졌다. 길이 짧게 느껴졌다.', '대답이 늦었다. 그래도 반 걸음 뒤에서 따라 걸었다.', 2, 1],
    ['오늘 있었던 일을 묻는다', '호기심', 8, '평소엔 안 하던 이야기가 흘러나왔다.', '질문이 어색하게 떨어졌다. 하지만 상대는 대답을 고민해 주었다.', 2, 1],
    ['먼저 가서 기다린다', '용기', 8, '기다린 자리에서 마주 선 순간, 서로 같은 생각을 했다는 걸 알았다.', '엇갈려 한참 기다렸다. 만난 뒤엔 둘 다 같은 말을 했다. “늦었네.”', 1, 1]] },
  { s: '{L}의 구석에서 누군가 두고 간 작은 물건이 눈에 띄었다. {M}와(과) {K}이(가) 동시에 손을 뻗었다.', o: [
    ['함께 살펴본다', '관찰', 8, '둘이 맞춰 보니 물건에 얽힌 사연의 한 조각이 보였다.', '결론이 나지 않았다. 그래도 같이 고민한 시간이 남았다.', 2, 1],
    ['상상을 덧붙여 본다', '상상', 8, '이야기를 지어 붙이다 보니 서로 같은 장면을 떠올리고 있었다.', '이야기가 엉뚱한 곳으로 흘러 둘 다 웃음이 터졌다.', 2, 1],
    ['원래 자리에 돌려놓는다', '신중', 7, '말없이 눈이 마주쳤다. 같은 판단이었다.', '돌려놓다 떨어뜨렸다. 서로 주워 담으며 투덜거렸다.', 1, 1]] },
  { s: '{L}에 갑자기 소나기가 쏟아졌다. 처마 아래에 {M}와(과) {K}이(가) 나란히 서게 되었다.', o: [
    ['우산이 없다고 솔직히 말한다', '다정', 7, '“그럼 같이 기다리자.” 빗소리가 이야기보다 오래 이어졌다.', '둘 다 우산이 없었다. 젖은 채 마주 보고 웃었다.', 2, 1],
    ['비가 그칠 시간을 계산한다', '관찰', 8, '“십 분.” 정확히 십일 분 만에 그쳤다. {M}이(가) 박수를 쳤다.', '계산이 빗나갔다. 한 시간 가까이 처마 아래에서 이야기를 나눴다.', 1, 1],
    ['빗속으로 먼저 뛰어든다', '용기', 9, '{M}이(가) 따라 뛰었다. 흠뻑 젖어서도 이상하게 즐거웠다.', '미끄러져 넘어졌다. “조심하라고 했는데.” 내민 손은 따뜻했다.', 2, 1]] },
  { s: '{L}의 벽에 붙은 오래된 게시물을 {M}와(과) {K}이(가) 동시에 읽고 있었다. 날짜가 이상하다.', o: [
    ['날짜를 소리 내어 대조한다', '관찰', 9, '둘의 기억이 반 일 차이로 어긋났다. 어느 쪽이 맞는지는 모른다. 일단 기록했다.', '날짜를 소리 내어 읽다 둘이 동시에 틀렸다. 어색하게 웃었다.', 1, 1],
    ['떼어서 가져간다', '용기', 8, '게시물을 조심스럽게 접어 수첩에 끼웠다. {M}이(가) 공범이 된 듯 웃었다.', '떼다가 반이 찢어졌다. 남은 조각이 증거 같아서 더 소중해졌다.', 1, 1]] },
  { s: '{L}에서 {M}이(가) 주머니에서 초콜릿 한 조각을 꺼냈다. 반으로 나누기엔 애매한 크기다.', o: [
    ['반으로 나눈다', '신중', 7, '정확히 반으로 갈라졌다. {K}이(가) “…열량 보충용이다.” 하고 덧붙였다.', '한쪽이 더 컸다. 서로 큰 쪽을 양보하다 결국 둘 다 웃었다.', 2, 1],
    ['오늘 있었던 일을 하나씩 말하고 먹는다', '다정', 8, '한 입에 한 가지씩. 초콜릿이 사라질 때쯤 하루가 정리되었다.', '이야기가 길어져 초콜릿이 녹았다. 손가락까지 핥고 나서야 끝났다.', 2, 1]] },
];
module.exports = ({ log, roll, fmt, pick, roles, active }) => {
  const F = (r, t) => josa(fmt(r, t));
  const sum = (r) => { let h = 0, s = 0, exits = 0; for (const b of (r.dream || {}).built || []) { const x = AD.dream[b.k]; if (!x) continue; h += x.h + (b.by === 'M' && x.h > 0 ? 1 : 0); s += x.s + (b.by === 'K' && x.s > 0 ? 1 : 0); if (b.k === 'exit') exits++; } return { h, s, exits }; };
  const stats = (r) => { const st = {}; for (const k in SM) st[k] = Math.max(...roles(r).map((q) => r.players[q].stats[SM[k]] || 0)); return st; };
  const locked = (r, role, o) => o[7] && (o[7][0] === 'bond' ? r.bond < o[7][1] : (r.players[role].stats[SM[o[7][0]]] || 0) < o[7][1]);
  return {
    built: (r, k) => ((r.dream || {}).built || []).some((b) => b.k === k),
    build(r, role, k) { (r.dream = r.dream || { built: [] }).built.push({ k, by: role }); const x = sum(r); log(r, { t: 'sys', text: `꿈세계 — 행복 ${x.h} · 안전 ${x.s}${x.exits ? ' · 비상구 있음' : ''}` }); },
    // 잠들 때: 안전이 높으면 균열이 아문다. 행복만 쌓고 안전이 없으면 균열이 벌어진다. (비상구 없는 성)
    tick(r) { const x = sum(r); if (x.s >= 3 && r.rift > 0) { r.rift--; log(r, { t: 'sys', text: '꿈세계의 안전이 균열을 얇게 메웠다 — 균열 −1' }); } else if (x.h >= 6 && x.s === 0) { r.rift = Math.min(10, r.rift + 1); log(r, { t: 'gm', text: '아름답지만 나갈 문이 없는 성이다. 어딘가에서 금이 가는 소리가 들린다. (균열 +1)' }); } },
    // 하루가 지날 때: 편지가 오고, 옛 이벤트 엔진이 일상 사건을 하나 고른다. 판정은 TRPG 규칙(d20)으로 자동 진행.
    daily(r, bch) {
      const ach = CHMAP[bch]; if (ach == null) return;
      if (r.evCh !== bch) { r.evCh = bch; r.evDay = 0; } r.evDay++;
      for (const L of AD.letters) if (L.ch === ach && L.d === r.evDay) (r.mail = r.mail || []).push({ id: 's' + (r.mailSeq = (r.mailSeq || 0) + 1), from: L.from, to: L.to === 'm' ? 'M' : 'K', text: F(r, L.t), day: r.day, deliver: r.day, read: 0, sys: 1 });
      const st = stats(r), ar = { ch: ach, day: r.evDay, bond: Math.min(AD.bondCap[ach], Math.max(AD.bondFloor[ach], r.bond)), done: r.evDone = r.evDone || [], recent: r.evRecent = r.evRecent || [], tried: r.tried || {}, clue: Array(r.clues | 0).fill(0), flags: r.flags, p: { mor: { st }, kya: { st } } };
      const e = AE.forced(ar) || AE.choose(ar, null, true); if (!e) return;
      this.begin(r, e, ar, pick(active(r)));
    },
    begin(r, e, ar, dflt) {
      const role = e.who === 'm' ? 'M' : e.who === 'k' ? 'K' : (ar && e.who === 'b' && r.players.K ? 'K' : dflt); if (!r.players[role]) return;
      if (ar) { ar.done.push(e.id); ar.recent.push(e.id); if (ar.recent.length > 4) ar.recent.shift(); }
      log(r, { t: 'gm', text: F(r, `〈${e.title}〉 ${e.scene}`) });
      r.ev = { id: e.id, title: e.title, scene: e.scene, role, opts: e.opts.map((o) => ({ label: o[0], stat: SM[o[1]] || 'INS', dc: o[2], ok: o[3], fail: o[4], bOk: o[5], bNo: o[6], lock: o[7], flag: o[8] })) };
      if (!r.players[role].token) this.resolveEv(r, null);   // 상대 자리가 비어 있으면 동행자가 자동으로
    },
    // 조우: 두 사람이 같은 날 같은 장소에 있을 때(혼자일 땐 동행자가 우연히 같은 곳에) 일어나는 합동 사건. 모든 장소·모든 장에서 가능.
    meet(r, lk, role, ln) {
      if (r.ev) return 0; const k = r.day + ':' + lk; r.enc = r.enc || {}; if (r.enc[k]) return 0; r.enc[k] = 1;
      const T = pick(ENC), Z = (t) => F(r, String(t).replace(/\{L\}/g, ln));
      const e = { id: 'enc', title: '조우 · ' + ln, scene: Z(T.s), opts: T.o.map((o) => [Z(o[0]), o[1], o[2], Z(o[3]), Z(o[4]), o[5], o[6]]) };
      this.begin(r, e, null, role); return 1;
    },
    // 탐색 중 같은 장소에서 일어나는 사건: 그 장소에 묶인 옛 사건만 (장소 일치 ×, 확률은 엔진 기본값)
    encounter(r, lk, bch, role, rate) {
      if (r.ev) return; const pe = PE.filter((e) => e.loc.includes(lk) && e.ch.includes(bch) && (!e.who || e.who === role) && !(r.pdone || []).includes(e.id));
      if (pe.length && Math.random() < [0.25, 0.4, 0.6][rate == null ? 1 : rate]) { const e = pick(pe); (r.pdone = r.pdone || []).push(e.id); this.begin(r, { id: e.id, title: e.t, scene: e.s, who: e.who === 'M' ? 'm' : e.who === 'K' ? 'k' : null, opts: e.o }, null, role); return; }
      const ach = CHMAP[bch], lg = LM[lk]; if (ach == null || !lg) return;
      const st = stats(r), ar = { ch: ach, day: r.evDay || 1, bond: Math.min(AD.bondCap[ach], Math.max(AD.bondFloor[ach], r.bond)), done: r.evDone = r.evDone || [], recent: r.evRecent = r.evRecent || [], tried: r.tried || {}, clue: Array(r.clues | 0).fill(0), flags: r.flags, p: { mor: { st }, kya: { st } } };
      const e = AE.choose(ar, lg, [0.12, 0.25, 0.45][rate == null ? 1 : rate]); if (!e || e.loc !== lg) return; this.begin(r, e, ar, role);
    },
    // 대기 중인 사건 해결: i 가 null 이면 동행자가 가장 승산 있는 선택지를 고른다. 판정은 d20.
    resolveEv(r, i) {
      const v = r.ev; if (!v) return; const p = r.players[v.role];
      const open = v.opts.map((o, k) => [o, k]).filter(([o]) => !locked(r, v.role, [0, 0, 0, 0, 0, 0, 0, o.lock]));
      const pickd = i == null ? open.reduce((a, c) => ((p.stats[c[0].stat] || 0) - c[0].dc > (p.stats[a[0].stat] || 0) - a[0].dc ? c : a), open[0]) : open.find(([, k]) => k === i);
      if (!pickd) return; const o = pickd[0]; r.ev = null;
      const x = roll(r, v.role, o.stat, o.dc, false), good = x.deg === 'ok' || x.deg === 'crit';
      log(r, { t: 'act', ex: 1, role: v.role, name: p.name, label: o.label, check: x, text: F(r, good ? o.ok : o.fail) });
      r.bond = Math.max(0, Math.min(100, r.bond + (good ? o.bOk : o.bNo))); if (o.flag) r.flags[o.flag] = 1;
    },
    evView(r) { const v = r.ev; if (!v) return null; const sc = AE.byId[v.id]; return { title: v.title, scene: F(r, v.scene != null ? v.scene : sc ? sc.scene : ''), role: v.role, opts: v.opts.map((o, k) => ({ i: k, label: F(r, o.label), stat: o.stat, dc: o.dc, lock: !!locked(r, v.role, [0, 0, 0, 0, 0, 0, 0, o.lock]) })) }; },
    // 꿈세계 전용 화면용 데이터
    dreamView(r) { const x = sum(r), have = (r.dream || {}).built || []; return { h: x.h, s: x.s, exits: x.exits, built: have, items: Object.entries(AD.dream).map(([k, d]) => ({ k, n: d.n, d: d.d, h: d.h, s: d.s, by: (have.find((b) => b.k === k) || {}).by || null })) }; },
    summary(r) { const x = sum(r); log(r, { t: 'sys', text: `이야기의 끝 — 유대 ${r.bond} · 마음 ${r.heart} · 증표 ${(r.kept || []).length}개 · 꿈세계 행복 ${x.h}/안전 ${x.s}${x.exits ? ' (비상구 있음)' : ''}` }); },
  };
};
