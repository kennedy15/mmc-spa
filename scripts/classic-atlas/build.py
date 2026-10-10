"""Build the Classic World map explorer's data: public/classic/atlas.json and its images.

    python3 scripts/classic-atlas/build.py all      # fetch + drops + build
    python3 scripts/classic-atlas/build.py fetch    # launch-client datamine, map renders, monster sprites (cached)
    python3 scripts/classic-atlas/build.py drops    # drop logs from mapleclassic.wiki, item icons
    python3 scripts/classic-atlas/build.py build    # map images, atlas.json, sprites and icons into public/classic/

Needs Python 3.9+ and Pillow (pip3 install pillow). Downloads are cached in $CLASSIC_ATLAS_WORK (default
~/.cache/classic-atlas); delete it, or its osms/ folder, to start over after OSMS redeploys.

Sources:
- Maps, spawn points, portals, NPCs, monsters, quests and items: the launch-client datamine published by OSMS Data Explorer
  (https://osmsdataexplorer.com, GitHub ohmi69/osms_datamine_dashboard, data/current). Its map renders are full maps
  with every x and y in the same pixels as the spawn and portal data.
- Drops: mapleclassic.wiki's monster_drops Cargo table: kills logged on the launch build, CC BY-NC-SA 4.0.
- World-map art and markers: public/classic.json `worldMaps` (maplestory.io MCW CBT2), cut to the maps the launch has.
- map-notes.json (how you get into maps no portal reaches) and portal-notes.json (doors the data can't explain) are
  hand-kept beside this script, from the launch client's quest and NPC text and the guides they cite.
"""
import html
import json
import os
import re
import shutil
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict, deque
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
PUBLIC = os.path.join(REPO, 'public')
WORK = os.environ.get('CLASSIC_ATLAS_WORK', os.path.expanduser('~/.cache/classic-atlas'))
OSMS = os.path.join(WORK, 'osms')
RAW = 'https://raw.githubusercontent.com/ohmi69/osms_datamine_dashboard/main/'
UA = 'MapleTracker-atlas/1.0 (personal fan site, github.com/kennedy15/mmc-spa)'
DROPS_API = ('https://mapleclassic.wiki/api.php?action=cargoquery&format=json&limit=500&tables=monster_drops=d,items=i,monsters=m'
             '&join_on=d.item_id=i._pageName,d.monster_id=m._pageName&fields=d.monster_id=monster,m.id=monster_wiki_id,d.item_id=item,'
             'i.id=item_id,d.category=category,d.drop_rate=rate,d.min_quantity=qmin,d.max_quantity=qmax,d.sample_kills=kills,'
             'd.sample_drops=drops,d.rate_low=lo,d.rate_high=hi,d.game_version=ver')
OSMS_FILES = ('maps', 'portals', 'monsters', 'quests', 'items', 'lookups', 'map_manifest')

NONE = 999999999
# Portal types (Map.wz "pt"): 1 invisible, 2 visible, 3 walk-in, 6 Mystic Door spot, 7/8 scripted, 11 scripted hidden (quest),
# 14 party-quest stage exit.
KIND = {1: 'invisible', 2: 'visible', 3: 'walk', 7: 'script', 8: 'script', 11: 'quest', 14: 'stage'}

# Map images: long edge FULL px (extreme shapes keep a SHORT px short edge, up to MAXL long), flattened on the frame colour.
FULL, SHORT, MAXL, FULL_Q = 1400, 480, 2400, 68
THUMB, THUMB_Q = 360, 66
BG = (28, 20, 14)  # #1c140e, MAP_BG in src/features/classic/AtlasParts.tsx


def load(name):
    return json.load(open(os.path.join(OSMS, name + '.json')))


def get(url, dest, tries=4, refresh=False):
    """Download url to dest unless it's cached; returns 'ok', 'cached', 'missing' or 'FAIL ...'."""
    if not refresh and os.path.exists(dest) and os.path.getsize(dest) > 0:
        return 'cached'
    err = None
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=90) as r:
                data = r.read()
            tmp = dest + '.part'
            open(tmp, 'wb').write(data)
            os.replace(tmp, dest)
            return 'ok'
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return 'missing'
            err = e
        except Exception as e:  # noqa: BLE001 - retried, then reported
            err = e
        time.sleep(2 * (k + 1))
    return f'FAIL {err}'


