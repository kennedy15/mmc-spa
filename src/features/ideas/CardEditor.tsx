import { useState } from 'react';
import { useStore } from '../../store';
import { Field, Modal, Toggle } from '../../app/ui';
import { uid, type Idea, type IdeaStatus } from '../../lib/types';
import { usePhotoUrl, forgetPhotoUrl } from './photos';

export function emptyIdea(): Idea {
  const now = new Date().toISOString();
  return { id: uid(), title: '', lore: '', buildType: 'Decorative point of interest', biome: '', placement: '', scale: '', palette: [], sourceLinks: [], imageUrls: [], photoIds: [], status: 'idle', createdAt: now, updatedAt: now, generated: false, allowFarms: false };
}

export function CardEditor({ idea, onClose }: { idea: Idea | null; onClose: () => void }) {
  const upsert = useStore((s) => s.upsertIdea);
  const del = useStore((s) => s.deleteIdea);
  const addPhoto = useStore((s) => s.addPhoto);
  const removePhoto = useStore((s) => s.removePhoto);
  const [draft, setDraft] = useState<Idea>(() => idea ?? emptyIdea());
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Idea>) => setDraft((d) => ({ ...d, ...patch }));
  const isNew = !useStore.getState().ideas.some((i) => i.id === draft.id);

  const save = async () => {
    if (!draft.title.trim()) return;
    await upsert({ ...draft, title: draft.title.trim(), updatedAt: new Date().toISOString() });
    onClose();
  };
  const remove = async () => {
    if (!confirm('Delete this idea and its attached photos?')) return;
    await del(draft.id);
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
      set({ photoIds: [...draft.photoIds, ...ids] });
    } finally {
      setBusy(false);
    }
  };
  const detach = async (id: string) => {
    set({ photoIds: draft.photoIds.filter((p) => p !== id) });
    forgetPhotoUrl(id);
    await removePhoto(id);
  };

  return (
    <Modal open onClose={onClose} title={isNew ? 'New idea' : 'Edit idea'} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <Field label="Title">
            <input className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} autoFocus placeholder="The Lantern Ferry" />
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
                <option value="idle">Idle</option>
                <option value="progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </Field>
          </div>
          <Field label="Palette" hint="Comma-separated block names">
            <input className="input" value={draft.palette.join(', ')} onChange={(e) => set({ palette: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="spruce, deepslate tiles, copper, lanterns" />
          </Field>
          <Toggle checked={!!draft.allowFarms} onChange={(v) => set({ allowFarms: v })} label="Includes a farm" />
        </div>
        <div className="space-y-3">
          <Field label="Reference links" hint="One per line: title | url">
            <textarea
              className="input min-h-20 font-mono text-xs"
              value={draft.sourceLinks.map((l) => `${l.title} | ${l.url}`).join('\n')}
              onChange={(e) =>
                set({
                  sourceLinks: e.target.value
                    .split('\n')
                    .map((line) => {
                      const [t, u] = line.split('|').map((s) => s.trim());
                      return u ? { title: t || u, url: u } : t && /^https?:\/\//.test(t) ? { title: t, url: t } : null;
                    })
                    .filter((x): x is { title: string; url: string } => !!x),
                })
              }
            />
          </Field>
          <Field label="Reference image URLs" hint="Hotlinked, one per line. Kept as links; never copied.">
            <textarea className="input min-h-16 font-mono text-xs" value={draft.imageUrls.join('\n')} onChange={(e) => set({ imageUrls: e.target.value.split('\n').map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s)) })} />
          </Field>
          <Field label={`Your photos (${draft.photoIds.length}/6)`} hint="PNG/JPG, downscaled to 1600px and stored in your data folder.">
            <div className="flex flex-wrap gap-2">
              {draft.photoIds.map((id) => (
                <PhotoThumb key={id} id={id} onRemove={() => void detach(id)} />
              ))}
              {draft.photoIds.length < 6 && (
                <label className="btn btn-sm cursor-pointer">
                  {busy ? 'Adding…' : '+ Attach'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => void attach(e.target.files)} disabled={busy} />
                </label>
              )}
            </div>
          </Field>
          {draft.imageUrls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {draft.imageUrls.map((u) => (
                <img key={u} src={u} alt="" className="h-16 w-16 object-cover rounded-lg border border-border bg-surface-2" loading="lazy" referrerPolicy="no-referrer" />
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
          <span />
        )}
        <div className="flex gap-2">
          <button className="btn" onClick={onClose}>
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
      <button className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-surface-3 border border-border-2 text-[10px] opacity-0 group-hover:opacity-100" onClick={onRemove} aria-label="Remove photo">
        ✕
      </button>
    </div>
  );
}
