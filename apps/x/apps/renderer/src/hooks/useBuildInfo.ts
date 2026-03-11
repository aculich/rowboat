import { useState, useEffect } from 'react';

export interface BuildInfo {
  version: string;
  gitCommit: string;
  gitBranch: string;
  buildDate: string;
  isDevBuild: boolean;
  forkName: string;
}

export function useBuildInfo(): BuildInfo | null {
  const [info, setInfo] = useState<BuildInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.ipc.invoke('app:getBuildInfo', null).then((result) => {
      if (!cancelled) setInfo(result);
    });
    return () => { cancelled = true; };
  }, []);

  return info;
}
