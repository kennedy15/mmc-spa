import { create } from 'zustand';
import type { CharactersConfig, LookEntry, Snapshot, SnapshotIndex, WorldInfo } from './lib/nexon/types';
import { loadCharacters, loadIndex, loadLooks, loadSnapshot, loadWorlds } from './lib/nexon/snapshots';
import { loadExpTable } from './lib/nexon/exp';
import { dataUrl } from './lib/paths';
import * as fs from './lib/storage/fs-access';
import * as persist from './lib/storage/persist';
import { mergeById, type ImportResult } from './lib/storage/exportImport';
import { DEFAULT_SETTINGS, normalizeIdea, uid, type AppliedPresets, type Assignment, type BossesDoc, type BossPreset, type Clear, type Goal, type Idea, type PhotoMeta, type PriceOverrides, type Settings } from './lib/types';
import { periodKey, type Cadence } from './lib/reset/period';
import { nameResolver, renameAppliedPresets, renameAssignments, renameClears, renameGoals, renameSettings, renameSnapshots } from './lib/renames';
import { samePresets, switchToPreset } from './features/bossing/lib';

export interface FolderState {
  supported: boolean;
  connected: boolean;
  needsPermission: boolean;
  name: string | null;
}

interface State {
  ready: boolean;
  loading: boolean;
  error: string | null;
  index: SnapshotIndex | null;
  characters: CharactersConfig | null;
  snapshots: Snapshot[];
  looks: Record<string, LookEntry[]>;
  worlds: Record<string, WorldInfo>;
  bosses: BossesDoc | null;
  ideas: Idea[];
  photos: PhotoMeta[];
  assignments: Assignment[];
  /** Boss presets in progression order: the saved list from the Presets page, else the defaults in bosses.json. */
  presets: BossPreset[];
  /** True while the saved preset list (bossing/presets.json) differs from the defaults. */
  presetsEdited: boolean;
  /** Which preset each character was last switched to. */
  appliedPresets: AppliedPresets;
  clears: Clear[];
  prices: PriceOverrides;
  goals: Goal[];
  settings: Settings;
  folder: FolderState;
  hasApiKey: boolean;
  hasGithubToken: boolean;

  init(): Promise<void>;
  /** Re-fetch repo data (characters, snapshots, looks) without touching local docs. */
  reloadRepoData(): Promise<void>;
  setGithubToken(token: string | null): Promise<void>;
  connectFolder(): Promise<void>;
  grantFolder(): Promise<void>;
  disconnectFolder(): Promise<void>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
  upsertIdea(idea: Idea): Promise<void>;
  deleteIdea(id: string): Promise<void>;
  addPhoto(file: Blob, name: string, sourceUrl?: string): Promise<PhotoMeta>;
  removePhoto(id: string): Promise<void>;
  setAssignments(list: Assignment[]): Promise<void>;
  /** Switch characters to a preset (null = no preset): their weekly bosses are wiped and replaced; monthly bosses and clears stay. An unknown id does nothing. */
  switchPreset(characters: string[], presetId: string | null): Promise<void>;
  /** Replace assignments and/or applied presets in one save (edits, undo). */
  setBossing(next: { assignments?: Assignment[]; appliedPresets?: AppliedPresets }): Promise<void>;
  /** Save the edited preset list (order = progression order); a list equal to the defaults goes back to them, as resetPresets. */
  savePresets(list: BossPreset[]): Promise<void>;
  /** Drop the edited list and go back to the defaults in bosses.json. */
  resetPresets(): Promise<void>;
  addClear(c: Clear): Promise<void>;
  removeClear(id: string): Promise<void>;
  updateClear(id: string, patch: Partial<Clear>): Promise<void>;
  /** Add and remove clears in one save. */
  bulkClears(change: { add: Clear[]; remove: string[] }): Promise<void>;
  setPrice(key: string, meso: number | null): Promise<void>;
  /** Set a character's level goal, replacing any earlier one for that character. */
  saveGoal(goal: Goal): Promise<void>;
  removeGoal(id: string): Promise<void>;
  setApiKey(key: string | null): Promise<void>;
  importBundle(r: ImportResult): Promise<{ ideas: number; clears: number; assignments: number; photos: number; goals: number }>;
}

