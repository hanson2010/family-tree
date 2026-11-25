'use client';

import * as React from 'react';
import type { KinshipOptions, KinshipRegion, KinshipStyle } from '@/lib/chinese-kinship';

/** How kinship terms are worded, kept in this browser: formal by default, as the app always was */
export const DEFAULT_KINSHIP_OPTIONS: Required<KinshipOptions> = { region: 'southern', style: 'formal' };
const STORAGE_KEY = 'kinshipSettings';

interface KinshipSettingsContextType {
  options: Required<KinshipOptions>;
  setOptions: (options: Required<KinshipOptions>) => void;
}

const KinshipSettingsContext = React.createContext<KinshipSettingsContextType | undefined>(undefined);

function readStored(): Required<KinshipOptions> {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<KinshipOptions> | null;
    const region: KinshipRegion = stored?.region === 'northern' ? 'northern' : 'southern';
    const style: KinshipStyle = stored?.style === 'casual' ? 'casual' : 'formal';
    return { region, style };
  } catch {
    return DEFAULT_KINSHIP_OPTIONS;
  }
}

export function KinshipSettingsProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptionsState] = React.useState(DEFAULT_KINSHIP_OPTIONS);

  React.useEffect(() => {
    setOptionsState(readStored());
  }, []);

  const setOptions = React.useCallback((next: Required<KinshipOptions>) => {
    setOptionsState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the choice lasts until the page is closed
    }
  }, []);

  const value = React.useMemo(() => ({ options, setOptions }), [options, setOptions]);
  return <KinshipSettingsContext.Provider value={value}>{children}</KinshipSettingsContext.Provider>;
}

export function useKinshipSettings() {
  const context = React.useContext(KinshipSettingsContext);
  if (!context) throw new Error('useKinshipSettings must be used within a KinshipSettingsProvider');
  return context;
}
