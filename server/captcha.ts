import crypto from 'node:crypto';

/**
 * Self-contained SVG captcha. Answers live only in server memory, expire after
 * five minutes and are single-use, so a solved captcha can't be replayed.
 */
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TTL_MS = 5 * 60 * 1000;
const store = new Map<string, { answer: string; expires: number }>();

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function sweep() {
  const now = Date.now();
  for (const [id, v] of store) if (v.expires < now) store.delete(id);
}

export function createCaptcha() {
  sweep();
  const answer = Array.from({ length: 5 }, () => CHARS[crypto.randomInt(CHARS.length)]).join('');
  const id = crypto.randomUUID();
  store.set(id, { answer, expires: Date.now() + TTL_MS });

  const w = 180;
  const h = 56;
  const palette = ['#F5F5F7', '#0A84FF', '#FF9F0A', '#64D2FF', '#BF5AF2'];
  let noise = '';
  for (let i = 0; i < 6; i++) {
    noise += `<path d="M${rand(0, w)} ${rand(0, h)} Q${rand(0, w)} ${rand(0, h)} ${rand(0, w)} ${rand(0, h)}" stroke="${palette[i % palette.length]}" stroke-opacity="0.45" stroke-width="${rand(1, 2).toFixed(1)}" fill="none"/>`;
  }
  for (let i = 0; i < 40; i++) {
    noise += `<circle cx="${rand(0, w).toFixed(1)}" cy="${rand(0, h).toFixed(1)}" r="${rand(0.5, 1.6).toFixed(1)}" fill="#98989F" fill-opacity="0.5"/>`;
  }
  const glyphs = answer
    .split('')
    .map((ch, i) => {
      const x = 22 + i * 32 + rand(-3, 3);
      const y = 38 + rand(-5, 5);
      const rot = rand(-22, 22).toFixed(1);
      const color = palette[crypto.randomInt(palette.length)];
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" font-family="monospace" font-size="${rand(26, 32).toFixed(0)}" font-weight="700" fill="${color}">${ch}</text>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#2C2C2E"/>${noise}${glyphs}</svg>`;
  return { id, svg: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` };
}

export function verifyCaptcha(id: unknown, input: unknown) {
  if (typeof id !== 'string' || typeof input !== 'string') return false;
  const entry = store.get(id);
  store.delete(id);
  if (!entry || entry.expires < Date.now()) return false;
  return entry.answer === input.trim().toUpperCase();
}

/** In-process only (used by the API smoke test); never exposed over HTTP. */
export const peekCaptcha = (id: string) => store.get(id)?.answer;
