import { useEffect, useState } from 'react';
import { useStore } from '../../store';
import { Card, Field } from '../../app/ui';
import type { WorldSettings } from '../../lib/types';
import { SCAN_RADIUS, WORLD_VERSIONS, getWorldScan } from '../ideas/world/world';
import { chunkbaseUrl, locateCommand, placeName, type WorldScan } from '../ideas/world/places';
import type { WorldPlace } from '../ideas/world/worldgen';

export function MinecraftWorld() {
  const world = useStore((s) => s.settings.world);
  const saveSettings = useStore((s) => s.saveSettings);
  const [seed, setSeed] = useState(world?.seed ?? '');
  const [version, setVersion] = useState(world?.version ?? WORLD_VERSIONS[0]);
  const [baseX, setBaseX] = useState(String(world?.baseX ?? 0));
  const [baseZ, setBaseZ] = useState(String(world?.baseZ ?? 0));
  const [scan, setScan] = useState<WorldScan | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Show the saved world's scan; it comes from IndexedDB unless the settings changed.
  useEffect(() => {
    if (!world) return;
    let alive = true;
    getWorldScan(world, (s) => alive && setStatus(s)).then(
      (s) => alive && (setScan(s), setStatus(null)),
      (e: unknown) => alive && (setError(e instanceof Error ? e.message : String(e)), setStatus(null)),
    );
    return () => {
      alive = false;
    };
  }, [world]);

  const save = async () => {
    setError(null);
    setScan(null);
    const w: WorldSettings = { seed: seed.trim(), version, baseX: Math.round(Number(baseX) || 0), baseZ: Math.round(Number(baseZ) || 0) };
    await saveSettings({ world: w });
  };
  const remove = async () => {
    setScan(null);
    setError(null);
    setSeed('');
    await saveSettings({ world: null });
  };
  const unchanged = world && world.seed === seed.trim() && world.version === version && world.baseX === Math.round(Number(baseX) || 0) && world.baseZ === Math.round(Number(baseZ) || 0);
  const structures = scan?.places.filter((p) => p.kind === 'structure') ?? [];
  const biomes = scan?.places.filter((p) => p.kind === 'biome') ?? [];

  return (
    <Card title="Minecraft world" className="lg:col-span-2">
      <p className="text-sm text-ink-2 mb-3">
        With your seed, generated ideas come with real coordinates: the nearest mangrove swamp, witch hut or ocean monument to your base. The seed is worked out in this browser like a seed map; Minecraft's world data (about 4 MB) downloads from GitHub the first time.
      </p>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr] items-start">
        <Field label="Seed" hint="As in server.properties (level-seed) or /seed">
          <input className="input font-mono" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="-4530634556500121041" />
        </Field>
        <Field label="Java version" hint="Seed scans need 26.3">
          <select className="input" value={version} onChange={(e) => setVersion(e.target.value)}>
            {WORLD_VERSIONS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Base X" hint="Distances start here">
          <input className="input tabular" inputMode="numeric" value={baseX} onChange={(e) => setBaseX(e.target.value.replace(/[^\d-]/g, ''))} />
        </Field>
        <Field label="Base Z">
          <input className="input tabular" inputMode="numeric" value={baseZ} onChange={(e) => setBaseZ(e.target.value.replace(/[^\d-]/g, ''))} />
        </Field>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button className="btn-accent btn-sm" disabled={!seed.trim() || !!unchanged || !!status} onClick={() => void save()}>
          Save & scan
        </button>
        {world && (
          <button className="btn-ghost btn-sm" onClick={() => void remove()}>
            Remove world
          </button>
        )}
        {status && <span className="text-xs text-ink-3">{status}</span>}
        {error && <span className="text-xs text-bad">{error}</span>}
      </div>
      {scan && world && (
        <div className="mt-4">
          <div className="text-sm text-ink-2">
            Found {structures.length} structures and {biomes.length} biomes within {SCAN_RADIUS.toLocaleString('en-US')} blocks of {scan.baseX}, {scan.baseZ}.
          </div>
          <div className="grid gap-4 md:grid-cols-2 mt-3">
            <PlaceList title="Structures" places={structures} world={world} />
            <PlaceList title="Biomes" places={biomes} world={world} />
          </div>
          <p className="text-xs text-ink-3 mt-3">
            Structure spots are the chunk the game tries, so a building can sit a few blocks off. Check one in game with <code className="text-ink-2">{locateCommand('structure', 'swamp_hut')}</code>.
          </p>
        </div>
      )}
    </Card>
  );
}

function PlaceList({ title, places, world }: { title: string; places: WorldPlace[]; world: WorldSettings }) {
  return (
    <div>
      <div className="label mb-1">{title}</div>
      <ul className="max-h-56 overflow-y-auto text-xs divide-y divide-border">
        {places.map((p) => (
          <li key={`${p.kind}:${p.id}`} className="flex items-center justify-between gap-2 py-1">
            <span className="truncate">{placeName(p.kind, p.id)}</span>
            <span className="text-ink-3 tabular whitespace-nowrap">
              {p.x}, {p.z} · {p.distance.toLocaleString('en-US')} blocks ·{' '}
              <a className="underline hover:text-ink" href={chunkbaseUrl(world, p.x, p.z)} target="_blank" rel="noreferrer">
                map ↗
              </a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
