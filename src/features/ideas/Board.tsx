import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Empty, PageHeader, Modal, Field, Badge } from '../../app/ui';
import { fmtDate, fmtInt } from '../../app/format';
import { uid, type Idea, type IdeaStatus } from '../../lib/types';
import { CardEditor } from './CardEditor';
import { usePhotoUrl } from './photos';
import { generateOffline } from './generator/offline';
import { toPromptImage } from './promptImages';
import { apiKey as apiKeyStore } from '../../lib/storage/persist';
import type { AiUsage, Draft, IdeaKind, IdeaSize, PromptImage } from './generator/types';

const COLUMNS: { key: IdeaStatus; label: string }[] = [
  { key: 'new', label: 'New' },
  { key: 'progress', label: 'In progress' },
  { key: 'complete', label: 'Complete' },
];

const KINDS: { key: IdeaKind; label: string; example: string }[] = [
  { key: 'farm', label: 'Farm + build', example: 'A working farm dressed up as a build, e.g. a mangrove tree farm covered by pixel art of a stripped mangrove log.' },
  { key: 'build', label: 'Build with lore', example: 'A build with a story, e.g. a vampire castle on the snowy peaks.' },
];

const SIZES: { key: IdeaSize; label: string; example: Record<IdeaKind, string> }[] = [
  { key: 'small', label: 'Small', example: { farm: 'e.g. a witch farm', build: 'e.g. a wayside shrine' } },
  { key: 'medium', label: 'Medium', example: { farm: 'e.g. a mangrove tree farm with its pixel-art cover', build: 'e.g. a watermill' } },
  { key: 'large', label: 'Large', example: { farm: 'e.g. draining an ocean monument, a perimeter witch farm', build: 'e.g. a vampire castle town' } },
];

const MAX_PROMPT_IMAGES = 4;

/** "This idea cost about $0.17 (3 web searches, 21,300 tokens in, 1,450 out)" */
function usageNote(u: AiUsage): string {
  const cost = u.usd < 0.005 ? 'under $0.01' : `about $${u.usd.toFixed(2)}`;
  return `This idea cost ${cost} (${u.searches} web search${u.searches === 1 ? '' : 'es'}, ${fmtInt(u.inputTokens)} tokens in, ${fmtInt(u.outputTokens)} out)`;
}

export function Board() {
  const ideas = useStore((s) => s.ideas);
  const upsert = useStore((s) => s.upsertIdea);
  const hasApiKey = useStore((s) => s.hasApiKey);
  const [editing, setEditing] = useState<Idea | null | 'new'>(null);
  // What the AI draft now in the editor cost; cleared when the editor closes.
  const [draftUsage, setDraftUsage] = useState<AiUsage | null>(null);
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
      {editing && (
        <CardEditor
          idea={editing === 'new' ? null : editing}
          note={draftUsage ? usageNote(draftUsage) : undefined}
          onClose={() => {
            setEditing(null);
            setDraftUsage(null);
          }}
        />
      )}
      {generating && (
        <GenerateDialog
          onClose={() => setGenerating(false)}
          onDraft={(d, info) => {
            const now = new Date().toISOString();
            setGenerating(false);
            setDraftUsage(info.usage ?? null);
            setEditing({ id: uid(), ...d, photoIds: info.photoIds, status: 'new', createdAt: now, updatedAt: now, generated: true, allowFarms: info.kind === 'farm' });
          }}
        />
      )}
    </>
  );
}

