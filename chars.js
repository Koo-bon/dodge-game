// 피해야 하는 것 두 가지. 6명 공통.
const HAZARDS = [
  { img: 'obj-ginkgo',   name: '은행' },
  { img: 'obj-deadleaf', name: '낙엽' }
];

// 캐릭터 6명. 각자 자기를 상징하는 코스튬을 입고, 배경도 다르다.
const CHARS = [
  { id: 'bonhyuk', name: '본혁', team: '크리랩',    tint: '#cfe6ff',
    place: '가을 밴쿠버',   costume: '건반 무늬 옷 + 헤드폰' },
  { id: 'seungil', name: '승일', team: '마케팅2팀',  tint: '#ffdfb0',
    place: '여름 칸쿤',     costume: '박쥐 코스튬' },
  { id: 'yukyung', name: '유경', team: '사업전략',   tint: '#d7eec6',
    place: '가을 밴쿠버',   costume: '팝콘 코스튬' },
  { id: 'hyunho',  name: '현호', team: 'AI AX Lab', tint: '#ffe0cf',
    place: '가을 밴쿠버',   costume: '거미 코스튬 + 뿔테' },
  { id: 'yeonsu',  name: '연수', team: '마케팅1팀',  tint: '#bceaf3',
    place: '여름 휴양지',   costume: '플라밍고 튜브' },
  { id: 'suyeon',  name: '수연', team: '마케팅5팀',  tint: '#d2e8dd',
    place: '가을 퀘벡',     costume: '검은 고양이 코스튬' }
];
