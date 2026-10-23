// Real Oakland (Google 3D): streams Google Photorealistic 3D Tiles around Lake Merritt and the
// International Blvd corridor (1st Ave to 102nd Ave). Optional: only used when config.local.js has a key.
// Uses NASA-AMMOS 3DTilesRendererJS 0.3.20 (raw ES modules from jsdelivr) on the page's three r128 via vendor/three-shim.js.
import * as THREE from 'three';
import { GoogleTilesRenderer } from '3d-tiles-renderer/three/renderers/GoogleTilesRenderer.js';

const DEG = Math.PI / 180;

// quality-dependent budgets (iPhone-friendly on low/medium)
const BUDGET = {
  low: { errorTarget: 40, minSize: 250, maxSize: 450, dl: 6, parse: 2 },
  medium: { errorTarget: 24, minSize: 450, maxSize: 800, dl: 8, parse: 3 },
  high: { errorTarget: 12, minSize: 900, maxSize: 1600, dl: 16, parse: 5 },
};

function create({ apiKey, origin, renderer, camera, scene, corridor, quality = 'medium', onError }) {
  const tiles = new GoogleTilesRenderer(apiKey);
  // Draco-compressed glTF content (Google tiles) via the r128 loaders
  const draco = new window.THREE.DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
  const gltf = new window.THREE.GLTFLoader(tiles.manager);
  gltf.setDRACOLoader(draco);
  tiles.manager.addHandler(/\.(gltf|glb)$/i, gltf);

  // session handling: 0.3.20 can append "session=undefined"; keep the session from the first URI that has one, never duplicate params
  let session = null;
  tiles.onLoadTileSet = null;
  tiles.preprocessURL = uri => {
    const u = new URL(uri, location.href);
    if (!/^http/.test(u.protocol) || u.hostname !== 'tile.googleapis.com') return u.toString();
    const s = u.searchParams.get('session');
    if (s && !session) session = s;
    if (!s && session) u.searchParams.set('session', session);
    if (!u.searchParams.has('key')) u.searchParams.set('key', apiKey);
    return u.toString();
  };
  // anchoring: tiles are placed so the ellipsoid tangent plane touches the game's flat world at an anchor point.
  // Re-anchor near the player every ~1.5 km so Earth curvature (~8 m over 10 km) never shows.
  const GEOID = 32.2; // Oakland: ellipsoid sits ~32 m below sea level (EGM96 undulation -32.2 m)
  const wrap = new THREE.Group();
  wrap.name = 'google3d';
  wrap.rotation.y = Math.PI / 2; // tiles: X north, Z east -> game: x east, z south
  wrap.add(tiles.group);
  scene.add(wrap);
  let offset = GEOID, anchorX = 0, anchorZ = 0;
  function anchor(gx, gz) {
    anchorX = gx; anchorZ = gz;
    const lat = origin.lat - gz / 110574, lon = origin.lon + gx / 87951;
    tiles.setLatLonToYUp(lat * DEG, lon * DEG);
    wrap.position.set(gx, offset, gz);
    if (local) rebuildCorridor();
  }
  let local = null;
  anchor(0, 0);
  // photogrammetry already contains its lighting: draw it unlit, in sRGB, without tone mapping (otherwise it turns blue/dark)
  tiles.onLoadModel = model => {
    model.traverse(o => {
      if (!o.isMesh) return;
      const old = o.material, map = old && old.map;
      if (map) map.encoding = THREE.sRGBEncoding;
      o.material = new THREE.MeshBasicMaterial({ map: map || null, color: map ? 0xffffff : (old && old.color ? old.color : 0x888888), fog: true, toneMapped: false });
      if (old && old !== o.material) old.dispose();
    });
  };
  tiles.setCamera(camera);
  tiles.setResolutionFromRenderer(camera, renderer);

  // ---- corridor limit: only traverse tiles near the lake / International Blvd (keeps tile requests down)
  local = [];
  const tmp = new THREE.Vector3(), inv = new THREE.Matrix4();
  function rebuildCorridor() {
    wrap.updateMatrixWorld(true);
    inv.copy(tiles.group.matrixWorld).invert();
    local.length = 0;
    for (const c of corridor) local.push({ p: new THREE.Vector3(c[0], c[2] || 0, c[1]).applyMatrix4(inv), r: c[3] });
  }
  rebuildCorridor();
  const baseInView = tiles.tileInView.bind(tiles);
  tiles.tileInView = tile => {
    if (!baseInView(tile)) return false;
    const bv = tile.cached.boundingVolume;
    for (const c of local) if (bv.distanceToPoint(c.p) <= c.r) return true;
    return false;
  };

  // request counter (for cost tracking): resource timing entries to tile.googleapis.com
  const stats = { requests: 0, glb: 0, json: 0 };
  let po = null;
  try {
    po = new PerformanceObserver(list => { for (const e of list.getEntries()) if (e.name.includes('tile.googleapis.com')) { stats.requests++; if (/\.glb/.test(e.name)) stats.glb++; else stats.json++; } });
    po.observe({ type: 'resource', buffered: false });
  } catch (e) {}

  let failed = false;
  const t0 = performance.now();
  const errTimer = setInterval(() => {
    if (failed || tiles.root) { if (tiles.root) clearInterval(errTimer); return; }
    if (performance.now() - t0 > 15000) { failed = true; clearInterval(errTimer); onError && onError('Google 3D tiles did not load (key, quota or network).'); }
  }, 1000);
  tiles.fetchOptions.mode = 'cors';
  const baseFetchTileSet = tiles.fetchTileSet.bind(tiles);
  tiles.fetchTileSet = (url, ...rest) => baseFetchTileSet(url, ...rest).catch(err => {
    if (!tiles.root && !failed) { failed = true; onError && onError('Google 3D tiles were refused (check the API key / quota).'); }
    throw err;
  });

  function setQuality(q) {
    const b = BUDGET[q] || BUDGET.medium;
    tiles.errorTarget = b.errorTarget;
    tiles.lruCache.minSize = b.minSize; tiles.lruCache.maxSize = b.maxSize;
    tiles.downloadQueue.maxJobs = b.dl; tiles.parseQueue.maxJobs = b.parse;
  }
  setQuality(quality);

  // ---- ground: raycast straight down onto loaded tile meshes
  const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), hits = [];
  function groundAt(x, z, fromY) {
    rc.set(tmp.set(x, fromY, z), down); rc.far = 600;
    hits.length = 0; tiles.raycast(rc, hits);
    if (!hits.length) return null;
    let best = null; for (const h of hits) if (best === null || h.distance < best.distance) best = h;
    return best.point.y;
  }
  // fine vertical alignment once detailed tiles are in: match tile ground to the game's terrain (only small corrections)
  let calibrated = false, tries = 0;
  function calibrate(x, z, gameY) {
    if (tiles.visibleTiles.size < 12) return false;
    const y = groundAt(x, z, gameY + 60);
    if (++tries > 600) { calibrated = true; return true; }
    if (y === null) return false;
    const d = gameY - y;
    if (Math.abs(d) < 15) { offset += d; wrap.position.y = offset; calibrated = true; rebuildCorridor(); }
    return calibrated;
  }
  function follow(px, pz) { if (Math.hypot(px - anchorX, pz - anchorZ) > 1500) anchor(px, pz); }

  return {
    tiles, wrap, stats,
    update() { camera.updateMatrixWorld(); tiles.setResolutionFromRenderer(camera, renderer); tiles.update(); },
    groundAt, calibrate, follow, get calibrated() { return calibrated; }, setQuality,
    credits() { try { return tiles.getCreditsString(); } catch (e) { return ''; } },
    get failed() { return failed; },
    set visible(v) { wrap.visible = v; },
    dispose() { clearInterval(errTimer); po && po.disconnect(); scene.remove(wrap); tiles.dispose(); draco.dispose(); },
  };
}

window.ROB_G3D = { create };
window.dispatchEvent(new Event('rob-g3d-ready'));
