import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target directory: apps/mobile/assets/sounds
let outDir = path.resolve(__dirname, "../apps/mobile/assets/sounds");
if (!fs.existsSync(path.resolve(__dirname, "../apps/mobile"))) {
  outDir = path.resolve(__dirname, "../assets/sounds");
}

fs.mkdirSync(outDir, { recursive: true });

function createWavBuffer(sampleRate, samples) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt sub-chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // PCM = 1
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write samples
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    buffer.writeInt16LE(Math.round(val), 44 + i * 2);
  }

  return buffer;
}

const sampleRate = 44100;

// 1. ok.wav: High single beep (1000 Hz, 120 ms)
{
  const durationMs = 120;
  const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
  const samples = new Float32Array(totalSamples);
  const freq = 1000;
  const attack = Math.floor((10 / 1000) * sampleRate);
  const decay = Math.floor((30 / 1000) * sampleRate);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (i < attack) env = i / attack;
    else if (i > totalSamples - decay) env = (totalSamples - i) / decay;
    samples[i] = Math.sin(2 * Math.PI * freq * t) * 0.7 * env;
  }

  const wav = createWavBuffer(sampleRate, samples);
  fs.writeFileSync(path.join(outDir, "ok.wav"), wav);
}

// 2. warn.wav: Double beep (600 Hz, 50ms beep + 30ms gap + 50ms beep = 130 ms)
{
  const durationMs = 130;
  const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
  const samples = new Float32Array(totalSamples);
  const freq = 600;
  const beepSamples = Math.floor((50 / 1000) * sampleRate);
  const gapSamples = Math.floor((30 / 1000) * sampleRate);

  for (let i = 0; i < totalSamples; i++) {
    let env = 0;
    if (i < beepSamples) {
      const a = Math.floor(beepSamples * 0.15);
      if (i < a) env = i / a;
      else if (i > beepSamples - a) env = (beepSamples - i) / a;
      else env = 1;
    } else if (i >= beepSamples + gapSamples && i < 2 * beepSamples + gapSamples) {
      const idx = i - (beepSamples + gapSamples);
      const a = Math.floor(beepSamples * 0.15);
      if (idx < a) env = idx / a;
      else if (idx > beepSamples - a) env = (beepSamples - idx) / a;
      else env = 1;
    }
    const t = i / sampleRate;
    samples[i] = Math.sin(2 * Math.PI * freq * t) * 0.7 * env;
  }

  const wav = createWavBuffer(sampleRate, samples);
  fs.writeFileSync(path.join(outDir, "warn.wav"), wav);
}

// 3. err.wav: Low buzz (160 Hz + harmonics, 180 ms)
{
  const durationMs = 180;
  const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
  const samples = new Float32Array(totalSamples);
  const attack = Math.floor((15 / 1000) * sampleRate);
  const decay = Math.floor((40 / 1000) * sampleRate);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    let env = 1;
    if (i < attack) env = i / attack;
    else if (i > totalSamples - decay) env = (totalSamples - i) / decay;

    // Rich low buzz with 1st, 2nd, 3rd harmonics
    const wave =
      0.6 * Math.sin(2 * Math.PI * 160 * t) +
      0.3 * Math.sin(2 * Math.PI * 320 * t) +
      0.15 * Math.sin(2 * Math.PI * 480 * t);
    samples[i] = wave * env * 0.8;
  }

  const wav = createWavBuffer(sampleRate, samples);
  fs.writeFileSync(path.join(outDir, "err.wav"), wav);
}

console.log("✓ Generated ok.wav, warn.wav, err.wav in " + outDir);
