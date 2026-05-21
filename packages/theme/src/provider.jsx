import { useEffect } from 'react';

import { useTheme } from './store.js';

/**
 * 앱 루트에 마운트. 다크모드 초기화 + 시스템 변경 구독.
 *
 * @param {{
 *   children: React.ReactNode,
 *   cookieDomain?: string,
 * }} props
 *  - cookieDomain: 쿠키 domain override (dev/test/staging 용).
 *    미지정 시 production(*.get-it.cloud) 자동 감지, 그 외는 현재 호스트로 저장.
 */
export const ThemeProvider = ({ children, cookieDomain }) => {
  const hydrate = useTheme((s) => s.hydrate);
  const setCookieDomain = useTheme((s) => s.setCookieDomain);
  useEffect(() => {
    setCookieDomain(cookieDomain);
    return hydrate();
  }, [hydrate, setCookieDomain, cookieDomain]);
  return children;
};
