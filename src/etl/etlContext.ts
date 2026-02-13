export type EtlContext = {
  dataset: string;
  step: 'fetch' | 'import' | 'run';
};

export function nowMs() {
  return Date.now();
}

export function durationMs(startMs: number) {
  return Date.now() - startMs;
}
