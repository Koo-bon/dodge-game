// 캐릭터 6명. 각자 배경과 "먹으면 점수 오르는" 오브제가 다르다.
// 피해야 하는 것(HAZARDS)은 가을 컨셉으로 6명 공통.
const HAZARDS = [
  { img: 'obj-ginkgo',   name: '은행' },
  { img: 'obj-chestnut', name: '밤송이' },
  { img: 'obj-deadleaf', name: '낙엽' },
  { img: 'obj-maple',    name: '단풍' }
];

const CHARS = [
  {
    id: 'bonhyuk', name: '본혁', team: '크리랩', tint: '#fff2d4',
    place: '가을 밴쿠버', concept: '밴드 건반 · ASMR로 심신의 안정',
    goodies: [
      { img: 'obj-keyboard',   name: '건반',   pt: 5 },
      { img: 'obj-headphones', name: '헤드폰', pt: 10 },
      { img: 'obj-coffee',     name: '커피',   pt: 5 }
    ]
  },
  {
    id: 'seungil', name: '승일', team: '마케팅2팀', tint: '#d6f5e4',
    place: '여름 칸쿤', concept: '어둠의 기사를 좋아함',
    goodies: [
      { img: 'obj-bat',      name: '박쥐',   pt: 10 },
      { img: 'obj-mask',     name: '가면',   pt: 5 },
      { img: 'obj-cocktail', name: '칵테일', pt: 5 }
    ]
  },
  {
    id: 'yukyung', name: '유경', team: '사업전략', tint: '#ffdfe9',
    place: '가을 밴쿠버', concept: '영화 배급 · 드골을 홍보했다',
    goodies: [
      { img: 'obj-filmreel', name: '필름 릴', pt: 10 },
      { img: 'obj-ticket',   name: '티켓',    pt: 5 },
      { img: 'obj-popcorn',  name: '팝콘',    pt: 5 }
    ]
  },
  {
    id: 'hyunho', name: '현호', team: 'AI AX Lab', tint: '#d8ecff',
    place: '가을 밴쿠버', concept: '거미의 감각을 지닌 히어로 팬',
    goodies: [
      { img: 'obj-web',        name: '거미줄',  pt: 5 },
      { img: 'obj-webshooter', name: '웹슈터',  pt: 10 },
      { img: 'obj-spider',     name: '거미',    pt: 5 }
    ]
  },
  {
    id: 'yeonsu', name: '연수', team: '마케팅1팀', tint: '#fff5c4',
    place: '여름 휴양지', concept: '리조트에서 보내는 여름',
    goodies: [
      { img: 'obj-float',      name: '튜브',       pt: 5 },
      { img: 'obj-icecream',   name: '아이스크림', pt: 10 },
      { img: 'obj-sunglasses', name: '선글라스',   pt: 5 }
    ]
  },
  {
    id: 'suyeon', name: '수연', team: '마케팅5팀', tint: '#ebe0ff',
    place: '가을 퀘벡', concept: '단추 눈 소녀의 세계',
    goodies: [
      { img: 'obj-button', name: '단추',      pt: 5 },
      { img: 'obj-key',    name: '열쇠',      pt: 10 },
      { img: 'obj-cat',    name: '검은 고양이', pt: 5 }
    ]
  }
];
