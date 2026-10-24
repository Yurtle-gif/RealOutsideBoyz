// Real Outside Boyz audio: 100% procedural Web Audio (no samples, no recorded music). See AUDIO_CREDITS.md.
// Engines per ride, tyres, wind, impacts, and 3D ambience (city hum, sirens, Lake Merritt water/birds,
// East Bay Dragons block party with an original generated beat, taco truck sizzle + generator).
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const PROFILES = {
    // fire = firing pulses per crank rev; dist = waveshaper drive; bright = lowpass base; rasp = noise layer
    bike: { idle: 1600, red: 11000, fire: 1, dist: 8, bright: 900, q: 4, rasp: 0.5, sub: 0.25, twin: 0, vol: 0.8 },   // 2-stroke single: raspy
    grom: { idle: 1500, red: 9500, fire: 0.5, dist: 3, bright: 520, q: 2, rasp: 0.15, sub: 0.6, twin: 0, vol: 0.75 },  // 4-stroke single: thumpy
    quad: { idle: 1500, red: 9000, fire: 2, dist: 9, bright: 1000, q: 3.5, rasp: 0.45, sub: 0.3, twin: 1.6, vol: 0.85 }, // twin 2-stroke: beating
    car:  { idle: 750, red: 7000, fire: 3, dist: 1.6, bright: 420, q: 1.2, rasp: 0.08, sub: 0.5, twin: 0.4, vol: 0.9 },  // V6 4-stroke: smooth
  };
  function curve(k) { const n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }

  function create() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ac = new AC({ latencyHint: 'interactive' });
    // iOS Safari unlock: play a silent buffer inside the gesture
    try { const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch (e) {}
    const master = ac.createGain(), sfx = ac.createGain(), amb = ac.createGain();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    sfx.connect(master); amb.connect(master); master.connect(comp); comp.connect(ac.destination);
    const vol = { master: 0.8, sfx: 0.9, amb: 0.7 };
    try { const v = JSON.parse(localStorage.getItem('rob-audio-vol') || 'null'); if (v) Object.assign(vol, v); } catch (e) {}
    function applyVol() { master.gain.value = vol.master; sfx.gain.value = vol.sfx; amb.gain.value = vol.amb; }
    applyVol();
    // shared noise buffers (white + brown), generated once
    const SR = ac.sampleRate, nb = ac.createBuffer(1, SR * 2, SR), bb = ac.createBuffer(1, SR * 2, SR);
    { const w = nb.getChannelData(0), b = bb.getChannelData(0); let l = 0; for (let i = 0; i < w.length; i++) { w[i] = Math.random() * 2 - 1; l = (l + 0.02 * w[i]) / 1.02; b[i] = l * 3.5; } }
    const noise = (buf = nb) => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = Math.random(); s.start(0, Math.random() * 1.5); return s; };
    const gain = (v, to) => { const g = ac.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    const filt = (type, f, q, to) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; if (to) b.connect(to); return b; };
    const panner = (to) => { const p = ac.createPanner(); p.panningModel = 'equalpower'; p.distanceModel = 'inverse'; p.refDistance = 8; p.maxDistance = 600; p.rolloffFactor = 1.1; p.connect(to); return p; };
    const setPos = (p, x, y, z) => { const t = ac.currentTime; if (p.positionX) { p.positionX.setTargetAtTime(x, t, 0.05); p.positionY.setTargetAtTime(y, t, 0.05); p.positionZ.setTargetAtTime(z, t, 0.05); } else p.setPosition(x, y, z); };

    // ---------- engine (player): osc pulse train -> waveshaper -> lowpass, + sub, + twin detune, + rasp noise
    const eng = {};
    eng.out = gain(0, sfx);
    eng.lp = filt('lowpass', 800, 3, eng.out);
    eng.ws = ac.createWaveShaper(); eng.ws.oversample = 'none'; eng.ws.connect(eng.lp);
    eng.pre = gain(0.5, eng.ws);
    eng.o1 = ac.createOscillator(); eng.o1.type = 'sawtooth'; eng.o1.connect(eng.pre);
    eng.o2 = ac.createOscillator(); eng.o2.type = 'sawtooth'; eng.g2 = gain(0, eng.pre); eng.o2.connect(eng.g2); // twin / second bank
    eng.o3 = ac.createOscillator(); eng.o3.type = 'square'; eng.g3 = gain(0.3, eng.lp); eng.o3.connect(eng.g3);  // sub (half order)
    eng.n = noise(); eng.nb = filt('bandpass', 2000, 1.2); eng.ng = gain(0, eng.lp); eng.n.connect(eng.nb); eng.nb.connect(eng.ng);
    [eng.o1, eng.o2, eng.o3].forEach(o => o.start());
    eng.prof = null; eng.rpm = 0; eng.limT = 0;
    function setProfile(m) {
      const P = PROFILES[m] || PROFILES.bike; if (eng.prof === P) return; eng.prof = P;
      eng.ws.curve = curve(P.dist); eng.lp.Q.value = P.q; eng.g3.gain.value = P.sub * 0.5; eng.g2.gain.value = P.twin ? 0.7 : 0;
    }
    // ---------- tyres, wind
    const skid = { n: noise(), bp: filt('bandpass', 2400, 6), g: gain(0, sfx) }; skid.n.connect(skid.bp); skid.bp.connect(skid.g);
    const skid2 = filt('bandpass', 1300, 9, skid.g); skid.n.connect(skid2);
    const wind = { n: noise(), lp: filt('lowpass', 500, 0.7), g: gain(0, sfx) }; wind.n.connect(wind.lp); wind.lp.connect(wind.g);
    // ---------- one-shots
    function burst(len, decayPow, f, type, g0, to = sfx, q = 0.8) {
      const t = ac.currentTime, n = Math.floor(SR * len), b = ac.createBuffer(1, n, SR), d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decayPow);
      const s = ac.createBufferSource(); s.buffer = b; const fl = filt(type, f, q), g = gain(g0); s.connect(fl); fl.connect(g); g.connect(to); s.start(t);
    }
    function boom(f0, f1, len, g0, to = sfx) { const t = ac.currentTime, o = ac.createOscillator(), g = gain(0, to); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len); g.gain.setValueAtTime(g0, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len); o.connect(g); o.start(t); o.stop(t + len + 0.02); }
    const fx = {
      thud(k = 1) { boom(110, 40, 0.25, 0.6 * k); burst(0.25, 3, 900, 'lowpass', 0.35 * k); },
      land(k = 1) { boom(80, 35, 0.2, 0.5 * k); burst(0.12, 2, 400, 'lowpass', 0.25 * k); },
      crash() { boom(90, 30, 0.5, 0.9); burst(0.6, 2.5, 1800, 'lowpass', 0.6); burst(0.9, 1.5, 3500, 'bandpass', 0.25, sfx, 2); setTimeout(() => burst(0.3, 3, 2500, 'bandpass', 0.2, sfx, 3), 180); },
      splash() { burst(1.1, 1.6, 900, 'lowpass', 0.5); burst(0.8, 2, 3000, 'highpass', 0.15); },
      shift() { eng.shiftT = ac.currentTime; burst(0.05, 2, 1500, 'bandpass', 0.12); },
    };

    // ---------- ambience
    const city = { n: noise(bb), lp: filt('lowpass', 260, 0.5), g: gain(0.0, amb) }; city.n.connect(city.lp); city.lp.connect(city.g);
    const cityHi = { n: noise(), bp: filt('bandpass', 1200, 0.4), g: gain(0, amb) }; cityHi.n.connect(cityHi.bp); cityHi.bp.connect(cityHi.g);
    // lake water (positional) + birds
    const lakeP = panner(amb); const water = { n: noise(), lp: filt('lowpass', 700, 0.6), g: gain(0, lakeP) }; water.n.connect(water.lp); water.lp.connect(water.g);
    const waterLfo = ac.createOscillator(); waterLfo.frequency.value = 0.13; const wl = gain(0.02, water.g.gain); waterLfo.connect(wl); waterLfo.start();
    const birdP = panner(amb);
    function chirp(x, y, z) {
      setPos(birdP, x, y, z);
      const t = ac.currentTime, n = 2 + (Math.random() * 4 | 0), f = 2600 + Math.random() * 2400;
      for (let i = 0; i < n; i++) { const o = ac.createOscillator(), g = gain(0, birdP), t0 = t + i * (0.09 + Math.random() * 0.06); o.type = 'sine'; o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * (0.7 + Math.random() * 0.8), t0 + 0.07); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.18, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08); o.connect(g); o.start(t0); o.stop(t0 + 0.1); }
    }
    // sirens
    const sirenP = panner(amb); sirenP.refDistance = 60; sirenP.maxDistance = 2000;
    let siren = null;
    function startSiren(x, z, dx, dz) {
      const t = ac.currentTime, o = ac.createOscillator(), lfo = ac.createOscillator(), lg = gain(330), g = gain(0, sirenP), lp = filt('lowpass', 2200, 0.7, g);
      o.type = 'triangle'; o.frequency.value = 950; lfo.frequency.value = Math.random() < 0.5 ? 0.22 : 2.6; lfo.connect(lg); lg.connect(o.frequency); o.connect(lp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.35, t + 1.5); g.gain.setValueAtTime(0.35, t + 9); g.gain.linearRampToValueAtTime(0, t + 12);
      o.start(t); lfo.start(t); o.stop(t + 12.2); lfo.stop(t + 12.2);
      siren = { x, z, dx, dz, end: t + 12 };
    }
    // block party (East Bay Dragons): original procedural beat + bass, crowd chatter, idling cruisers
    const partyP = panner(amb); partyP.refDistance = 14; partyP.maxDistance = 400;
    const party = { g: gain(0, partyP), on: false, next: 0, step: 0, bpm: 92 };
    const chat = { n: noise(), b1: filt('bandpass', 500, 3), b2: filt('bandpass', 1400, 4), g: gain(0.0, party.g) };
    chat.n.connect(chat.b1); chat.n.connect(chat.b2); chat.b1.connect(chat.g); chat.b2.connect(chat.g);
    const idle = { o: ac.createOscillator(), lp: filt('lowpass', 180, 2), g: gain(0.0, party.g), am: ac.createOscillator(), amg: gain(0.12) };
    idle.o.type = 'sawtooth'; idle.o.frequency.value = 21; idle.am.frequency.value = 5.3; idle.am.connect(idle.amg); idle.amg.connect(idle.g.gain); idle.o.connect(idle.lp); idle.lp.connect(idle.g); idle.o.start(); idle.am.start();
    const KICK = [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0], SNARE = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1], HAT = [1,0,1,0, 1,0,1,1, 1,0,1,0, 1,0,1,0];
    const BASS = [41,0,0,41, 0,0,44,0, 39,0,0,39, 0,0,36,0]; // MIDI notes, original line
    function schedParty(until) {
      const spb = 60 / party.bpm / 4;
      while (party.next < until) {
        const t = party.next, s = party.step % 16, out = party.g;
        if (KICK[s]) { const o = ac.createOscillator(), g = gain(0, out); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); o.start(t); o.stop(t + 0.32); }
        if (SNARE[s]) { const src = ac.createBufferSource(); src.buffer = nb; const f = filt('highpass', 1500), g = gain(0, out); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); src.connect(f); f.connect(g); src.start(t, Math.random()); src.stop(t + 0.18); }
        if (HAT[s]) { const src = ac.createBufferSource(); src.buffer = nb; const f = filt('highpass', 7000), g = gain(0, out); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); src.connect(f); f.connect(g); src.start(t, Math.random()); src.stop(t + 0.05); }
        if (BASS[s]) { const o = ac.createOscillator(), lp = filt('lowpass', 420, 4), g = gain(0, out); o.type = 'sawtooth'; o.frequency.value = 440 * Math.pow(2, (BASS[s] - 69) / 12); g.gain.setValueAtTime(0.32, t); g.gain.setTargetAtTime(0, t + spb * 1.6, 0.06); o.connect(lp); lp.connect(g); o.start(t); o.stop(t + spb * 3); }
        party.next += spb; party.step++;
      }
    }
    // taco truck: sizzle + generator (one voice that follows the nearest truck)
    const truckP = panner(amb); truckP.refDistance = 5; truckP.maxDistance = 120;
    const sizzle = { n: noise(), hp: filt('highpass', 3500, 0.7), g: gain(0, truckP) }; sizzle.n.connect(sizzle.hp); sizzle.hp.connect(sizzle.g);
    const crackle = { t: 0 };
    const gen = { o: ac.createOscillator(), lp: filt('lowpass', 240, 3), g: gain(0, truckP) }; gen.o.type = 'sawtooth'; gen.o.frequency.value = 60; gen.o.connect(gen.lp); gen.lp.connect(gen.g); gen.o.start();

    // ---------- per-frame update (cheap: parameter ramps only; ambience voices are gated by distance)
    let last = { gear: 1, air: false, th: 0, state: '' }, birdT = 3, sirenT = 25 + Math.random() * 40;
    function update(st) {
      const t = ac.currentTime, S = st.S, dt = st.dt || 0.016;
      const L = ac.listener, cam = st.camera;
      if (cam) {
        const p = cam.position, f = st.camFwd;
        if (L.positionX) { L.positionX.value = p.x; L.positionY.value = p.y; L.positionZ.value = p.z; L.forwardX.value = f.x; L.forwardY.value = f.y; L.forwardZ.value = f.z; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0; }
        else { L.setPosition(p.x, p.y, p.z); L.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
      }
      const live = !S.paused && S.state !== 'menu';
      // engine
      setProfile(S.mode); const P = eng.prof;
      const shifting = eng.shiftT && t - eng.shiftT < 0.12;
      let r = live ? (S.state === 'ride' ? st.rpm : 0.08) : 0;
      if (shifting) r *= 0.75;
      const rpm = P.idle + r * (P.red - P.idle), fire = rpm / 60 * P.fire, wob = 1 + (Math.random() - 0.5) * 0.012;
      eng.o1.frequency.setTargetAtTime(fire * wob, t, 0.03);
      eng.o2.frequency.setTargetAtTime(P.twin ? fire * (1 + P.twin / 100) : fire, t, 0.03);
      eng.o3.frequency.setTargetAtTime(fire * 0.5, t, 0.03);
      eng.lp.frequency.setTargetAtTime(P.bright + r * P.bright * 3 + S.thr * 900, t, 0.05);
      eng.nb.frequency.setTargetAtTime(1200 + r * 3000, t, 0.05);
      eng.ng.gain.setTargetAtTime(live && !st.electric ? P.rasp * (0.04 + S.thr * 0.12) : 0, t, 0.05);
      let eg = live ? (S.state === 'ride' ? (0.13 + S.thr * 0.12) * P.vol : 0.05) : 0;
      if (st.limiter && S.thr > 0.8) { eng.limT += dt; if ((eng.limT * 22 | 0) % 2) eg *= 0.25; } else eng.limT = 0; // rev-limiter stutter
      if (shifting) eg *= 0.35;
      if (st.electric) eg *= 0.12;  // Ultra Bee is electric: only a faint motor whine
      eng.out.gain.setTargetAtTime(eg, t, 0.02);
      if (S.gear !== last.gear && S.state === 'ride' && S.mode !== 'car') fx.shift(); last.gear = S.gear;
      // landings: front wheel slam after a wheelie, or touching down after air
      const air = S.y > S.gy + 0.15;
      if (last.air && !air && S.state === 'ride') fx.land(clamp(Math.abs(S.vy || 0) / 4, 0.4, 1.2));
      if (last.th > 0.35 && S.th < 0.06 && S.state === 'ride') fx.land(clamp(last.th, 0.4, 1));
      last.air = air; last.th = S.th;
      if (S.state === 'crash' && last.state !== 'crash') (st.crashType === 'water' ? fx.splash : fx.crash)();
      last.state = S.state;
      // tyres + wind
      const sp = Math.abs(S.v), slip = Math.abs(S.vr || 0), brake = st.brake && sp > 6 ? 1 : 0;
      const sk = live && !air ? clamp((slip - 1.2) / 5, 0, 1) + brake * clamp((sp - 6) / 15, 0, 0.7) : 0;
      skid.g.gain.setTargetAtTime(sk * 0.22, t, 0.05);
      wind.lp.frequency.setTargetAtTime(300 + sp * 40, t, 0.1);
      wind.g.gain.setTargetAtTime(live ? clamp(sp * sp / 1600, 0, 0.5) : 0, t, 0.15);
      // city hum: louder on streets, quieter by the lake
      const dl = Math.hypot(S.x - st.lake[0], S.z - st.lake[1]);
      const cityK = clamp((dl - 350) / 600, 0.25, 1);
      city.g.gain.setTargetAtTime(0.32 * cityK, t, 0.5); cityHi.g.gain.setTargetAtTime(0.035 * cityK, t, 0.5);
      // lake water + birds
      const nearLake = dl < 900;
      if (nearLake) { const k = Math.max(1, dl - 300) / dl; setPos(lakeP, S.x + (st.lake[0] - S.x) * (1 - k), 1, S.z + (st.lake[1] - S.z) * (1 - k)); }
      water.g.gain.setTargetAtTime(nearLake ? 0.09 : 0, t, 0.6);
      if (nearLake && (birdT -= dt) < 0) { birdT = 1.5 + Math.random() * 5; const a = Math.random() * 6.28, r2 = 15 + Math.random() * 40; chirp(S.x + Math.cos(a) * r2, 6 + Math.random() * 8, S.z + Math.sin(a) * r2); }
      // sirens every ~1-2 min, passing somewhere 250-600 m away
      if (!siren && (sirenT -= dt) < 0) { sirenT = 60 + Math.random() * 70; const a = Math.random() * 6.28, d = 250 + Math.random() * 350, h = a + 1.57; startSiren(S.x + Math.cos(a) * d, S.z + Math.sin(a) * d, Math.cos(h) * 18, Math.sin(h) * 18); }
      if (siren) { siren.x += siren.dx * dt; siren.z += siren.dz * dt; setPos(sirenP, siren.x, 3, siren.z); if (t > siren.end + 0.3) siren = null; }
      // block party: only runs within 300 m
      const P2 = st.party;
      if (P2) {
        const d = Math.hypot(S.x - P2.x, S.z - P2.z), on = d < 300;
        if (on && !party.on) { party.next = t + 0.05; party.step = 0; }
        party.on = on; setPos(partyP, P2.x, 1.5, P2.z);
        party.g.gain.setTargetAtTime(on ? 0.6 : 0, t, 0.4);
        if (on) { schedParty(t + 0.2); chat.g.gain.setTargetAtTime(0.05 + 0.04 * Math.sin(t * 1.7) * Math.sin(t * 0.63), t, 0.2); idle.g.gain.setTargetAtTime(0.18, t, 0.3); }
        else { chat.g.gain.setTargetAtTime(0, t, 0.3); idle.g.gain.setTargetAtTime(0, t, 0.3); }
      }
      // taco trucks: nearest within 80 m
      let tb = null, td = 80; for (const q of st.trucks || []) { const d = Math.hypot(S.x - q.x, S.z - q.z); if (d < td) { td = d; tb = q; } }
      if (tb) { setPos(truckP, tb.x, 1.2, tb.z); if ((crackle.t -= dt) < 0) { crackle.t = 0.03 + Math.random() * 0.15; sizzle.g.gain.setTargetAtTime(0.05 + Math.random() * 0.12, t, 0.01); } gen.g.gain.setTargetAtTime(0.06, t, 0.3); }
      else { sizzle.g.gain.setTargetAtTime(0, t, 0.2); gen.g.gain.setTargetAtTime(0, t, 0.2); }
    }
    return {
      ac, fx, update, vol,
      setVol(k, v) { vol[k] = v; applyVol(); try { localStorage.setItem('rob-audio-vol', JSON.stringify(vol)); } catch (e) {} },
      resume() { if (ac.state !== 'running') ac.resume(); },
    };
  }
  window.ROB_AUDIO = { create };
})();
