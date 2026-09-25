import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store';
import { Empty, PageHeader, Modal, Field, Badge } from '../../app/ui';
import { fmtDate } from '../../app/format';
import { uid, type AiUsage, type Idea, type IdeaCoords, type IdeaStatus } from '../../lib/types';
import { CardEditor } from './CardEditor';
import { usePhotoUrl } from './photos';
import { generateOffline } from './generator/offline';
import { costHint, emptyUsage, fmtUsd, imageHint, recentUsage } from './generator/usage';
import { toPromptImage } from './promptImages';
import { apiKey as apiKeyStore } from '../../lib/storage/persist';
import type { BuildRef, Draft, IdeaKind, IdeaSize, PromptImage } from './generator/types';
import { getWorldScan } from './world/world';
import { describeWorld } from './world/places';

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

const pickOne = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];

export function Board() {
  const ideas = useStore((s) => s.ideas);
  const upsert = useStore((s) => s.upsertIdea);
  const hasApiKey = useStore((s) => s.hasApiKey);
  const [editing, setEditing] = useState<Idea | null | 'new'>(null);
  // Open Generate dialog: from a card's Follow-up button, or Surprise me with every choice rolled.
  const [generating, setGenerating] = useState<{ followUpOf?: Idea; surprise?: boolean } | null>(null);
  const titles = useMemo(() => new Map(ideas.map((i) => [i.id, i.title])), [ideas]);
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
            <button className="btn" onClick={() => setGenerating({ surprise: true })} title="Rolls the kind, the size and whether it builds on something, then generates">
              Surprise me
            </button>
            <button className="btn-accent" onClick={() => setGenerating({})}>
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
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      parentTitle={idea.parentId ? titles.get(idea.parentId) : undefined}
                      dragging={dragId === idea.id}
                      onDragStart={() => setDragId(idea.id)}
                      onDragEnd={() => setDragId(null)}
                      onOpen={() => setEditing(idea)}
                      onFollowUp={col.key === 'complete' ? () => setGenerating({ followUpOf: idea }) : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && (
        <CardEditor idea={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
      {generating && (
        <GenerateDialog
          followUpOf={generating.followUpOf}
          surprise={generating.surprise}
          onClose={() => setGenerating(null)}
          onDraft={(d, info) => {
            const now = new Date().toISOString();
            setGenerating(null);
            setEditing({ id: uid(), ...cardFields(d), photoIds: info.photoIds, status: 'new', createdAt: now, updatedAt: now, generated: true, allowFarms: info.kind === 'farm', parentId: info.parentId, coords: info.coords, aiUsage: info.usage });
          }}
        />
      )}
    </>
  );
}

/** The generator's draft minus its bookkeeping (buildsOn, coords, the offline seed). */
const cardFields = (d: Draft) => ({ title: d.title, concept: d.concept, buildType: d.buildType, biome: d.biome, placement: d.placement, lore: d.lore, palette: d.palette, scale: d.scale, sourceLinks: d.sourceLinks, imageUrls: d.imageUrls });

function IdeaCard({
  idea,
  parentTitle,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onFollowUp,
}: {
  idea: Idea;
  parentTitle?: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onFollowUp?: () => void;
}) {
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
        {idea.coords && ` · ${idea.coords.x}, ${idea.coords.z}`}
      </div>
      {parentTitle && <div className="text-xs text-ink-3 mt-0.5">↳ builds on {parentTitle}</div>}
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
        <span className="flex items-center gap-2">
          {[images > 0 && `${images} img`, links > 0 && `${links} link${links === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
          {onFollowUp && (
            <button
              className="text-accent hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onFollowUp();
              }}
            >
              ✦ Follow-up
            </button>
          )}
        </span>
      </div>
    </article>
  );
}

interface DraftInfo {
  kind: IdeaKind;
  usage?: AiUsage;
  /** Images sent with the prompt, now stored as the card's photos. */
  photoIds: string[];
  parentId?: string;
  coords?: IdeaCoords;
}

const STATUS_NAMES: Record<IdeaStatus, string> = { new: 'not started', progress: 'being built', complete: 'built' };
const toBuildRef = (i: Idea): BuildRef => ({ title: i.title, status: STATUS_NAMES[i.status], concept: i.concept, lore: i.lore, coords: i.coords });
// "Surprise me" asks for a follow-up about one time in three, so most ideas stay fresh.
const SURPRISE_FOLLOW_UP = 1 / 3;

function OptionButton({ on, onClick, title, children }: { on: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`rounded-xl border p-3 text-left transition-colors ${on ? 'border-accent bg-accent/10' : 'border-border hover:border-ink-3'}`}>
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-ink-3 mt-1 leading-snug">{children}</div>
    </button>
  );
}

function GenerateDialog({ followUpOf, surprise, onClose, onDraft }: { followUpOf?: Idea; surprise?: boolean; onClose: () => void; onDraft: (d: Draft, info: DraftInfo) => void }) {
  const ideas = useStore((s) => s.ideas);
  const hasApiKey = useStore((s) => s.hasApiKey);
  const world = useStore((s) => s.settings.world);
  const addPhoto = useStore((s) => s.addPhoto);
  const [mode, setMode] = useState<'ai' | 'offline'>(hasApiKey ? 'ai' : 'offline');
  // Surprise me rolls the kind and size here; whether it follows up on a build is rolled when it runs.
  const [kind, setKind] = useState<IdeaKind | null>(() => (surprise ? pickOne(KINDS).key : null));
  const [size, setSize] = useState<IdeaSize | null>(() => (surprise ? pickOne(SIZES).key : null));
  const [note, setNote] = useState('');
  // 'surprise', 'none', or the id of the build to follow up on.
  const [buildOn, setBuildOn] = useState(followUpOf?.id ?? 'surprise');
  // Downscaled when picked, so the thumbnail and the request share one encoding.
  const [images, setImages] = useState<{ file: File; prompt: PromptImage }[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recent = useMemo(() => recentUsage(ideas), [ideas]);
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
    // Filled in as replies arrive, so a run that fails after one can still say what it cost.
    const usage = emptyUsage();
    try {
      if (mode === 'ai') {
        const key = await apiKeyStore.get();
        if (ctrl.signal.aborted) return;
        if (!key) throw new Error('No API key stored.');
        const picked = buildOn === 'none' ? [] : buildOn === 'surprise' ? ideas.filter((i) => i.status !== 'new').slice(0, 12) : ideas.filter((i) => i.id === buildOn);
        const followUp = buildOn === 'surprise' && Math.random() >= SURPRISE_FOLLOW_UP ? [] : picked;
        // A failed scan (offline, say) costs the idea its coordinates, not the idea itself.
        const scan = world ? await getWorldScan(world, setPhase).catch(() => undefined) : undefined;
        setPhase(null);
        // The Claude SDK is a large module, so it only loads when AI mode runs.
        const { generateAI } = await import('./generator/ai');
        const draft = await generateAI(key, { kind, size, note, images: images.map((i) => i.prompt), exclude, followUp: followUp.map(toBuildRef), world: scan && describeWorld(scan) }, usage, ctrl.signal);
        if (ctrl.signal.aborted) return;
        // The images go on the card too; the editor drops them again if the draft is cancelled.
        const photoIds: string[] = [];
        for (const { file } of images) photoIds.push((await addPhoto(file, file.name)).id);
        // A chosen build stays the parent even if Claude forgot to say so.
        const parentId = draft.buildsOn ? followUp[draft.buildsOn - 1]?.id : buildOn !== 'surprise' && buildOn !== 'none' ? buildOn : undefined;
        const place = draft.coords && scan?.places.find((p) => p.x === draft.coords!.x && p.z === draft.coords!.z);
        onDraft(draft, { kind, usage, photoIds, parentId, coords: draft.coords && { ...draft.coords, place: place ? `${place.kind}:${place.id}` : undefined } });
      } else {
        const d = await generateOffline({ kind, size, exclude });
        if (!ctrl.signal.aborted) onDraft(d, { kind, photoIds: [] });
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const describe = mode === 'ai' ? await import('./generator/ai').then((m) => m.describeAiError, () => null) : null;
      const message = describe ? describe(e) : e instanceof Error ? e.message : String(e);
      setError(usage.requests ? `${message} This attempt still cost about ${fmtUsd(usage.usd)}.` : message);
    } finally {
      setBusy(false);
      setPhase(null);
    }
  };

  // Surprise me skips the choices and generates as soon as the dialog opens.
  const startSurprise = useEffectEvent(() => {
    if (surprise) void run();
  });
  // A timer rather than a direct call: StrictMode's second mount in dev clears the first one, so only one run starts.
  useEffect(() => {
    const t = setTimeout(startSurprise, 0);
    return () => clearTimeout(t);
  }, []);

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
            {ideas.length > 0 && (
              <Field label="Build on" hint={buildOn === 'surprise' ? 'About one idea in three follows up on something you are building or have built.' : buildOn === 'none' ? undefined : 'The idea extends this build and carries its story on.'}>
                <select className="input" value={buildOn} onChange={(e) => setBuildOn(e.target.value)}>
                  <option value="surprise">Surprise me</option>
                  <option value="none">Nothing: a fresh idea</option>
                  {(['complete', 'progress', 'new'] as const).map((status) => {
                    const list = ideas.filter((i) => i.status === status);
                    return list.length ? (
                      <optgroup key={status} label={COLUMNS.find((c) => c.key === status)!.label}>
                        {list.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.title}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                </select>
              </Field>
            )}
            <Field label={`Images for Claude (optional, ${images.length}/${MAX_PROMPT_IMAGES})`} hint={imageHint(images.map((i) => i.prompt), recent)}>
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
          {mode === 'ai' ? costHint(recent) : 'Combines bundled archetypes, biomes and lore hooks. No network needed.'}
          {ideas.length > 0 && ` Avoids ${ideas.length} existing title${ideas.length === 1 ? '' : 's'}.`}
          {mode === 'ai' && (world ? ` Places it in your world (seed ${world.seed}, Java ${world.version}).` : ' Add your seed under Settings → Minecraft world for real coordinates.')}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-accent" onClick={() => void run()} disabled={busy || !kind || !size}>
            {busy ? (phase ?? (mode === 'ai' ? 'Searching & writing…' : 'Rolling…')) : 'Generate'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
