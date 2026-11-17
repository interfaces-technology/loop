const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export function escposInit(): Uint8Array {
  return new Uint8Array([ESC, 0x40]);
}

export function escposText(text: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(text);
}

export function escposFeed(lines = 1): Uint8Array {
  const count = Math.max(0, Math.floor(lines));
  const bytes = new Uint8Array(count);
  bytes.fill(LF);
  return bytes;
}

export function escposCut(partial = false): Uint8Array {
  return new Uint8Array([GS, 0x56, partial ? 0x01 : 0x00]);
}

export function encodePrintJob(text: string, options?: { feed?: number; cut?: boolean }): Uint8Array {
  const feed = options?.feed ?? 3;
  const cut = options?.cut ?? true;
  const chunks = [escposInit(), escposText(text), escposFeed(feed)];
  if (cut) {
    chunks.push(escposCut());
  }
  return concatBytes(chunks);
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}
