import type { MapName, BoardState } from '../types';

export interface PhaseFileData {
  version: 1;
  mapName: MapName;
  phases: Array<{
    name: string;
    boardState: BoardState;
  }>;
}

export function exportPhasesToFile(mapName: MapName, phases: Array<{ name: string; boardState: BoardState }>) {
  const data: PhaseFileData = {
    version: 1,
    mapName,
    phases,
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${mapName}-phases.phases.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importPhasesFromFile(): Promise<PhaseFileData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.phases.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        const text = await file.text();
        const data = JSON.parse(text) as PhaseFileData;
        if (data.version !== 1 || !data.mapName || !Array.isArray(data.phases)) {
          resolve(null);
          return;
        }
        resolve(data);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}
