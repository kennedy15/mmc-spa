/// <reference lib="webworker" />
// Runs the seed scan off the main thread; deepslate and its noise math stay out of the app bundle.
import { scanWorld, type WorldgenData } from './worldgen';

self.onmessage = (e: MessageEvent<{ data: WorldgenData; seed: string; baseX: number; baseZ: number; radius: number }>) => {
  const { data, seed, baseX, baseZ, radius } = e.data;
  try {
    self.postMessage({ places: scanWorld(data, seed, baseX, baseZ, radius) });
  } catch (err) {
    self.postMessage({ error: err instanceof Error ? err.message : String(err) });
  }
};