function IdeaCard({ idea, dragging, onDragStart, onDragEnd, onOpen }: { idea: Idea; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onOpen: () => void }) {
  const firstPhoto = usePhotoUrl(idea.photoIds[0] ?? null);
  const thumb = firstPhoto ?? idea.imageUrls[0] ?? null;
  const images = idea.photoIds.length + idea.imageUrls.length;
  const links = idea.sourceLinks.length;
  return (
    <article draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen} className={`card p-3 cursor-pointer hover:border-ink-3 transition-colors ${dragging ? 'opacity-40' : ''}`}>
      {thumb && <img key={thumb} src={thumb} alt="" className="w-full h-28 object-cover rounded-lg mb-2 bg-surface-2" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.hidden = true)} />}
      <div className="font-medium leading-snug">{idea.title}</div>
      <div className="text-xs text-ink-3 mt-0.5">
        {idea.buildType}
        {idea.biome && ` · ${idea.biome}`}
        {idea.scale && ` · ${idea.scale}`}
      </div>
      {(idea.concept || idea.lore) && <p className="text-xs text-ink-2 mt-2 line-clamp-3">{idea.concept || idea.lore}</p>}
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
        <span>{[images > 0 && `${images} img`, links > 0 && `${links} link${links === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}</span>
      </div>
    </article>
  );
}

interface DraftInfo {
  kind: IdeaKind;
  usage?: AiUsage;
  /** Images sent with the prompt, now stored as the card's photos. */
  photoIds: string[];
}

function OptionButton({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`rounded-xl border p-3 text-left transition-colors ${on ? 'border-accent bg-accent/10' : 'border-border hover:border-ink-3'}`}>
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-ink-3 mt-1 leading-snug">{children}</div>
    </button>
  );
}

function GenerateDialog({ onClose, onDraft }: { onClose: () => void; onDraft: (d: Draft, info: DraftInfo) => void }) {
  const ideas = useStore((s) => s.ideas);
  const hasApiKey = useStore((s) => s.hasApiKey);
  const addPhoto = useStore((s) => s.addPhoto);
  const [mode, setMode] = useState<'ai' | 'offline'>(hasApiKey ? 'ai' : 'offline');
  const [kind, setKind] = useState<IdeaKind | null>(null);
  const [size, setSize] = useState<IdeaSize | null>(null);
  const [note, setNote] = useState('');
  // Downscaled when picked, so the thumbnail and the request share one encoding.
  const [images, setImages] = useState<{ file: File; prompt: PromptImage }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Closing the dialog aborts a run still in flight, so a late reply can't open the editor.
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  const addImages = async (files: FileList | null) => {
    const picked = Array.from(files ?? []).slice(0, MAX_PROMPT_IMAGES - images.length);
    try {
      const prepared = await Promise.all(picked.map(async (file) => ({ file, prompt: await toPromptImage(file) })));
      setImages((cur) => [...cur, ...prepared].slice(0, MAX_PROMPT_IMAGES));
    } catch {
      setError('One of those images could not be read. PNG, JPG or WebP work.');
    }
  };

  const run = async () => {
    if (!kind || !size) return;
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setBusy(true);
    setError(null);
    const exclude = ideas.map((i) => i.title);
    try {
      if (mode === 'ai') {
        const key = await apiKeyStore.get();
        if (!key) throw new Error('No API key stored.');
        // The Claude SDK is a large module, so it only loads when AI mode runs.
        const { generateAI } = await import('./generator/ai');
        const { draft, usage } = await generateAI(key, { kind, size, note, images: images.map((i) => i.prompt), exclude }, ctrl.signal);
        if (ctrl.signal.aborted) return;
        // The images go on the card too; the editor drops them again if the draft is cancelled.
        const photoIds: string[] = [];
        for (const { file } of images) photoIds.push((await addPhoto(file, file.name)).id);
        onDraft(draft, { kind, usage, photoIds });
      } else {
        const d = await generateOffline({ kind, size, exclude });
        if (!ctrl.signal.aborted) onDraft(d, { kind, photoIds: [] });
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const describe = mode === 'ai' ? await import('./generator/ai').then((m) => m.describeAiError, () => null) : null;
      setError(describe ? describe(e) : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Generate a build idea">
      <div className="space-y-4">
        <div className="flex gap-1.5">
          <button className={mode === 'ai' ? 'chip-on' : 'chip'} onClick={() => setMode('ai')} disabled={!hasApiKey} title={hasApiKey ? '' : 'Add an API key in Settings'}>
            AI + web search
          </button>
          <button className={mode === 'offline' ? 'chip-on' : 'chip'} onClick={() => setMode('offline')}>
            Offline recipes
          </button>
        </div>
        <div>
          <div className="label mb-1.5">What kind of idea?</div>
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <OptionButton key={k.key} on={kind === k.key} onClick={() => setKind(k.key)} title={k.label}>
                {k.example}
              </OptionButton>
            ))}
          </div>
        </div>
        {kind && (
          <div>
            <div className="label mb-1.5">How big?</div>
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((s) => (
                <OptionButton key={s.key} on={size === s.key} onClick={() => setSize(s.key)} title={s.label}>
                  {s.example[kind]}
                </OptionButton>
              ))}
            </div>
          </div>
        )}
        {kind && size && mode === 'ai' && (
          <>
            <Field label={`Images for Claude (optional, ${images.length}/${MAX_PROMPT_IMAGES})`} hint="Screenshots of the spot, or builds you like. About 1¢ each; they're added to the card too.">
              <div className="flex flex-wrap gap-2">
                {images.map((im, i) => (
                  <div key={`${i}-${im.file.name}`} className="relative group">
                    <img src={`data:${im.prompt.mediaType};base64,${im.prompt.data}`} alt="" className="h-16 w-16 rounded-lg border border-border object-cover" />
                    <button className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-surface-3 border border-border-2 text-[10px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => setImages(images.filter((_, j) => j !== i))} aria-label="Remove image">
                      ✕
                    </button>
                  </div>
                ))}
                {images.length < MAX_PROMPT_IMAGES && (
                  <label className="btn btn-sm cursor-pointer self-center">
                    + Add images
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void addImages(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            </Field>
            <Field label="Note for Claude (optional)">
              <textarea className="input min-h-16" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. near our base in the cherry grove; lots of copper" />
            </Field>
          </>
        )}
        {error && <div className="text-sm text-bad">{error}</div>}
        <div className="text-xs text-ink-3">
          {mode === 'ai' ? 'Uses your API key: a few web searches plus the write-up, roughly 10–30¢ (the editor shows the real cost).' : 'Combines bundled archetypes, biomes and lore hooks. No network needed.'}
          {ideas.length > 0 && ` Avoids ${ideas.length} existing title${ideas.length === 1 ? '' : 's'}.`}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-accent" onClick={() => void run()} disabled={busy || !kind || !size}>
            {busy ? (mode === 'ai' ? 'Searching & writing…' : 'Rolling…') : 'Generate'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
