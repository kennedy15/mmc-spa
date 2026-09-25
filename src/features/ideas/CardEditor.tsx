import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { Field, Modal, Toggle } from '../../app/ui';
import { uid, type Idea, type IdeaStatus } from '../../lib/types';
import { usePhotoUrl, forgetPhotoUrl } from './photos';

export function emptyIdea(): Idea {
  const now = new Date().toISOString();
  return { id: uid(), title: '', lore: '', buildType: 'Decorative point of interest', biome: '', placement: '', scale: '', palette: [], sourceLinks: [], imageUrls: [], photoIds: [], status: 'new', createdAt: now, updatedAt: now, generated: false, allowFarms: false };
}

const isHttp = (s: string) => /^https?:\/\/\S+$/.test(s);

/** Block Palettes' most-liked palettes that use a block, e.g. "stripped mangrove log". */
const blockPalettesUrl = (block: string) => `https://www.blockpalettes.com/palettes?blocks=${encodeURIComponent(block.trim().toLowerCase().replace(/\s+/g, '_'))}&sort=popular`;

// The list fields are edited as plain text and parsed on the way out, so a
// half-typed line or a trailing comma survives until the next keystroke.
const parsePalette = (text: string) => text.split(',').map((s) => s.trim()).filter(Boolean);
const parseUrls = (text: string) => text.split('\n').map((s) => s.trim()).filter(isHttp);
/** One link per line: "title | url" or a bare url. */
function parseLinks(text: string): { title: string; url: string }[] {
  return text.split('\n').flatMap((line) => {
    const bar = line.indexOf('|');
    const title = bar >= 0 ? line.slice(0, bar).trim() : '';
    const url = (bar >= 0 ? line.slice(bar + 1) : line).trim();
    return isHttp(url) ? [{ title: title || url, url }] : [];
  });
}

