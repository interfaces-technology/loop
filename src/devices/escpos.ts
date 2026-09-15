const encoder = new TextEncoder();

export const ESC = 0x1b;
export const GS = 0x1d;

function command(bytes: number[]): Uint8Array {
  return Uint8Array.from(bytes);
}

export function escposInit(): Uint8Array {
  return command([ESC, 0x40]);
}

export function escposFeed(lines: number): Uint8Array {
  return command([ESC, 0x64, Math.max(0, Math.min(255, lines))]);
}

export function escposCut(mode: "full" | "partial" = "full"): Uint8Array {
  return command([GS, 0x56, mode === "full" ? 0x42 : 0x41, 0x00]);
}

export function escposText(text: string): Uint8Array {
  const bytes = encoder.encode(text);
  const out = new Uint8Array(bytes.length + 1);
  out.set(bytes);
  out[bytes.length] = 0x0a;
  return out;
}

export function encodeReceipt(lines: readonly string[], opts: { feed?: number } = {}): Uint8Array {
  const { feed = 2 } = opts;
  const parts: Uint8Array[] = [escposInit()];
  for (const line of lines) parts.push(escposText(line));
  parts.push(escposFeed(feed));
  parts.push(escposCut());

  let total = 0;
  for (const part of parts) total += part.length;

  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}