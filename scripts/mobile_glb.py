"""Make a phone copy of a GLB: every texture downscaled (base colour to BASE px, other maps to OTHER px), JPEG re-encoded.
usage: python3 scripts/mobile_glb.py in.glb out.glb [BASE=1024] [OTHER=512]"""
import sys, json, struct, io
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]; BASE = int(sys.argv[3]) if len(sys.argv) > 3 else 1024; OTHER = int(sys.argv[4]) if len(sys.argv) > 4 else 512
d = open(src, 'rb').read(); l = struct.unpack('<I', d[12:16])[0]; j = json.loads(d[20:20 + l]); binc = d[20 + l + 8:]
base_imgs = {j['textures'][m['pbrMetallicRoughness']['baseColorTexture']['index']]['source'] for m in j.get('materials', []) if 'baseColorTexture' in m.get('pbrMetallicRoughness', {})}
img_bv = {im['bufferView']: (i, im) for i, im in enumerate(j.get('images', [])) if 'bufferView' in im}
out = bytearray()
for k, bv in enumerate(j['bufferViews']):
    b = binc[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
    if k in img_bv:
        i, im = img_bv[k]; pic = Image.open(io.BytesIO(b)); size = BASE if i in base_imgs else OTHER
        if max(pic.size) > size: pic = pic.resize((size, size), Image.LANCZOS)
        buf = io.BytesIO(); pic.convert('RGB').save(buf, 'JPEG', quality=82); b = buf.getvalue(); im['mimeType'] = 'image/jpeg'
    while len(out) % 4: out.append(0)
    bv['byteOffset'] = len(out); bv['byteLength'] = len(b); out += b
while len(out) % 4: out.append(0)
j['buffers'] = [{'byteLength': len(out)}]
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((4 - len(js) % 4) % 4)
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(dst, 'wb').write(glb); print(dst, len(glb))
