import { useState } from 'react';

import { useBoardProjectMutations } from '../../lib/useBoardProjectMutations.js';

/**
 * 프로젝트 설정 다이얼로그 + update/remove mutation.
 *
 *  - settingsOpen / settingsError state
 *  - onDelete 성공 시 onDeleteSuccess 콜백으로 라우팅 책임 상위 (페이지) 에 위임
 *
 * @param {{ projectId: string; onDeleteSuccess: () => void }} args
 */
export const useProjectSettingsDialog = ({ projectId, onDeleteSuccess }) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsError, setSettingsError] = useState(/** @type {string | null} */ (null));

  const projectMut = useBoardProjectMutations({
    projectId,
    onError: setSettingsError,
    onDeleteSuccess: () => {
      setSettingsOpen(false);
      onDeleteSuccess();
    },
    onUpdateSuccess: () => {
      setSettingsOpen(false);
      setSettingsError(null);
    },
  });

  return {
    settingsOpen,
    settingsError,
    projectMut,
    openSettings: () => {
      setSettingsOpen(true);
      setSettingsError(null);
    },
    closeSettings: () => {
      setSettingsOpen(false);
      setSettingsError(null);
    },
  };
};
