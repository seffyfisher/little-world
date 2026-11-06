#!/usr/bin/env python3
"""Build a small CC0 art catalog and same-origin images for a fully static app."""
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'web/data/art-catalog.json'
ASSETS = ROOT / 'web/assets/art'


def normalize(item):
    image = (item.get('images') or {}).get('web') or {}
    try:
        width, height = int(image.get('width', 0)), int(image.get('height', 0))
    except (ValueError, TypeError):
        return None
    accession = item.get('accession_number') or ''
    if (item.get('share_license_status') != 'CC0' or item.get('type') != 'Painting'
        or not re.fullmatch(r'[A-Za-z0-9._-]{1,60}', accession)
        or width < 420 or height < 300 or abs(width / height / (105 / 77) - 1) > .05
        or image.get('url') != f'https://openaccess-cdn.clevelandart.org/{accession}/{accession}_web.jpg'):
        return None
    creators = [x.get('description', '') for x in item.get('creators', []) if x.get('role') == 'artist']
    return {'id': item['id'], 'accession': accession, 'width': width, 'height': height,
            'isPublicDomain': True, 'title': item.get('title') or 'Untitled',
            'artist': ' / '.join(creators) or 'Unknown artist', 'date': item.get('creation_date') or ''}


def download(url, maximum=2000000):
    return subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '30',
                           '--max-filesize', str(maximum), '--user-agent', 'LittleWorld/0.4 (+https://now.shinlamed.com)', url],
                          check=True, capture_output=True).stdout


def refresh(force=False):
    previous = None
    complete = False
    try:
        previous = json.loads(OUTPUT.read_text())
        complete = previous.get('provider') == 'Cleveland Museum of Art' and previous.get('items') and all((ASSETS / f"cma-{x['id']}.jpg").exists() for x in previous['items'])
        if not force and complete and (datetime.now(timezone.utc) - datetime.fromisoformat(previous['generatedAt'])).total_seconds() < 604800:
            print(f"Art catalog: kept {len(previous['items'])} works (weekly refresh)")
            return
    except (OSError, ValueError, KeyError):
        pass
    items = {}
    ASSETS.mkdir(parents=True, exist_ok=True)
    try:
        for offset in range(0, 2000, 200):
            url = 'https://openaccess-api.clevelandart.org/api/artworks/?' + urlencode({
                'cc0': 1, 'has_image': 1, 'type': 'Painting', 'limit': 200, 'skip': offset,
                'fields': 'id,accession_number,title,share_license_status,type,images,creators,creation_date'})
            try:
                data = json.loads(download(url, 4000000))
            except (subprocess.CalledProcessError, ValueError):
                if len(items) >= 10:
                    break
                raise
            for raw in data['data']:
                item = normalize(raw)
                if not item:
                    continue
                path = ASSETS / f"cma-{item['id']}.jpg"
                if not path.exists():
                    try:
                        image = download(raw['images']['web']['url'])
                        if not image.startswith(b'\xff\xd8'):
                            continue
                        path.write_bytes(image)
                    except subprocess.CalledProcessError:
                        continue
                    time.sleep(.2)
                items[item['id']] = item
                if len(items) >= 40:
                    break
            if len(items) >= 40 or not data['data']:
                break
            time.sleep(1)
        if len(items) < 10:
            raise ValueError('The museum did not return enough suitable images')
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        temporary = OUTPUT.with_suffix('.tmp')
        temporary.write_text(json.dumps({'schemaVersion': 1, 'provider': 'Cleveland Museum of Art',
                                        'generatedAt': datetime.now(timezone.utc).isoformat(), 'items': list(items.values())}, ensure_ascii=False, indent=2) + '\n')
        temporary.replace(OUTPUT)
        print(f'Art catalog: {len(items)} CC0 paintings matching the frame')
    except Exception:
        if not complete:
            raise
        print(f"Art catalog: museum unavailable; kept {len(previous['items'])} previous works")


if __name__ == '__main__':
    import sys
    refresh('--force' in sys.argv)
