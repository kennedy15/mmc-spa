import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Empty, PageHeader, Modal, Field, Toggle, Badge } from '../../app/ui';
import { fmtDate } from '../../app/format';
import { uid, type Idea, type IdeaStatus } from '../../lib/types';
import { CardEditor } from './CardEditor';
import { usePhotoUrl } from './photos';
import { generateOffline, loadRecipes, type Recipes } from './generator/offline';
import { apiKey as apiKeyStore } from '../../lib/storage/persist';
import type { Draft, GenerateOptions } from './generator/types';

const COLUMNS: { key: IdeaStatus; label: string }[] = [
  { key: 'idle', label: 'Idle' },
  { key: 'progress', label: 'In progress' },
  { key: 'done', label: 'Done' },
];

export function Board() {
  const ideas = useStore((s) => s.ideas);
  const upsert = useStore((s) => s.upsertIdea);
  const hasApiKey = useStore((s) => s.hasApiKey);
  const [editing, setEditing] = useState<Idea | null | 'new'>(null);
  const [generating, setGenerating] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterBiome, setFilterBiome] = useState<string | null>(null);
  const [filterGen, setFilterGen] = useState<'all' | 'generated' | 'manual'>('all');

  const types = useMemo(() => [...new Set(ideas.map((i) => i.buildType).filter(Boolean))].sort(), [ideas]);
  const biomes = useMemo(() => [...new Set(ideas.map((i) => i.biome).filter(Boolean))].sort(), [ideas]);
  const visible = ideas.filter((i) => (!filterType || i.buildType === filterType) && (!filterBiome || i.biome === filterBiome) && (filterGen === 'all' || (filterGen === 'generated') === i.generated));

  const move = (id: string, status: IdeaStatus) => {
    const idea = ideas.find((i) => i.id === id);
    if (idea && idea.status !== status) void upsert({ ...idea, status, updatedAt: new Date().toISOString() });
  };

  return (
    <>
      <PageHeader
        title="Build board"
        subtitle={`${ideas.length} idea${ideas.length === 1 ? '' : 's'} · drag cards between columns · ${hasApiKey ? 'AI generator ready' : 'offline generator (add an API key in Settings for AI mode)'}`}
        action={
          <div className="flex gap-2">
            <button className="btn" onClick={() => setEditing('new')}>
              + New idea
            </button>
            <button className="btn-accent" onClick={() => setGenerating(true)}>
              ✦ Generate
            </button>
          </div>
        }
      />
      {(types.length > 1 || biomes.length > 1 || ideas.some((i) => i.generated)) && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {types.map((t) => (
            <button key={t} className={filterType === t ? 'chip-on' : 'chip'} onClick={() => setFilterType(filterType === t ? null : t)}>
              {t}
            </button>
          ))}
          {biomes.map((b) => (
            <button key={b} className={filterBiome === b ? 'chip-on' : 'chip'} onClick={() => setFilterBiome(filterBiome === b ? null : b)}>
              {b}
            </button>
          ))}
          <span className="w-px bg-border mx-1" />
          {(['all', 'generated', 'manual'] as const).map((g) => (
            <button key={g} className={filterGen === g ? 'chip-on' : 'chip'} onClick={() => setFilterGen(g)}>
              {g}
            </button>
          ))}
        </div>
      )}
      {ideas.length === 0 ? (
        <Empty title="An empty board">
          Generate an idea, or add one by hand. Everything stays in your browser and data folder; use <Link to="/settings" className="underline">Settings → Export</Link> to share the board with a friend.
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 items-start">
          {COLUMNS.map((col) => {
            const cards = visible.filter((i) => i.status === col.key).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
            return (
              <div
                key={col.key}
                className={`rounded-xl border border-dashed p-2 min-h-40 transition-colors ${dragId ? 'border-accent/40 bg-accent/5' : 'border-border'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) move(dragId, col.key);
                  setDragId(null);
                }}
              >
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="label">{col.label}</span>
                  <span className="text-xs text-ink-3 tabular">{cards.length}</span>
                </div>
                <div className="space-y-2">
                  {cards.map((idea) => (
                    <IdeaCard key={idea.id} idea={idea} dragging={dragId === idea.id} onDragStart={() => setDragId(idea.id)} onDragEnd={() => setDragId(null)} onOpen={() => setEditing(idea)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && <CardEditor idea={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {generating && (
        <GenerateDialog
          onClose={() => setGenerating(false)}
          onDraft={(d, generated) => {
            const now = new Date().toISOString();
            setGenerating(false);
            setEditing({ id: uid(), ...d, photoIds: [], status: 'idle', createdAt: now, updatedAt: now, generated, allowFarms: false });
          }}
        />
      )}
    </>
  );
}

function IdeaCard({ idea, dragging, onDragStart, onDragEnd, onOpen }: { idea: Idea; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onOpen: () => void }) {
  const firstPhoto = usePhotoUrl(idea.photoIds[0] ?? null);
  const thumb = firstPhoto ?? idea.imageUrls[0] ?? null;
  return (
    <article draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen} className={`card p-3 cursor-pointer hover:border-ink-3 transition-colors ${dragging ? 'opacity-40' : ''}`}>
      {thumb && <img key={thumb} src={thumb} alt="" className="w-full h-28 object-cover rounded-lg mb-2 bg-surface-2" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.hidden = true)} />}
      <div className="font-medium leading-snug">{idea.title}</div>
      <div className="text-xs text-ink-3 mt-0.5">
        {idea.buildType}
        {idea.biome && ` · ${idea.biome}`}
        {idea.scale && ` · ${idea.scale}`}
      </div>
      {idea.lore && <p className="text-xs text-ink-2 mt-2 line-clamp-3">{idea.lore}</p>}
      {idea.palette.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {idea.palette.slice(0, 5).map((p) => (
            <Badge key={p}>{p}</Badge>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-2 text-[10px] text-ink-3">
        <span>
          {idea.generated ? '✦ generated' : 'manual'} · {fmtDate(idea.updatedAt)}
        </span>
        <span>
          {idea.photoIds.length + idea.imageUrls.length > 0 && `${idea.photoIds.length + idea.imageUrls.length} img`}
          {idea.sourceLinks.length > 0 && ` · ${idea.sourceLinks.length} link${idea.sourceLinks.length === 1 ? '' : 's'}`}
        </span>
      </div>
    </article>
  );
}

function GenerateDialog({ onClose, onDraft }: { onClose: () => void; onDraft: (d: Draft, generated: boolean) => void }) {
  const ideas = useStore((s) => s.ideas);
  const hasApiKey = useStore((s) => s.hasApiKey);
  const [recipes, setRecipes] = useState<Recipes | null>(null);
  const [opts, setOpts] = useState<GenerateOptions>({ allowFarms: false, exclude: [] });
  const [mode, setMode] = useState<'ai' | 'offline'>(hasApiKey ? 'ai' : 'offline');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seed, setSeed] = useState('');
  useEffect(() => {
    let alive = true;
    void loadRecipes().then((r) => alive && setRecipes(r));
    return () => {
      alive = false;
    };
  }, []);

  const run = async () => {
    setBusy(true);
    setError(null);
    const o: GenerateOptions = { ...opts, exclude: ideas.map((i) => i.title), seed: seed ? Number(seed) : undefined };
    try {
      if (mode === 'ai') {
        const key = await apiKeyStore.get();
        if (!key) throw new Error('No API key stored.');
        // The Claude SDK is a large module, so it only loads when AI mode runs.
        const { generateAI } = await import('./generator/ai');
        onDraft(await generateAI(key, o), true);
      } else {
        const d = await generateOffline(o);
        onDraft(d, true);
      }
    } catch (e) {
      const describe = mode === 'ai' ? await import('./generator/ai').then((m) => m.describeAiError, () => null) : null;
      setError(describe ? describe(e) : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Generate a build idea">
      <div className="space-y-3">
        <div className="flex gap-1.5">
          <button className={mode === 'ai' ? 'chip-on' : 'chip'} onClick={() => setMode('ai')} disabled={!hasApiKey} title={hasApiKey ? '' : 'Add an API key in Settings'}>
            AI + web search
          </button>
          <button className={mode === 'offline' ? 'chip-on' : 'chip'} onClick={() => setMode('offline')}>
            Offline recipes
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Biome">
            <select className="input" value={opts.biome ?? ''} onChange={(e) => setOpts({ ...opts, biome: e.target.value || undefined })}>
              <option value="">Any</option>
              {recipes?.biomes.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Size">
            <select className="input" value={opts.size ?? ''} onChange={(e) => setOpts({ ...opts, size: (e.target.value || undefined) as GenerateOptions['size'] })}>
              <option value="">Any</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </Field>
          <Field label="Style">
            <select className="input" value={opts.style ?? ''} onChange={(e) => setOpts({ ...opts, style: e.target.value || undefined })}>
              <option value="">Any</option>
              {recipes?.styles.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {mode === 'offline' && (
            <Field label="Seed" hint="Same seed → same idea">
              <input className="input" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} placeholder="random" />
            </Field>
          )}
        </div>
        <Toggle checked={opts.allowFarms} onChange={(v) => setOpts({ ...opts, allowFarms: v })} label="Allow farms" />
        {error && <div className="text-sm text-bad">{error}</div>}
        <div className="text-xs text-ink-3">
          {mode === 'ai' ? 'Sends one request to the Claude API with your key (a few cents). Reference photos stay as links.' : 'Combines bundled archetypes, biomes and lore hooks. No network needed.'}
          {ideas.length > 0 && ` Avoids ${ideas.length} existing title${ideas.length === 1 ? '' : 's'}.`}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-accent" onClick={() => void run()} disabled={busy}>
            {busy ? (mode === 'ai' ? 'Searching & writing…' : 'Rolling…') : 'Generate'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
