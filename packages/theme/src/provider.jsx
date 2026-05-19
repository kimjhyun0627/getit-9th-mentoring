import { useEffect } from 'react';

import { useTheme } from './store.js';

/**
 * 앱 루트에 마운트. 다크모드 초기화 + 시스템 변경 구독.
 *
 * @param {{ children: React.ReactNode }} props
 */
export const ThemeProvider = ({ children }) => {
  const hydrate = useTheme((s) => s.hydrate);
  useEffect(() => hydrate(), [hydrate]);
  return children;
};