async function downscale(file: Blob, maxEdge: number): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/png'));
  } catch {
    return file;
  }
}

/**
 * Re-files clears whose cadence disagrees with the boss list (say an Extreme
 * boss ticked as monthly before only Black Mage was monthly) into the reset
 * week or month they were cleared in, so the weekly and monthly trackers each
 * see only their own bosses. A moved clear that would duplicate one already
 * in that period is dropped.
 */
function realignClears(clears: Clear[], cadenceOf: (c: Clear) => Cadence | null): Clear[] {
  const keyOf = (c: Clear) => `${c.character}|${c.bossId}|${c.difficulty}|${c.period}`;
  const misfiled = (c: Clear) => {
    const cadence = cadenceOf(c);
    return cadence != null && cadence !== c.cadence;
  };
  const taken = new Set(clears.filter((c) => !misfiled(c)).map(keyOf));
  const out: Clear[] = [];
  for (const c of clears) {
    if (!misfiled(c)) {
      out.push(c);
      continue;
    }
    const cadence = cadenceOf(c)!;
    const moved: Clear = { ...c, cadence, period: periodKey(cadence, new Date(c.clearedAt)) };
    if (taken.has(keyOf(moved))) continue;
    taken.add(keyOf(moved));
    out.push(moved);
  }
  return out;
}

async function loadLocal(fallback: Pick<State, 'ideas' | 'photos' | 'assignments' | 'clears' | 'prices' | 'goals' | 'appliedPresets'> & { settings: Settings | null; presets: BossPreset[] | null }) {
  const [ideas, photos, assignments, clears, prices, goals, settings, savedPresets, appliedPresets] = await Promise.all([
    persist.loadDoc<Idea[]>('ideas.json', fallback.ideas),
    persist.loadDoc<PhotoMeta[]>('photos.json', fallback.photos),
    persist.loadDoc<Assignment[]>('bossing/assignments.json', fallback.assignments),
    persist.loadDoc<Clear[]>('bossing/clears.json', fallback.clears),
    persist.loadDoc<PriceOverrides>('bossing/prices.json', fallback.prices),
    persist.loadDoc<Goal[]>('goals.json', fallback.goals),
    persist.loadDoc<Settings | null>('settings.json', fallback.settings),
    persist.loadDoc<BossPreset[] | null>('bossing/presets.json', fallback.presets, true),
    persist.loadDoc<AppliedPresets>('bossing/applied-presets.json', fallback.appliedPresets),
  ]);
  return { ideas: ideas.map(normalizeIdea), photos, assignments, clears, prices, goals, settings, savedPresets, appliedPresets };
}

/** Snapshots as the repo serves them, for the data folder's mirror; the store's copies are filed under current names. */
let fetchedSnapshots: Snapshot[] = [];

/** Every snapshot in the index, oldest first: mirrored to the data folder as fetched, then filed under current names. */
async function loadSnapshots(index: SnapshotIndex | null, characters: CharactersConfig | null): Promise<Snapshot[]> {
  fetchedSnapshots = (await Promise.all((index?.dates ?? []).map(loadSnapshot))).filter((s): s is Snapshot => !!s).sort((a, b) => a.date.localeCompare(b.date));
  for (const s of fetchedSnapshots) void persist.mirrorSnapshot(s.date, s);
  return renameSnapshots(fetchedSnapshots, nameResolver(characters));
}

type NamedRecords = Pick<State, 'assignments' | 'clears' | 'goals' | 'settings' | 'appliedPresets'>;

