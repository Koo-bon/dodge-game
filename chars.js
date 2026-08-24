// 피해야 하는 것 두 가지. 6명 공통.
const HAZARDS = [
  { img: 'obj-ginkgo',   name: '은행' },
  { img: 'obj-deadleaf', name: '낙엽' }
];

// 캐릭터 6명. 가끔 자기 오브제(fever)가 떨어지고, 그걸 먹으면 피버타임에 들어간다.
const CHARS = [
  { id: 'bonhyuk', name: '본혁', team: '크리랩',    tint: '#cfe6ff', want: '밴쿠버',
    fever: { img: 'fev-headphones', name: '헤드폰' } },
  { id: 'seungil', name: '승일', team: '마케팅2팀',  tint: '#ffdfb0', want: '칸쿤',
    fever: { img: 'fev-bat',        name: '박쥐' } },
  { id: 'yukyung', name: '유경', team: '사업전략',   tint: '#d7eec6', want: '밴쿠버',
    fever: { img: 'fev-filmreel',   name: '필름 릴' } },
  { id: 'hyunho',  name: '현호', team: 'AI AX Lab', tint: '#ffe0cf', want: '밴쿠버',
    fever: { img: 'fev-web',        name: '거미줄' } },
  { id: 'yeonsu',  name: '연수', team: '마케팅1팀',  tint: '#bceaf3', want: '휴양지',
    fever: { img: 'fev-float',      name: '튜브' } },
  { id: 'suyeon',  name: '수연', team: '마케팅5팀',  tint: '#d2e8dd', want: '퀘벡',
    fever: { img: 'fev-key',        name: '열쇠' } }
];
