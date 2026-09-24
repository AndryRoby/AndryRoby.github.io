// Kódovanie videa v prehliadači. Hlavná cesta: snímok po snímku na canvas, WebCodecs H.264 (+ AAC),
// MP4 poskladá mp4-muxer 5.2.2 (MIT, Vanilagy, vložený lokálne vo vendor/, licencia vedľa neho).
// Záloha pre prehliadače bez WebCodecs: MediaRecorder v reálnom čase (WebM, v Safari MP4).
// Nič sa neposiela na server; výsledok je Blob v pamäti karty.
import { Muxer, ArrayBufferTarget } from './vendor/mp4-muxer.mjs';
import { W, H, FPS, casy, nakresli, pcm } from './scena.mjs';

export const BITRATE = 4_000_000;
const SR = 48000;

// 1080x1920 pri 30 fps je 8160 makroblokov na snímok, teda úroveň 4.0 (0x28) stačí tesne;
// 4.2 (0x2a) je rezerva. High, Main, Baseline v tomto poradí.
export const KODEKY_H264 = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.64002a', 'avc1.4d002a', 'avc1.42e02a'];

export function podporaWebCodecs() {
  return typeof VideoEncoder === 'function' && typeof VideoFrame === 'function';
}

export async function vyberKodek() {
  if (!podporaWebCodecs()) return null;
  for (const codec of KODEKY_H264) {
    const cfg = { codec, width: W, height: H, bitrate: BITRATE, framerate: FPS, avc: { format: 'avc' } };
    try {
      const s = await VideoEncoder.isConfigSupported(cfg);
      if (s && s.supported) return cfg;
    } catch (e) { /* ďalší */ }
  }
  return null;
}

async function aacPodporovane() {
  if (typeof AudioEncoder !== 'function' || typeof AudioData !== 'function') return null;
  const cfg = { codec: 'mp4a.40.2', sampleRate: SR, numberOfChannels: 1, bitrate: 128000 };
  try {
    const s = await AudioEncoder.isConfigSupported(cfg);
    return s && s.supported ? cfg : null;
  } catch (e) {
    return null;
  }
}

const oddych = () => new Promise((r) => setTimeout(r, 0));

/**
 * MP4 cez WebCodecs. `stav` je stav scény, `canvas` 1080x1920. `pokrok(0..1)` volá priebežne,
 * `zrusene()` sa pýta, či používateľ nezrušil. `kredit` ide do nakresli() (false = kópia pre TikTok).
 * Vráti { blob, zvuk: bool, typ: 'video/mp4', kredit }.
 */
export async function vyrobMp4({ canvas, stav, zvuk = true, kredit = true, pokrok = () => {}, zrusene = () => false }) {
  const video = await vyberKodek();
  if (!video) throw new Error('webcodecs_h264_nie');
  const audio = zvuk ? await aacPodporovane() : null;
  const ctx = canvas.getContext('2d', { alpha: false });
  const c = casy(stav.sek);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: W, height: H, frameRate: FPS },
    ...(audio ? { audio: { codec: 'aac', sampleRate: SR, numberOfChannels: 1 } } : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  let chyba = null;
  const venc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: (e) => { chyba = e; } });
  venc.configure(video);

  if (audio) {
    const aenc = new AudioEncoder({ output: (ch, meta) => muxer.addAudioChunk(ch, meta), error: (e) => { chyba = e; } });
    aenc.configure(audio);
    const data = pcm(stav.sek, SR);
    const KUS = 4800;
    for (let i = 0; i < data.length; i += KUS) {
      const kus = data.subarray(i, Math.min(data.length, i + KUS));
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: kus.length, numberOfChannels: 1, timestamp: Math.round((i / SR) * 1e6), data: kus });
      aenc.encode(ad);
      ad.close();
    }
    await aenc.flush();
    aenc.close();
  }

  const trvanie = Math.round(1e6 / FPS);
  for (let f = 0; f < c.snimkov; f++) {
    if (zrusene()) { try { venc.close(); } catch (e) { /* už zatvorené */ } throw new Error('zrusene'); }
    if (chyba) throw chyba;
    nakresli(ctx, f / FPS, stav, { kredit });
    const snimok = new VideoFrame(canvas, { timestamp: f * trvanie, duration: trvanie });
    venc.encode(snimok, { keyFrame: f % (FPS * 2) === 0 });
    snimok.close();
    while (venc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
    if (f % 10 === 0) { pokrok(f / c.snimkov); await oddych(); }
  }
  await venc.flush();
  venc.close();
  if (chyba) throw chyba;
  muxer.finalize();
  pokrok(1);
  return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), zvuk: !!audio, typ: 'video/mp4', pripona: 'mp4', kredit };
}

export const ZALOZNE_TYPY = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

export function zaloznyTyp() {
  if (typeof MediaRecorder !== 'function' || typeof MediaRecorder.isTypeSupported !== 'function') return null;
  return ZALOZNE_TYPY.find((t) => MediaRecorder.isTypeSupported(t)) || null;
}

/**
 * Záloha: nahrávanie canvasu v reálnom čase cez MediaRecorder. Trvá toľko, koľko video.
 * Karta musí ostať viditeľná, inak prehliadač spomalí časovače a video by trhalo.
 */
export async function vyrobZaloznou({ canvas, stav, zvuk = true, kredit = true, pokrok = () => {}, zrusene = () => false }) {
  const typ = zaloznyTyp();
  if (!typ || typeof canvas.captureStream !== 'function') throw new Error('mediarecorder_nie');
  const ctx = canvas.getContext('2d', { alpha: false });
  const c = casy(stav.sek);
  nakresli(ctx, 0, stav, { kredit });
  const stream = canvas.captureStream(FPS);

  let ac = null;
  if (zvuk && typeof AudioContext === 'function') {
    ac = new AudioContext({ sampleRate: SR });
    const data = pcm(stav.sek, SR);
    const buf = ac.createBuffer(1, data.length, SR);
    buf.copyToChannel(data, 0);
    const zdroj = ac.createBufferSource();
    zdroj.buffer = buf;
    const ciel = ac.createMediaStreamDestination();
    zdroj.connect(ciel);
    for (const tr of ciel.stream.getAudioTracks()) stream.addTrack(tr);
    await ac.resume();
    zdroj.start();
  }

  const kusy = [];
  const rec = new MediaRecorder(stream, { mimeType: typ, videoBitsPerSecond: BITRATE });
  rec.ondataavailable = (e) => { if (e.data && e.data.size) kusy.push(e.data); };
  const hotovo = new Promise((res, rej) => { rec.onstop = res; rec.onerror = (e) => rej(e.error || new Error('mediarecorder')); });
  rec.start(1000);
  const start = performance.now();
  await new Promise((res) => {
    const krok = () => {
      const t = (performance.now() - start) / 1000;
      if (zrusene() || t >= c.dlzka) return res();
      nakresli(ctx, t, stav, { kredit });
      pokrok(t / c.dlzka);
      requestAnimationFrame(krok);
    };
    requestAnimationFrame(krok);
  });
  rec.stop();
  await hotovo;
  for (const tr of stream.getTracks()) tr.stop();
  if (ac) await ac.close();
  if (zrusene()) throw new Error('zrusene');
  pokrok(1);
  const cistyTyp = typ.split(';')[0];
  return { blob: new Blob(kusy, { type: cistyTyp }), zvuk: !!ac, typ: cistyTyp, pripona: cistyTyp === 'video/mp4' ? 'mp4' : 'webm', kredit };
}