def selected_maps():
    """Maple Island and Victoria Island, plus the Kerning City party quest, the 2nd-job test maps and the Free Market."""
    out = []
    for r in load('maps')['regions']:
        for m in r['maps']:
            if not m['name']:
                continue
            if r['region'] in ('Maple Island', 'Victoria Island') or (r['region'] == 'Other' and 80000000 <= m['id'] <= 80002011):
                out.append(m)
    return out


# ── fetch ────────────────────────────────────────────────────────────────────────────────────────────────────────────

def fetch():
    os.makedirs(OSMS, exist_ok=True)
    for f in OSMS_FILES:
        print(f, get(RAW + f'data/current/{f}.json', os.path.join(OSMS, f + '.json'), refresh=True))
    manifest = load('map_manifest')
    jobs = []
    os.makedirs(os.path.join(OSMS, 'renders'), exist_ok=True)
    os.makedirs(os.path.join(OSMS, 'mobimg'), exist_ok=True)
    for m in selected_maps():
        h = manifest.get(str(m['id']).zfill(9))
        if h:  # renders are named by content hash, so a changed map downloads again
            jobs.append((RAW + f'data/maps/{h}.webp', os.path.join(OSMS, 'renders', f"{m['id']}.{h[:8]}.webp")))
        else:
            print('no render for', m['id'], m['name'])
    for x in load('monsters')['monsters']:
        if x.get('thumbnail'):
            jobs.append((RAW + f"data/images/monsters/{x['thumbnail']}.png", os.path.join(OSMS, 'mobimg', f"{x['id']}.png")))
        for anim in ('stand', 'move'):
            h = (x.get('gifs') or {}).get(anim)
            if h:
                jobs.append((RAW + f'data/images/monsters/{h}.webp', os.path.join(OSMS, 'mobimg', f"{x['id']}.{anim}.webp")))
    with ThreadPoolExecutor(6) as ex:
        for (url, dest), res in zip(jobs, ex.map(lambda j: get(*j), jobs)):
            if res not in ('cached', 'ok'):
                print(res, os.path.basename(dest))
    print(len(jobs), 'files checked')


def render_of(mid):
    """The cached render for a map (the newest hash)."""
    h = load('map_manifest').get(str(mid).zfill(9), '')
    path = os.path.join(OSMS, 'renders', f'{mid}.{h[:8]}.webp')
    return path if os.path.exists(path) else None


# ── drops ────────────────────────────────────────────────────────────────────────────────────────────────────────────

def norm(name):
    return re.sub(r'[^a-z0-9]+', ' ', name.lower()).strip()


def item_tables():
    items = load('items')
    by_id = {x['id']: x for x in items['items']}
    for x in items.get('scrolls', []):
        by_id.setdefault(x['id'], x)
    names = {int(k): v for k, v in load('lookups')['item_names'].items()}
    by_name = defaultdict(list)
    for iid, name in list(names.items()) + [(i, x['name']) for i, x in by_id.items()]:
        if iid not in by_name[norm(name)]:
            by_name[norm(name)].append(iid)
    return by_id, names, by_name


