"""Pecah GLB model Tesla Bot (default model/tesla_bot_rigged.glb) menjadi:
  - tesla_bot_geo.txt : GLB berisi geometri saja, di-encode base64
  - tesla_tex0..2.png : tekstur sebagai file terpisah

Alasan: Claude Artifact tidak menyajikan file .glb, jadi geometri dikirim sebagai teks
lalu di-decode di browser (GLTFLoader.parse). Untuk hosting biasa cara ini juga jalan.

Pakai:  python3 tools/split_glb.py [file.glb]   (dijalankan dari root repo)
Model ber-rig dibuat oleh tools/rig_tesla_bot.py dari model/tesla_bot.glb.
"""
import base64, json, struct, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else 'model/tesla_bot_rigged.glb'
b = open(SRC, 'rb').read()
cl, _ = struct.unpack('<I4s', b[12:20])
j = json.loads(b[20:20 + cl])
off = 20 + cl
bl, _ = struct.unpack('<I4s', b[off:off + 8])
BIN = b[off + 8:off + 8 + bl]

img_bv = set(im['bufferView'] for im in j['images'])
for i, im in enumerate(j['images']):
    bv = j['bufferViews'][im['bufferView']]
    s = bv.get('byteOffset', 0)
    open(f'tesla_tex{i}.png', 'wb').write(BIN[s:s + bv['byteLength']])
    im.pop('bufferView'); im.pop('mimeType', None); im['uri'] = f'tesla_tex{i}.png'

newbin, remap, nbv = bytearray(), {}, []
for i, bv in enumerate(j['bufferViews']):
    if i in img_bv:
        continue
    while len(newbin) % 4:
        newbin.append(0)
    s = bv.get('byteOffset', 0)
    nb = dict(bv); nb['byteOffset'] = len(newbin)
    newbin += BIN[s:s + bv['byteLength']]
    remap[i] = len(nbv); nbv.append(nb)
while len(newbin) % 4:
    newbin.append(0)
j['bufferViews'] = nbv
for a in j['accessors']:
    if 'bufferView' in a:
        a['bufferView'] = remap[a['bufferView']]
j['buffers'] = [{'byteLength': len(newbin)}]

js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4:
    js += b' '
glb = (struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(newbin))
       + struct.pack('<I4s', len(js), b'JSON') + js
       + struct.pack('<I4s', len(newbin), b'BIN\x00') + bytes(newbin))
open('tesla_bot_geo.txt', 'w').write(base64.b64encode(glb).decode())
print('ok:', len(glb), 'byte geometri')
