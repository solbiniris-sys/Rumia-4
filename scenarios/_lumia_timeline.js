// 루미아 — 시간선·대사 정합성 패치 (v5.14). lumia_hogwarts.js 에서 _lumia_fix 직후 호출.
module.exports = (L) => {
  const sc = L.scenes;
  const T = (id, f) => { const s = sc[id]; if (s && typeof s.text === 'string') s.text = f(s.text); };
  const chain = (ids) => { for (let i = 0; i < ids.length - 1; i++) if (sc[ids[i]]) sc[ids[i]].next = ids[i + 1]; };
  const lab = (id, who, i, k, f) => { const c = sc[id] && sc[id].choices && sc[id].choices[who] && sc[id].choices[who][i]; if (c && c[k]) c[k] = f(c[k]); };

  // 1학년: 첫 만남(소개·이름)이 맨 앞. 객실(행복) → 배정 순서, 비상구 이야기는 꿈세계 소개 뒤.
  chain(['train', 'blueprint', 'names', 'ticket', 'compartment', 'choco', 'happy', 'sorting', 'tower']);
  chain(['sketch', 'exit']);
  chain(['landing', 'lastlight']);

  // 4학년: 승강장 재회 → 15cm 굽 → 손 약속(첫 대화) → 꽃나무 산책 → 꽃반지 → 건실한 나흘 → … → 보가트 → 방학
  chain(['c2_open', 'summerletter', 'reunion', 'heel', 'name', 'notice', 'testimony', 'rescue', 'sweets', 'boom',
    'flowername', 'ring', 'pressed', 'four', 'walk4', 'tree', 'heracles', 'thunder', 'forbid', 'runhands',
    'umbrella', 'rainhalf', 'bench', 'fever', 'lamp', 'mimic', 'jealous', 'imitate', 'bogart', 'birthday', 'summerend', 'c3_open']);
  T('ring', () => '죽은 나무 앞에서 돌아서는 길. 모르포가 발치의 풀꽃으로 반지를 엮어 케야티의 검지에 끼워 준다. 케야티는 그 꽃에 이름을 붙인다. (이 이름이 별자리 탭에 열린다: 루미아)');
  T('fever', () => '비가 그친 뒤에도 젖은 벤치에 한참 앉아 있던 모르포가 새벽에 열이 오른다. 케야티는 규칙을 한 줄 어기고 기숙사 앞 복도 의자에 앉는다. 응급 키트는 이미 열려 있다.');

  // 7학년: 개학(이름 · 벨비 저택 · 짧아진 머리) → 모임 … → 마지막 학기(소감 → 포옹) → 무도회 → 한소 → 전야
  chain(['c3_open', 'apology', 'callname', 'fire', 'hair', 'haircut', 'neck', 'club', 'blackboard', 'nightwalk', 'vanish', 'kiwi',
    'astro', 'constellation', 'rooftop', 'prefect', 'lovenote', 'cook', 'handbrush', 'sea', 'confess', 'answer',
    'lastreturn', 'graduation', 'diary', 'ball', 'afterdance', 'hanso', 'eve', 'c4_open']);
  T('callname', () => '새 학기 개학 날. “내 이름, 불러줘!” 방학을 보내고 돌아온 사람이 먼저 말한다. 듣고 싶었던 건 다른 이름일지도 모른다.');


  // ── v5.16 추가 장면 3개 (원작 대화의 약속·복선을 이어 준다) ──
  const C = (label, tag, stat, say, fx) => ({ label, tag, stat, say, ...(fx ? { fx } : {}) });
  sc.shoeletter = { id: 'shoeletter', ch: 0, title: '공주님께 보내는 편지', text: '올빼미 우체국. 모르포가 깃펜을 쥔 채 첫 줄에서 멈춰 있다. “공주님, 신발이 발에 안 맞아서 넘어졌어요……” 케야티가 어깨 너머로 보고 고개를 젓는다. 그 문장은 사실이지만, 공주님이 읽고 걱정할 이야기이기도 하다.',
    choices: { K: [C('“사실대로 쓰되, 다치지 않았다는 말을 먼저 적어라.”', 'safe', 'INS', '‘신발이 맞지 않아 넘어질 뻔했다. 가능하다면 맞는 신발을 보내 달라.’ 정도면 충분하다.', { bond: 1 }), C('편지 끝에 한 줄을 덧붙이게 한다. “호그와트의 첫 친구도 생겼어요.”', 'near', 'CHA', '(공주님이 안심할 만한 문장이다. 정확히는 그쪽을 노렸다.)', { bond: 1, heart: 1 })],
      M: [C('“어제 계단에서 넘어졌는데, 굉장히 재밌었어요!”', 'near', 'CHA', '(케야티의 한숨이 길어진다.)', { heart: 1 }), C('편지 위에 점 하나, 선 하나, 면 하나로 케야티를 그려 넣는다', 'know', 'INS', '공주님도 이 사람을 알아야 해. 어깨가 반듯한 직선인 사람.', { bond: 1 })] }, next: 'sketch' };
  sc.skyagain = { id: 'skyagain', ch: 1, title: '같은 날, 같은 하늘', text: '9월 어느 밤의 천문탑. 3년 전 이곳에서 “같은 날 같은 시간에 돌아오자”고 약속했다. 케야티는 별자리 지도와 회중시계를 꺼내 하늘을 맞춰 본다. 북극성은 그 자리에 있다. 다만 두 사람의 키는 그때와 다르다. 난간에 팔이 닿는 높이도.',
    choices: { K: [C('“약속은 기록보다 오래 남는다더니. 검증 결과, 성공이다.”', 'know', 'INS', '오늘을 기억하고 있으니 가설은 입증됐다. 다음 약속도 받겠다.', { bond: 2, heart: 1 }), C('말없이 모르포 쪽으로 지도를 기울여 준다', 'near', 'CHA', '(독수리와 백조가 보이는 쪽이다.)', { bond: 1, heart: 1 })],
      M: [C('“봐, 하늘은 가만히 걸려 있었어! 우리가 달라졌을 뿐이야.”', 'near', 'CHA', '그러니 또 오자. 이번엔 처녀자리가 보이는 계절에.', { bond: 1, heart: 1 }), C('3년 전처럼 손을 내밀어 새끼손가락을 건다', 'safe', 'WIL', '약속! 언젠가 다시 볼 수 있다고 했잖아.', { bond: 2 })] }, next: 'lamp_after' };
  sc.margin = { id: 'margin', ch: 2, title: '지침서의 여백', text: '무도회가 끝난 밤, 모르포의 가방에서 낡은 책 한 권이 떨어진다. 케야티가 오래전 빌려준 《건축물의 구조적 결함과 피난 동선 최적화》. 여백마다 연필 자국이 빼곡하다. 과자 성의 설계도 옆에는 삐뚤빼뚤한 글씨로 ‘비상구 — 어서오세요 말고’라고 적혀 있다.',
    choices: { K: [C('“반납 기한은 신경 쓰지 말라고 했었지.” 책을 그대로 돌려준다', 'safe', 'WIL', '그럼 계속 가지고 있어도 된다. 아주 오래.', { bond: 1, heart: 1 }), C('‘어서오세요 말고’ 아래에 작게 적는다. “…장식은 괜찮다.”', 'near', 'CHA', '(비상구에 별 장식 정도는 허용하기로 했다.)', { bond: 2, heart: 1 })],
      M: [C('“케야티 씨가 말한 대로 전부 읽었어. 이해 못 한 건 물어볼 참이었고.”', 'know', 'INS', '7년 치 질문이 밀려 있어. 순서대로 받아 줘.', { bond: 1 }), C('책을 도로 가방에 넣으며 웃는다. “이건 졸업해도 못 돌려줘.”', 'near', 'CHA', '(빌려 간 사람에게만 허락되는 거짓말이다.)', { bond: 1, heart: 1 })] }, next: 'hanso' };

  chain(['shoes', 'shoeletter', 'sketch']);
  chain(['lamp', 'skyagain', 'mimic']);
  chain(['afterdance', 'margin', 'hanso']);
  sc.skyagain.next = 'mimic';
  // ── v5.17 추가 장면 3개 ──
  sc.whomade = { id: 'whomade', ch: 0, title: '누가 세웠을까', text: '도서관 창가. 모르포가 호그와트 건축사 책을 펼쳐 놓고 묻는다. “이 계단은 누가, 왜 움직이게 만들었을까? 마법은 대체 어디서 왔을까?” 케야티는 수첩에 질문을 옮겨 적는다. 답이 없는 질문은 적어 두면 언젠가 답이 생기기도 한다.',
    choices: { K: [C('“건물은 이유 없이 저절로 이런 형태가 되지 않는다. 기록이 있다면 읽어 보고 싶다.”', 'know', 'INS', '누군가는 설계했고, 누군가는 바꾸었겠지.', { bond: 1 }), C('“오늘은 계단 하나만 정하자. 질문은 한 번에 하나씩.”', 'safe', 'WIL', '(첫 질문은 서쪽 계단이 움직이는 주기가 되었다.)', { bond: 1, heart: 1 })],
      M: [C('“이유를 알면 꿈세계를 완성할 방법도 알게 될지 몰라!”', 'know', 'INS', '누군가 이 세계를 세우려고 숱한 노력을 기울였을 거야. 그게 누군지 궁금해.', { bond: 1 }), C('서가 사이를 뛰어다니다 책 세 권을 연달아 떨어뜨린다', 'near', 'CHA', '(케야티가 두 권을 받아 낸다. 한 권은 포기했다.)', { heart: 1 })] }, next: 'study' };
  sc.latereply = { id: 'latereply', ch: 1, title: '늦게 도착한 답', text: '보가트 수업이 있고 며칠 뒤, 도서관 창가 자리에 접힌 쪽지가 놓여 있다. 케야티의 반듯한 글씨다. “이번 답을 주기 위해선 오래 걸릴 거라 했다. 아직 다 쓰지는 못했다. 다만 중간 보고는 한다.” 모르포가 쪽지를 펼치기 전에 숨부터 고른다.',
    choices: { K: [C('쪽지의 첫 줄을 직접 읽어 준다. “필요해서가 아니라, 같이 보냈기 때문에.”', 'near', 'CHA', '아직 믿는 데는 시간이 걸린다. 하지만 적어 둘 수는 있다.', { bond: 2, heart: 2 }), C('쪽지 아래에 빈칸 한 줄을 남겨 둔다', 'safe', 'WIL', '(남은 답은 예상하지 못한 내일을 위한 자리다.)', { bond: 1, heart: 1 })],
      M: [C('“천천히 써도 돼. 모르포는 네 자리를 계속 만들어 둘 거니까.”', 'near', 'CHA', '(말하고 나서야 귀 끝이 붉어진다.)', { bond: 2, heart: 1 }), C('쪽지를 별 모양으로 접어 별자리 지도 사이에 끼운다', 'know', 'INS', '이건 박사의 연구 자료로 보관할게.', { bond: 1 })] }, next: 'birthday' };
  sc.postit = { id: 'postit', ch: 3, title: '포스트잇의 답장', text: '별 좌표를 따라간 끝에서, 케야티는 책 한 권을 되돌려 받는다. 「인간의 행복은 어디에서 기인하는가」. 케야티가 붙여 둔 포스트잇마다 다른 필체가 한 줄씩 달려 있다. 마지막 장 안쪽, 비어 있던 자리에 짧은 글씨가 있다. ‘안부: 살아 있다. 그쪽은?’',
    choices: { K: [C('같은 자리에 답을 적는다. “살아 있다. 밥도 먹었다.”', 'near', 'CHA', '(그 정도면 안부로 충분하다고, 처음으로 생각한다.)', { bond: 2, heart: 1 }), C('수첩에 날짜와 함께 옮겨 적는다. “이건 오늘 내가 적었다.”', 'know', 'INS', '기록이 어긋나도 이 줄만큼은 지키겠다.', { bond: 1 })],
      M: [C('책을 부치기 전 마지막 장을 한참 들여다본다', 'safe', 'WIL', '(이 한 줄을 쓰기까지 두 해가 걸렸다.)', { bond: 1 }), C('“답이 없어도 괜찮아.” 하고 적었다가 줄을 긋는다', 'near', 'CHA', '……답이 오면 좋겠다.', { bond: 1, heart: 1 })] }, next: 'seat' };

  sc.sketch2 = null; delete sc.sketch2;
  chain(['library', 'whomade', 'study']);
  chain(['bogart', 'latereply', 'birthday']);
  // 성인: 2005년의 이별이 먼저, 그 뒤에 책·꽃가지·편지, 2007년 재회
  chain(['c4_open', 'doors', 'split', 'books', 'knock', 'rainletter', 'seat', 'night']);
  chain(['virgo', 'rain', 'final', 'stay']);
  T('doors', () => '2005년. 마법계 전역에 시간 균열이 번진다. 판테온과 컨티눔의 조직이 갖춰지던 그해, 모르포는 케야티에게 아무 말도 남기지 않고 떠난다. 두 사람은 서로 다른 문 앞에 선다.');
  T('books', () => '성 뭉고의 야간 근무 뒤, 두 권의 책이 도착했다. 오래전 빌려준 지침서와, 2004년 말 머글 세계에서 출간된 「인간의 행복은 어디에서 기인하는가」. 어디에도 안부 한 줄은 없다.');
  T('night', (t) => '(2005년 이전, 성 뭉고에서 있었던 일. 케야티의 얼굴에 흉터가 남은 그날이다.) ' + t);

  chain(['rainletter', 'postit', 'seat']);
};