def item_type(iid):
    return {1: 'Equip', 2: 'Use', 3: 'Setup', 4: 'Etc', 5: 'Cash'}.get(iid // 1000000, 'Etc')


def drops():
    dest = os.path.join(WORK, 'mapleclassic-drops.json')
    print('drop table', get(DROPS_API, dest, refresh=True))
    rows = [r['title'] for r in json.load(open(dest))['cargoquery']]
    by_id, names, by_name = item_tables()
    mob_ids = defaultdict(list)
    for m in load('monsters')['monsters']:
        if not m.get('special'):  # drops go on the ordinary monster, not its job-test or party-quest copy
            mob_ids[norm(m['name'])].append(m['id'])
    out, items, versions, seen, unmatched = {}, {}, set(), set(), []
    num = lambda v: None if v in (None, '') else float(v)  # noqa: E731
    for r in rows:
        key = (r['monster'], r['item'], r['category'])
        if key in seen:
            continue  # the join repeats a row once per monster ID sharing the wiki page
        seen.add(key)
        ids = mob_ids.get(norm(r['monster']))
        if not ids:
            unmatched.append(('monster', r['monster']))
            continue
        if r.get('ver'):
            versions.add(r['ver'])
        kills = int(r['kills']) if r['kills'] not in (None, '') else 0
        rate = num(r['rate']) if kills else None
        name = html.unescape(r['item'] or '')
        iid = int(r['item_id']) if (r['item_id'] or '').isdigit() else None
        if r['category'] not in ('meso', 'nothing'):
            # Trust the wiki's ID only when the launch client has that ID under that name; else match the name.
            if iid is None or norm(names.get(iid, by_id.get(iid, {}).get('name', ''))) != norm(name):
                found = sorted(by_name.get(norm(name), []))
                iid = found[0] if found else None
            if iid is None:
                unmatched.append(('item', name))
                continue
        for mid in ids:
            e = out.setdefault(str(mid), {'kills': 0, 'items': []})
            e['kills'] = max(e['kills'], kills)
            if r['category'] == 'meso':
                if rate is not None:
                    e['meso'] = {'rate': round(rate, 1), 'q': [int(num(r['qmin']) or 0), int(num(r['qmax']) or 0)]}
            elif r['category'] == 'nothing':
                if rate is not None:
                    e['none'] = round(rate, 1)
            else:
                d = {'id': iid}
                if rate is not None:
                    d.update(rate=round(rate, 1), lo=round(num(r['lo']), 1), hi=round(num(r['hi']), 1))
                if r['qmin'] and r['qmax'] and (int(num(r['qmin'])) != 1 or int(num(r['qmax'])) != 1):
                    d['q'] = [int(num(r['qmin'])), int(num(r['qmax']))]
                if r['category'] == 'quest':
                    d['quest'] = True
                e['items'].append(d)
                items[iid] = name
    os.makedirs(os.path.join(WORK, 'items'), exist_ok=True)
    items_out = {}
    for iid, name in sorted(items.items()):
        got = get(RAW + f'data/current/images/items/{iid:08d}.png', os.path.join(WORK, 'items', f'{iid}.png'))
        items_out[str(iid)] = {'name': names.get(iid) or by_id.get(iid, {}).get('name') or name, 'type': item_type(iid)}
        if got in ('ok', 'cached'):
            items_out[str(iid)]['icon'] = f'classic/items/{iid}.png'
    for e in out.values():  # rated items first, by rate; then the ones seen without a count
        e['items'].sort(key=lambda d: (d.get('rate') is None, -(d.get('rate') or 0)))
    doc = {
        'source': {
            'title': 'mapleclassic.wiki',
            'url': 'https://mapleclassic.wiki/wiki/MapleWiki:Report_an_item_drop',
            'note': f"Kills recorded on the launch build ({', '.join(sorted(versions))}), CC BY-NC-SA 4.0",
        },
        'mobs': out,
        'items': items_out,
    }
    json.dump(doc, open(os.path.join(WORK, 'drops.json'), 'w'), indent=1)
    print('monsters with drops', len(out), '(with kill counts', sum(1 for e in out.values() if e['kills']), ') items', len(items_out))
    if unmatched:
        print('unmatched', unmatched)


# ── build ────────────────────────────────────────────────────────────────────────────────────────────────────────────

def one_image(job):
    from PIL import Image
    mid, src, out = job
    im = Image.open(src).convert('RGBA')
    W, H = im.size
    flat = Image.new('RGBA', im.size, BG + (255,))
    flat.alpha_composite(im)
    flat = flat.convert('RGB')
    s = min(1, max(FULL / max(W, H), SHORT / min(W, H)), MAXL / max(W, H))
    full = flat.resize((round(W * s), round(H * s)), Image.LANCZOS) if s < 1 else flat
    full.save(os.path.join(out, f'{mid}.webp'), 'WEBP', quality=FULL_Q, method=6)
    t = min(1, THUMB / W, (THUMB * 0.75) / H)
    flat.resize((max(1, round(W * t)), max(1, round(H * t))), Image.LANCZOS).save(os.path.join(out, 't', f'{mid}.webp'), 'WEBP', quality=THUMB_Q, method=6)
    return mid, [W, H]


def images(sel):
    """Map images into public/classic/maps (only maps whose render changed are redone); returns each render's size."""
    out = os.path.join(PUBLIC, 'classic', 'maps')
    os.makedirs(os.path.join(out, 't'), exist_ok=True)
    stamp_file = os.path.join(WORK, 'images-done.json')
    done = json.load(open(stamp_file)) if os.path.exists(stamp_file) else {}
    sizes, jobs = {}, []
    for mid in sel:
        src = render_of(mid)
        if not src:
            raise SystemExit(f'no render cached for map {mid}: run fetch first')
        key = os.path.basename(src)
        if done.get(str(mid), {}).get('src') == key and os.path.exists(os.path.join(out, f'{mid}.webp')):
            sizes[mid] = done[str(mid)]['size']
        else:
            jobs.append((mid, src, out))
    with ProcessPoolExecutor(8) as ex:
        for mid, size in ex.map(one_image, jobs):
            sizes[mid] = size
            done[str(mid)] = {'src': os.path.basename(render_of(mid)), 'size': size}
    json.dump(done, open(stamp_file, 'w'))
    print('map images', len(jobs), 'made,', len(sel) - len(jobs), 'unchanged')
    return sizes


def build():
    from PIL import Image
    D, P, Q = load('maps'), load('portals'), {q['id']: q for q in load('quests')['quests']}
    M = {m['id']: m for m in load('monsters')['monsters']}
    npc_lookup = D['npc_lookup']
    classic = json.load(open(os.path.join(PUBLIC, 'classic.json')))
    drops_path = os.path.join(WORK, 'drops.json')
    dr = json.load(open(drops_path)) if os.path.exists(drops_path) else None
    notes = json.load(open(os.path.join(HERE, 'map-notes.json')))
    pnotes = json.load(open(os.path.join(HERE, 'portal-notes.json')))

    sel = {m['id']: m for m in selected_maps()}
    if sel.get(10001008, {}).get('name') == 'Victoria Road':  # the client has this house's name and street swapped
        m = sel[10001008]
        m['name'], m['street_name'] = m['street_name'], m['name']
    sizes = images(sel)

    # World-map markers, cut to the launch maps; a marker with none left is an area that isn't out (Forgotten Hollow).
    islands, marker_of = [], {}
    for wm in classic['worldMaps']:
        if wm['id'] not in ('maple-island', 'victoria-island'):
            continue
        markers = []
        for s in wm['spots']:
            maps = [x for x in s['maps'] if x in sel]
            mk = {'x': s['x'], 'y': s['y'], 'type': s['type'], 'maps': maps}
            if not maps:
                mk.update(label=s['names'][0], unreleased=True)
            else:
                towns = [x for x in maps if sel[x].get('is_town') and sel[x]['street_name'] != 'Hidden Street']
                # A town marker opens on its town square (the dungeon marker lists its tunnels first); otherwise its first map.
                main = next((x for x in towns if sel[x]['name'] in s['names'][:1] or sel[x].get('map_mark') and sel[x]['name'].replace(' ', '').lower() == (sel[x]['map_mark'] or '').lower()), None)
                mk['main'] = main or (towns[0] if s['type'] in (0, 2) and towns else maps[0])
                for x in maps:
                    marker_of.setdefault(x, len(markers))
            markers.append(mk)
        islands.append({'id': wm['id'], 'name': wm['name'], 'image': wm['image'], 'width': wm['width'], 'height': wm['height'], 'markers': markers})

    # Where each portal lands: a scripted door with no destination, or one into a map the data lacks (a housing
    # instance), leads to the one map whose own portal comes back to it.
    lands = defaultdict(set)
    for mid in sel:
        for p in P.get(str(mid).zfill(9), []):
            d = int(p['dest_map'])
            if d != NONE and d != mid and p.get('dest_portal'):
                lands[(d, p['dest_portal'])].add(mid)

    out_edges, in_edges, portals_of = defaultdict(list), defaultdict(list), {}
    for mid in sel:
        rows = []
        for p in P.get(str(mid).zfill(9), []):
            kind = KIND.get(p['type'])
            dest = int(p['dest_map'])
            if not kind or dest == mid or p.get('intra_map'):
                continue  # Mystic Door spots, teleports inside the map
            row = {'x': p['x'], 'y': p['y'], 'kind': kind}
            back = lands.get((mid, p['name']), set()) - {mid}
            # (Not a plain spot with no destination: those are where you land, not ways out.)
            if ((dest == NONE and kind == 'script') or (dest != NONE and dest not in sel)) and len(back) == 1:
                dest = next(iter(back))
                row['script'] = True
            if f"{mid}:{p['name']}" in pnotes:
                row['note'] = pnotes[f"{mid}:{p['name']}"]
            if dest != NONE:
                row['to'] = dest
            elif kind == 'quest':
                q = Q.get((re.match(r'q(\d+)pt', p['name'] or '') or [None, ''])[1])
                if q:
                    row['quest'] = q['name']
            elif kind == 'stage' and 80000000 <= mid < 80000500:
                # Kerning City party quest: a stage's exit opens on clearing it and leads on (IDs step by 100; Bonus after the last).
                row.update(to=mid + 100, script=True)
            elif p['name'] == 'market00':
                # Henesys Market and Perion: the Free Market's entrance (rooms 1-6 carry Henesys' map mark, 7-11 Perion's).
                row.update(to=80002000, script=True)
            elif kind == 'script':
                row['script'] = True
            else:
                continue  # an exit point with nowhere to go (a hidden portal's landing spot, a stage start)
            rows.append(row)
            if row.get('to') in sel:
                out_edges[mid].append(row['to'])
                in_edges[row['to']].append(mid)
        portals_of[mid] = rows

    def nearest_marked(mid):
        """For a map no marker lists: the nearest map one does, through portals, else along its return maps."""
        seen, dq = {mid}, deque([mid])
        while dq:
            cur = dq.popleft()
            if cur in marker_of and cur != mid:
                return cur
            for nb in out_edges[cur] + in_edges[cur]:
                if nb not in seen:
                    seen.add(nb)
                    dq.append(nb)
        back, hops = sel[mid].get('return_map_id'), 0
        while back and back not in marker_of and back in sel and hops < 4:
            back, hops = sel[back].get('return_map_id'), hops + 1
        return back if back in marker_of else None

    # Timed spawn points (mobTime, seconds) per map and monster: [shortest, longest], a minute or more only.
    timers = defaultdict(dict)
    for x in M.values():
        for e in x.get('maps') or []:
            if e.get('mob_time'):
                nums = [float(v) for v in re.findall(r'[\d.]+', e['mob_time'].split('[')[0])]
                if max(nums) >= 60:
                    timers[e['id']][str(x['id'])] = [round(min(nums)), round(max(nums))]

    maps_out, used_mobs, used_npcs = [], set(), set()
    for mid, m in sel.items():
        e = {'id': mid, 'name': m['name'].strip(), 'street': m['street_name'], 'island': 'maple-island' if m['region'] == 'Maple Island' else 'victoria-island', 'area': m.get('map_mark')}
        if m.get('is_town'):
            e['town'] = True
        if m['street_name'] == 'Hidden Street':
            e['hidden'] = True
        if mid in marker_of:
            e['marker'] = marker_of[mid]
        else:
            near = notes.get(str(mid), {}).get('near') or nearest_marked(mid)
            if near:
                e['near'] = near
        e['size'] = sizes[mid]
        spawns = [[p['x'], p['y'], p['id']] for p in m.get('mob_positions', [])]
        used_mobs.update(s[2] for s in spawns)
        if spawns:
            e['spawns'] = spawns
            if timers[mid]:
                e['timers'] = timers[mid]
        if m.get('mob_capacity') is not None:
            e['cap'] = m['mob_capacity']
        if m.get('mob_rate') not in (None, 1, 1.0, 0, 0.0):
            e['rate'] = m['mob_rate']
        if portals_of[mid]:
            e['portals'] = portals_of[mid]
        npcs = []
        for p in m.get('npc_positions', []):
            if [p['x'], p['y'], p['id']] not in npcs:
                npcs.append([p['x'], p['y'], p['id']])
                used_npcs.add(p['id'])
        if npcs:
            e['npcs'] = npcs
        back = m.get('return_map_id')
        if back and back != mid and back in sel:
            e['back'] = back
        if str(mid) in notes:
            e['note'] = {k: v for k, v in notes[str(mid)].items() if k != 'near'}
        maps_out.append(e)

    mob_dir = os.path.join(PUBLIC, 'classic', 'mobs')
    os.makedirs(os.path.join(mob_dir, 'a'), exist_ok=True)
    mobs_out = []
    for mid in sorted(used_mobs):
        x = M[mid]
        mob = {'id': mid, 'name': x['name'], 'level': x['level'], 'hp': x['hp'], 'mp': x.get('mp'), 'exp': x['exp'],
               'pad': x.get('PADamage'), 'mad': x.get('MADamage'), 'pdd': x.get('PDDamage'), 'mdd': x.get('MDDamage'),
               'acc': x.get('acc'), 'eva': x.get('eva') or 0, 'speed': x.get('speed'), 'knockback': x.get('pushed')}
        for src, k in (('hp_recovery', 'hpRec'), ('mp_recovery', 'mpRec'), ('elements', 'elements'), ('special', 'special'), ('attacks', 'attacks'), ('revives', 'revives'), ('self_buffs', 'buffs')):
            if x.get(src):
                mob[k] = x[src]
        if x.get('debuffs'):
            mob['debuffs'] = [{k: d[k] for k in ('id', 'level', 'name', 'time', 'interval', 'prop', 'x') if k in d} for d in x['debuffs']]
        for src, k in (('undead', 'undead'), ('is_boss', 'boss'), ('aggro', 'aggro')):
            if x.get(src):
                mob[k] = True
        mob = {k: v for k, v in mob.items() if v is not None}
        thumb = os.path.join(OSMS, 'mobimg', f'{mid}.png')
        # The sprite (kept if already in the repo, which has the second test's art for older monsters) and its size,
        # the box a click on the monster in the render lands in.
        if not os.path.exists(os.path.join(mob_dir, f'{mid}.png')):
            shutil.copy(thumb, os.path.join(mob_dir, f'{mid}.png'))
        mob['icon'] = f'classic/mobs/{mid}.png'
        mob['box'] = list(Image.open(thumb).size)
        anim = next((a for a in ('stand', 'move') if os.path.exists(os.path.join(OSMS, 'mobimg', f'{mid}.{a}.webp'))), None)
        if anim:
            shutil.copy(os.path.join(OSMS, 'mobimg', f'{mid}.{anim}.webp'), os.path.join(mob_dir, 'a', f'{mid}.webp'))
            mob['anim'] = f'classic/mobs/a/{mid}.webp'
        if dr and str(mid) in dr['mobs']:
            dm = dr['mobs'][str(mid)]
            mob['drops'] = dm['items']
            if dm['kills']:
                mob['dropKills'] = dm['kills']
            if 'meso' in dm:
                mob['meso'] = dm['meso']
            if 'none' in dm:
                mob['noDrop'] = dm['none']
        mobs_out.append(mob)

    doc = {
        'asOf': time.strftime('%Y-%m-%d'),
        'source': {'title': 'OSMS Data Explorer: launch client datamine (Public Release)', 'url': 'https://osmsdataexplorer.com/'},
        'artSource': {'title': 'World-map art and markers: maplestory.io (MCW CBT2)', 'url': 'https://maplestory.io/'},
        'islands': islands,
        'maps': sorted(maps_out, key=lambda e: e['id']),
        'mobs': mobs_out,
        'npcs': {str(n): npc_lookup[str(n)]['name'] for n in sorted(used_npcs) if str(n) in npc_lookup},
    }
    if dr:
        doc['items'] = dr['items']
        doc['dropSource'] = dr['source']
        item_dir = os.path.join(PUBLIC, 'classic', 'items')
        os.makedirs(item_dir, exist_ok=True)
        for iid, it in dr['items'].items():
            if 'icon' in it:
                shutil.copy(os.path.join(WORK, 'items', f'{iid}.png'), os.path.join(item_dir, f'{iid}.png'))
    out = os.path.join(PUBLIC, 'classic', 'atlas.json')
    json.dump(doc, open(out, 'w'), separators=(',', ':'), ensure_ascii=False)
    print('atlas.json:', len(maps_out), 'maps,', len(mobs_out), 'monsters,', len(doc['npcs']), 'NPCs,', os.path.getsize(out) // 1024, 'KB')
    loose = [e['name'] for e in maps_out if 'marker' not in e and 'near' not in e]
    if loose:
        print('maps with no world-map marker to sit under:', loose)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if cmd not in ('all', 'fetch', 'drops', 'build'):
        raise SystemExit(__doc__)
    if cmd in ('all', 'fetch'):
        fetch()
    if cmd in ('all', 'drops'):
        drops()
    if cmd in ('all', 'build'):
        build()
