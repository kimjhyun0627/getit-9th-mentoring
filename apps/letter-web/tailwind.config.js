import preset from '@getit/config-tailwind/preset';

/**
 * letter-web Tailwind config — Warm 페르소나.
 * - 베이지 벽지 톤 + 파스텔 포스트잇 4색 (PINK / MINT / LEMON / LAVENDER)
 * - 손글씨 액센트 폰트 (Gaegu / Nanum Pen Script) — 본문은 Pretendard 유지
 * - 다크모드: 짙은 브라운(mocha) + 베이지 한 스푼 (warm.html `dark-scope`)
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'system-ui', 'sans-serif'],
        hand: ['Gaegu', 'cursive'],
        pen: ['Nanum Pen Script', 'cursive'],
      },
      colors: {
        // warm.html 시안에서 그대로 가져온 팔레트.
        // #372 tone audit (Phase 6e):
        //   라이트 "너무 밝다" → cream 톤다운 (#FAF6F0 → #F5EEDF), cream2 도 동조.
        //   다크 "너무 어둡다" → mocha lift (#2C2420 → #3A2F29 = 기존 mocha2 값).
        //                       mocha2/mocha3 도 한 단계씩 lift 해서 layering 유지.
        //   직접 bg-cream / bg-mocha2 / bg-mocha3 쓰는 컴포넌트가 새 배경 대비 충돌 없도록.
        cream: '#F5EEDF',
        cream2: '#EAE0CB',
        peach: '#F4D7C8',
        peachDk: '#E8B89F',
        sage: '#93A487',
        sageDk: '#6F8366',
        ink: '#3A2E27',
        ink2: '#5A4A3F',
        mocha: '#3A2F29',
        mocha2: '#473A33',
        mocha3: '#564840',
        beige: '#E8D6C4',
        beige2: '#C9B49E',
        rose: '#D9A892',
        sageW: '#A8B89A',
        // 포스트잇 4색 — color enum (MessageColor) 매핑 (light/dark 각각).
        // ⚠️ 키 이름은 반드시 `note` — Postit.jsx / BoardStates.jsx / Postit.test.jsx /
        //   index.css `.note` 모두 `bg-note-*` 클래스로 참조. 과거 `sticky` 였던 시절
        //   FE 가 `bg-note-*` 로 쓰는 동안 정의가 비어있어 4색이 전혀 적용되지 않는
        //   silent regression 발생 (#358). 이름 변경 금지 — alias 추가가 필요하면
        //   `sticky: { ... }` 를 따로 추가할 것.
        note: {
          pink: '#FBD6DC',
          mint: '#CFE5D3',
          lemon: '#FBE9B7',
          lavender: '#E0D2EE',
          pinkDk: '#E8B7BF',
          mintDk: '#B5D2BA',
          lemonDk: '#E8D29A',
          lavenderDk: '#C9B8DC',
        },
      },
      borderRadius: {
        blob: '24px',
      },
    },
  },
};