/** Moves local records kept under a renamed character's former name to its current one, saving what moved. */
async function renameLocal(local: NamedRecords, characters: CharactersConfig | null): Promise<NamedRecords> {
  const resolve = nameResolver(characters, local.settings.extraCharacters);
  const next = { assignments: renameAssignments(local.assignments, resolve), clears: renameClears(local.clears, resolve), goals: renameGoals(local.goals, resolve), settings: renameSettings(local.settings, resolve), appliedPresets: renameAppliedPresets(local.appliedPresets, resolve) };
  await Promise.all([
    next.assignments !== local.assignments && persist.saveDoc('bossing/assignments.json', next.assignments),
    next.clears !== local.clears && persist.saveDoc('bossing/clears.json', next.clears),
    next.goals !== local.goals && persist.saveDoc('goals.json', next.goals),
    next.settings !== local.settings && persist.saveDoc('settings.json', next.settings),
    next.appliedPresets !== local.appliedPresets && persist.saveDoc('bossing/applied-presets.json', next.appliedPresets),
  ]);
  return next;
}

export const useStore = create<State>()((set, get) => ({
  ready: false,
  loading: false,
  error: null,
  index: null,
  characters: null,
  snapshots: [],
  looks: {},
  worlds: {},
  bosses: null,
  ideas: [],
  photos: [],
  assignments: [],
  presets: [],
  presetsEdited: false,
  appliedPresets: {},
  clears: [],
  prices: {},
  goals: [],
  settings: DEFAULT_SETTINGS,
  folder: { supported: fs.supported, connected: false, needsPermission: false, name: null },
  hasApiKey: false,
  hasGithubToken: false,

  async init() {
    if (get().ready || get().loading) return;
    set({ loading: true });
    try {
      let handle: FileSystemDirectoryHandle | undefined;
      let needsPermission = false;
      if (fs.supported) {
        handle = await fs.storedHandle();
        if (handle) {
          const p = await fs.permissionState(handle);
          if (p === 'granted') persist.setFolder(handle);
          else needsPermission = true;
        }
      }
      set({ folder: { supported: fs.supported, connected: !!handle && !needsPermission, needsPermission, name: handle?.name ?? null } });

      await loadExpTable().catch(() => {});
      const [index, characters, worldsDoc, bosses] = await Promise.all([
        loadIndex(),
        loadCharacters(),
        loadWorlds(),
        fetch(dataUrl('bosses.json', 'public')).then((r) => (r.ok ? (r.json() as Promise<BossesDoc>) : null)).catch(() => null),
      ]);
      const snapshots = await loadSnapshots(index, characters);

      const names = new Set<string>();
      for (const c of characters?.characters ?? []) names.add(c.name);
      for (const s of snapshots) for (const r of s.rows) names.add(r.name);
      const looks: Record<string, LookEntry[]> = {};
      await Promise.all(
        [...names].map(async (n) => {
          const l = await loadLooks(n);
          if (l && l.length) looks[n] = l;
        }),
      );

      const worlds = worldsDoc?.worlds ?? {};
      const local = await loadLocal({ ideas: [], photos: [], assignments: [], clears: [], prices: {}, goals: [], settings: null, presets: null, appliedPresets: {} });
      const worldHeroic = characters ? (worlds[String(characters.worldId)]?.heroic ?? true) : true;
      const settings: Settings = { ...DEFAULT_SETTINGS, heroic: worldHeroic, ...(local.settings ?? {}) };
      const key = await persist.apiKey.get();
      const ghTok = await persist.githubToken.get();

      // Cadence is defined by the boss list (only Black Mage is monthly); re-align stored assignments.
      const isMonthly = (bossId: string, difficulty: string) => bosses?.bosses.find((b) => b.id === bossId)?.difficulties.find((d) => d.key === difficulty)?.cadence === 'monthly';
      const assignments = bosses ? local.assignments.map((a) => ({ ...a, cadence: isMonthly(a.bossId, a.difficulty) ? ('monthly' as const) : ('weekly' as const) })) : local.assignments;
      if (JSON.stringify(assignments) !== JSON.stringify(local.assignments)) await persist.saveDoc('bossing/assignments.json', assignments);
      const cadenceOf = (c: Clear): Cadence | null => {
        const d = bosses?.bosses.find((b) => b.id === c.bossId)?.difficulties.find((x) => x.key === c.difficulty);
        return d ? (d.cadence === 'monthly' ? 'monthly' : 'weekly') : null;
      };
      const clears = bosses ? realignClears(local.clears, cadenceOf) : local.clears;
      if (clears.length !== local.clears.length || clears.some((c, i) => c !== local.clears[i])) await persist.saveDoc('bossing/clears.json', clears);
      const named = await renameLocal({ assignments, clears, goals: local.goals, settings, appliedPresets: local.appliedPresets }, characters);
      const { savedPresets, ...rest } = local;

      set({ ready: true, index, characters, snapshots, looks, worlds, bosses, ...rest, ...named, presets: savedPresets ?? bosses?.presets ?? [], presetsEdited: !!savedPresets, hasApiKey: !!key, hasGithubToken: !!ghTok });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ loading: false });
    }
  },

  async reloadRepoData() {
    const [index, characters] = await Promise.all([loadIndex(), loadCharacters()]);
    const snapshots = await loadSnapshots(index, characters);
    const names = new Set<string>();
    for (const c of characters?.characters ?? []) names.add(c.name);
    for (const s of snapshots) for (const r of s.rows) names.add(r.name);
    const looks: Record<string, LookEntry[]> = {};
    await Promise.all([...names].map(async (n) => { const l = await loadLooks(n); if (l && l.length) looks[n] = l; }));
    // After a rename, boss clears and goals follow the character to its new name.
    const s = get();
    const named = await renameLocal({ assignments: s.assignments, clears: s.clears, goals: s.goals, settings: s.settings, appliedPresets: s.appliedPresets }, characters);
    set({ index, characters, snapshots, looks, ...named });
  },

  async setGithubToken(token) {
    if (token) await persist.githubToken.set(token);
    else await persist.githubToken.clear();
    set({ hasGithubToken: !!token });
  },

  async connectFolder() {
    const handle = await fs.pickFolder();
    persist.setFolder(handle);
    const s = get();
    const { savedPresets, ...local } = await loadLocal({ ideas: s.ideas, photos: s.photos, assignments: s.assignments, clears: s.clears, prices: s.prices, goals: s.goals, settings: s.settings, presets: s.presetsEdited ? s.presets : null, appliedPresets: s.appliedPresets });
    for (const snap of fetchedSnapshots) void persist.mirrorSnapshot(snap.date, snap);
    const named = await renameLocal({ assignments: local.assignments, clears: local.clears, goals: local.goals, settings: local.settings ?? s.settings, appliedPresets: local.appliedPresets }, s.characters);
    set({ ...local, ...named, presets: savedPresets ?? s.bosses?.presets ?? [], presetsEdited: !!savedPresets, folder: { supported: true, connected: true, needsPermission: false, name: handle.name } });
    await persist.saveDoc('settings.json', get().settings);
  },

  async grantFolder() {
    const handle = await fs.storedHandle();
    if (!handle) return;
    const p = await fs.permissionState(handle, true);
    if (p !== 'granted') return;
    persist.setFolder(handle);
    const s = get();
    const { savedPresets, ...local } = await loadLocal({ ideas: s.ideas, photos: s.photos, assignments: s.assignments, clears: s.clears, prices: s.prices, goals: s.goals, settings: s.settings, presets: s.presetsEdited ? s.presets : null, appliedPresets: s.appliedPresets });
    for (const snap of fetchedSnapshots) void persist.mirrorSnapshot(snap.date, snap);
    const named = await renameLocal({ assignments: local.assignments, clears: local.clears, goals: local.goals, settings: local.settings ?? s.settings, appliedPresets: local.appliedPresets }, s.characters);
    set({ ...local, ...named, presets: savedPresets ?? s.bosses?.presets ?? [], presetsEdited: !!savedPresets, folder: { supported: true, connected: true, needsPermission: false, name: handle.name } });
  },

  async disconnectFolder() {
    await fs.forgetFolder();
    persist.setFolder(null);
    set({ folder: { supported: fs.supported, connected: false, needsPermission: false, name: null } });
  },

  async saveSettings(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await persist.saveDoc('settings.json', settings);
  },

  async upsertIdea(idea) {
    const ideas = get().ideas.some((i) => i.id === idea.id) ? get().ideas.map((i) => (i.id === idea.id ? idea : i)) : [idea, ...get().ideas];
    set({ ideas });
    await persist.saveDoc('ideas.json', ideas);
  },

  async deleteIdea(id) {
    const idea = get().ideas.find((i) => i.id === id);
    const ideas = get().ideas.filter((i) => i.id !== id);
    set({ ideas });
    await persist.saveDoc('ideas.json', ideas);
    for (const pid of idea?.photoIds ?? []) await get().removePhoto(pid);
  },

  async addPhoto(file, name, sourceUrl) {
    const blob = await downscale(file, 1600);
    const meta: PhotoMeta = { id: uid(), name, addedAt: new Date().toISOString(), sourceUrl };
    await persist.savePhoto(meta.id, blob);
    const photos = [...get().photos, meta];
    set({ photos });
    await persist.saveDoc('photos.json', photos);
    return meta;
  },

  async removePhoto(id) {
    await persist.deletePhoto(id);
    const photos = get().photos.filter((p) => p.id !== id);
    set({ photos });
    await persist.saveDoc('photos.json', photos);
  },

  async setAssignments(list) {
    set({ assignments: list });
    await persist.saveDoc('bossing/assignments.json', list);
  },

  async switchPreset(characters, presetId) {
    const s = get();
    const preset = presetId ? (s.presets.find((p) => p.id === presetId) ?? null) : null;
    // An id that's gone (a preset deleted meanwhile) must not wipe anyone's bosses.
    if (presetId && !preset) return;
    const assignments = switchToPreset(s.assignments, characters, preset, s.bosses);
    const appliedPresets = { ...s.appliedPresets };
    for (const c of characters) {
      if (preset) appliedPresets[c] = preset.id;
      else delete appliedPresets[c];
    }
    await get().setBossing({ assignments, appliedPresets });
  },

  async setBossing({ assignments, appliedPresets }) {
    set({ ...(assignments ? { assignments } : {}), ...(appliedPresets ? { appliedPresets } : {}) });
    await Promise.all([assignments && persist.saveDoc('bossing/assignments.json', assignments), appliedPresets && persist.saveDoc('bossing/applied-presets.json', appliedPresets)]);
  },

  async savePresets(list) {
    // A list that matches the defaults again (a reorder put back, an undo) is no edit: it follows bosses.json from then on.
    const { bosses } = get();
    if (samePresets(list, bosses?.presets ?? [], bosses)) return get().resetPresets();
    set({ presets: list, presetsEdited: true });
    await persist.saveDoc('bossing/presets.json', list);
  },

  async resetPresets() {
    set({ presets: get().bosses?.presets ?? [], presetsEdited: false });
    // A null doc falls back to the defaults on the next load too.
    await persist.saveDoc('bossing/presets.json', null);
  },

  async addClear(c) {
    const clears = [...get().clears.filter((x) => x.id !== c.id), c];
    set({ clears });
    await persist.saveDoc('bossing/clears.json', clears);
  },

  async removeClear(id) {
    const clears = get().clears.filter((x) => x.id !== id);
    set({ clears });
    await persist.saveDoc('bossing/clears.json', clears);
  },

  async bulkClears({ add, remove }) {
    const drop = new Set(remove);
    const clears = [...get().clears.filter((x) => !drop.has(x.id)), ...add];
    set({ clears });
    await persist.saveDoc('bossing/clears.json', clears);
  },

  async updateClear(id, patch) {
    const clears = get().clears.map((x) => (x.id === id ? { ...x, ...patch } : x));
    set({ clears });
    await persist.saveDoc('bossing/clears.json', clears);
  },

  async setPrice(key, meso) {
    const prices = { ...get().prices };
    if (meso == null) delete prices[key];
    else prices[key] = meso;
    set({ prices });
    await persist.saveDoc('bossing/prices.json', prices);
  },

  async saveGoal(goal) {
    const goals = [...get().goals.filter((g) => g.character !== goal.character && g.id !== goal.id), goal];
    set({ goals });
    await persist.saveDoc('goals.json', goals);
  },

  async removeGoal(id) {
    const goals = get().goals.filter((g) => g.id !== id);
    set({ goals });
    await persist.saveDoc('goals.json', goals);
  },

  async setApiKey(key) {
    if (key) await persist.apiKey.set(key);
    else await persist.apiKey.clear();
    set({ hasApiKey: !!key });
  },

  async importBundle(r) {
    const s = get();
    // A bundle exported before a rename still uses the old name.
    const resolve = nameResolver(s.characters, s.settings.extraCharacters);
    const ideas = mergeById(s.ideas, r.bundle.ideas?.map(normalizeIdea));
    const clears = mergeById(s.clears, r.bundle.clears && renameClears(r.bundle.clears, resolve));
    const goals = mergeById(s.goals, r.bundle.goals && renameGoals(r.bundle.goals, resolve));
    const assignKey = (a: Assignment) => `${a.character}|${a.bossId}|${a.difficulty}`;
    const have = new Set(s.assignments.map(assignKey));
    const assignments = [...s.assignments, ...renameAssignments(r.bundle.assignments ?? [], resolve).filter((a) => !have.has(assignKey(a)))];
    const photoIds = new Set(s.photos.map((p) => p.id));
    const photos = [...s.photos];
    let added = 0;
    for (const p of r.bundle.photos ?? []) {
      if (photoIds.has(p.id)) continue;
      const blob = r.photoBlobs.get(p.id);
      if (!blob) continue;
      await persist.savePhoto(p.id, blob);
      photos.push(p);
      added++;
    }
    // An edited preset list here merges with the bundle's by id (local wins); the defaults give way to the bundle's list.
    // A bundle without presets.json was exported with the defaults and leaves the list alone.
    const incoming = Array.isArray(r.bundle.presets) ? r.bundle.presets : null;
    let { presets, presetsEdited } = s;
    if (incoming) {
      const list = s.presetsEdited ? mergeById(s.presets, incoming) : incoming;
      presetsEdited = !samePresets(list, s.bosses?.presets ?? [], s.bosses);
      presets = presetsEdited ? list : (s.bosses?.presets ?? []);
    }
    // A character's applied preset is taken only when it has none here.
    const appliedPresets = { ...renameAppliedPresets(r.bundle.appliedPresets ?? {}, resolve), ...s.appliedPresets };
    set({ ideas, clears, assignments, photos, goals, presets, presetsEdited, appliedPresets });
    await Promise.all([
      incoming && persist.saveDoc('bossing/presets.json', presetsEdited ? presets : null),
      persist.saveDoc('bossing/applied-presets.json', appliedPresets),
      persist.saveDoc('ideas.json', ideas),
      persist.saveDoc('bossing/clears.json', clears),
      persist.saveDoc('bossing/assignments.json', assignments),
      persist.saveDoc('photos.json', photos),
      persist.saveDoc('goals.json', goals),
    ]);
    return { ideas: ideas.length - s.ideas.length, clears: clears.length - s.clears.length, assignments: assignments.length - s.assignments.length, photos: added, goals: goals.length - s.goals.length };
  },
}));

/** Every character name the app knows: characters.json, snapshots, and extras from settings. */
export function allCharacterNames(s: Pick<State, 'characters' | 'snapshots' | 'settings'>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (n: string) => {
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  };
  for (const c of s.characters?.characters ?? []) push(c.name);
  for (const snap of s.snapshots) for (const r of snap.rows) push(r.name);
  for (const n of s.settings.extraCharacters) push(n);
  return out;
}

export function mainCharacterName(s: Pick<State, 'characters' | 'snapshots'>): string | null {
  const cfg = s.characters?.characters ?? [];
  const main = cfg.find((c) => c.role === 'main' && (c.owner ?? 'me') === 'me') ?? cfg.find((c) => c.role === 'main') ?? cfg[0];
  if (main) return main.name;
  const last = s.snapshots[s.snapshots.length - 1];
  return last?.rows[0]?.name ?? null;
}
