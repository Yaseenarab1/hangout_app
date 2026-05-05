import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Returns the current app state ('active' | 'background' | 'inactive').
 * Used to refresh server data when the user returns from background.
 */
export function useAppState(): AppStateStatus {
  const [state, setState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', setState);
    return () => sub.remove();
  }, []);

  return state;
}