/** `note` is shown in the footer of a new card, e.g. what a generated draft cost. */
export function CardEditor({ idea, note, onClose }: { idea: Idea | null; note?: string; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertIdea);
  const del = useStore((s) => s.deleteIdea);
  const addPhoto = useStore((s) => s.addPhoto);
  const removePhoto = useStore((s) => s.removePhoto);
  const [draft, setDraft] = useState<Idea>(() => idea ?? emptyIdea());
  const [paletteText, setPaletteText] = useState(() => draft.palette.join(', '));
  const [linksText, setLinksText] = useState(() => draft.sourceLinks.map((l) => (l.title && l.title !== l.url ? `${l.title} | ${l.url}` : l.url)).join('\n'));
  const [imagesText, setImagesText] = useState(() => draft.imageUrls.join('\n'));
  // Thumbnails follow the image list after a pause, not on every keystroke of a half-typed URL.
  const [previewText, setPreviewText] = useState(imagesText);
  useEffect(() => {
    const t = setTimeout(() => setPreviewText(imagesText), 700);
    return () => clearTimeout(t);
  }, [imagesText]);
  const [busy, setBusy] = useState(false);
  const isNew = !useStore.getState().ideas.some((i) => i.id === draft.id);
  // Photos attached in this session are only kept if the idea is saved; photos
  // detached in this session are only deleted then, so Cancel undoes both. A
  // generated draft arrives with the images sent to Claude, which count as attached.
  const attached = useRef<string[]>(isNew ? [...draft.photoIds] : []);
  const detached = useRef<string[]>([]);
  const set = (patch: Partial<Idea>) => setDraft((d) => ({ ...d, ...patch }));
  const links = parseLinks(linksText);
  const mainBlock = parsePalette(paletteText)[0];
  const imageUrls = parseUrls(imagesText);
  const previewUrls = parseUrls(previewText);

  const drop = async (ids: string[]) => {
    for (const id of ids) {
      forgetPhotoUrl(id);
      await removePhoto(id);
    }
  };
  const save = async () => {
    if (!draft.title.trim()) return;
    await upsert({ ...draft, title: draft.title.trim(), palette: parsePalette(paletteText), sourceLinks: links, imageUrls, updatedAt: new Date().toISOString() });
    await drop(detached.current);
    attached.current = [];
    detached.current = [];
    onClose();
  };
  const cancel = () => {
    void drop(attached.current);
    attached.current = [];
    onClose();
  };
  const remove = async () => {
    if (!confirm('Delete this idea and its attached photos?')) return;
    await del(draft.id);
    await drop(attached.current);
    attached.current = [];
    onClose();
  };
  const attach = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const ids: string[] = [];
      for (const f of Array.from(files).slice(0, 6 - draft.photoIds.length)) {
        const meta = await addPhoto(f, f.name);
        ids.push(meta.id);
      }
      attached.current.push(...ids);
      set({ photoIds: [...draft.photoIds, ...ids] });
    } finally {
      setBusy(false);
    }
  };
  const detach = (id: string) => {
    set({ photoIds: draft.photoIds.filter((p) => p !== id) });
    if (attached.current.includes(id)) {
      attached.current = attached.current.filter((p) => p !== id);
      void drop([id]);
    } else {
      detached.current.push(id);
    }
  };

  return (
    <Modal open onClose={cancel} title={isNew ? 'New idea' : 'Edit idea'} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Field label="Title">
            <input className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} autoFocus placeholder="The Lantern Ferry" />
          </Field>
          <Field label="Concept">
            <textarea className="input min-h-16" value={draft.concept ?? ''} onChange={(e) => set({ concept: e.target.value })} placeholder="A mangrove tree farm covered by pixel art of a stripped mangrove log" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Build type">
              <input className="input" value={draft.buildType} onChange={(e) => set({ buildType: e.target.value })} />
            </Field>
            <Field label="Biome">
              <input className="input" value={draft.biome} onChange={(e) => set({ biome: e.target.value })} placeholder="Birch forest" />
            </Field>
          </div>
          <Field label="Placement">
            <input className="input" value={draft.placement} onChange={(e) => set({ placement: e.target.value })} placeholder="Where a river meets a birch forest, one chunk from spawn" />
          </Field>
          <Field label="Lore">
            <textarea className="input min-h-32" value={draft.lore} onChange={(e) => set({ lore: e.target.value })} placeholder="Who built it, why it was abandoned, one hook for a future build…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Scale">
              <input className="input" value={draft.scale} onChange={(e) => set({ scale: e.target.value })} placeholder="12×18, two storeys" />
            </Field>
            <Field label="Status">
              <select className="input" value={draft.status} onChange={(e) => set({ status: e.target.value as IdeaStatus })}>
                <option value="new">New</option>
                <option value="progress">In progress</option>
                <option value="complete">Complete</option>
              </select>
            </Field>
          </div>
          <Field
            label="Palette"
            hint={
              <>
                Comma-separated block names
                {mainBlock && (
                  <>
                    {' · '}
                    <a className="underline hover:text-ink" href={blockPalettesUrl(mainBlock)} target="_blank" rel="noreferrer">
                      Palettes with {mainBlock} on Block Palettes ↗
                    </a>
                  </>
                )}
              </>
            }
          >
            <input className="input" value={paletteText} onChange={(e) => setPaletteText(e.target.value)} placeholder="spruce, deepslate tiles, copper, lanterns" />
          </Field>
          <Toggle checked={!!draft.allowFarms} onChange={(v) => set({ allowFarms: v })} label="Includes a farm" />
        </div>
        <div className="space-y-3">
          <Field label="Reference links" hint="One per line: title | url, or just the url">
            <textarea className="input min-h-20 font-mono text-xs" value={linksText} onChange={(e) => setLinksText(e.target.value)} />
          </Field>
          {links.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {links.map((l, i) => (
                <li key={`${i}-${l.url}`} className="min-w-0">
                  <a className="chip max-w-72 hover:text-ink" href={l.url} target="_blank" rel="noreferrer" title={l.url}>
                    <span className="truncate">{l.title}</span>
                    <span aria-hidden className="ml-1 text-ink-3">↗</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <Field label="Reference image URLs" hint="Hotlinked, one per line. Kept as links; never copied.">
            <textarea className="input min-h-16 font-mono text-xs" value={imagesText} onChange={(e) => setImagesText(e.target.value)} />
          </Field>
          <Field label={`Your photos (${draft.photoIds.length}/6)`} hint="PNG/JPG, downscaled to 1600px and stored in your data folder.">
            <div className="flex flex-wrap gap-2">
              {draft.photoIds.map((id) => (
                <PhotoThumb key={id} id={id} onRemove={() => detach(id)} />
              ))}
              {draft.photoIds.length < 6 && (
                <label className="btn btn-sm cursor-pointer">
                  {busy ? 'Adding…' : '+ Attach'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => void attach(e.target.files)} disabled={busy} />
                </label>
              )}
            </div>
          </Field>
          {previewUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {previewUrls.map((u) => (
                <img key={u} src={u} alt="" className="h-16 w-16 object-cover rounded-lg border border-border bg-surface-2" loading="lazy" referrerPolicy="no-referrer" onError={(e) => (e.currentTarget.hidden = true)} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
        {!isNew ? (
          <button className="btn-ghost text-bad" onClick={() => void remove()}>
            Delete
          </button>
        ) : (
          <span className="text-xs text-ink-3">{note}</span>
        )}
        <div className="flex gap-2">
          <button className="btn" onClick={cancel}>
            Cancel
          </button>
          <button className="btn-accent" onClick={() => void save()} disabled={!draft.title.trim()}>
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PhotoThumb({ id, onRemove }: { id: string; onRemove: () => void }) {
  const url = usePhotoUrl(id);
  return (
    <div className="relative group">
      <div className="h-16 w-16 rounded-lg border border-border bg-surface-2 overflow-hidden">{url && <img src={url} alt="" className="h-full w-full object-cover" />}</div>
      <button className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-surface-3 border border-border-2 text-[10px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100" onClick={onRemove} aria-label="Remove photo">
        ✕
      </button>
    </div>
  );
}
