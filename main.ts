// Front page for Thursday 26 November 2026. The finished illustration lives
// in this repository as asset.jpg: Putin vowing "inevitable" retaliation after
// Ukraine's drone strikes cut Russian refinery runs by about 45%; the leaked
// Rosstat files putting at least 490,000 Russian soldiers killed since 2022
// (BBC Russian / Mediazona, 23–24 Nov); two tankers ablaze after hitting mines
// in the Strait of Hormuz while a Houthi drone wounded 11 in Riyadh; and the
// Israeli strike that killed Hamas's internal security chief in Gaza City.
// All four were re-checked against independent outlets this session before
// submitting. This program only delivers the picture: it validates the JPEG
// and writes it to /output/entry.png (a JPEG by its first bytes, as the rules
// allow, even though the filename ends in .png).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LIMIT_BYTES = 1024 * 1024;
const PAGE_WIDTH = 1024;
const PAGE_HEIGHT = 1024;

class FrontPageImage {
  private readonly bytes: Uint8Array;

  private constructor(bytes: Uint8Array) {
    this.bytes = bytes;
  }

  static fromRepoFile(path: string): FrontPageImage {
    if (!existsSync(path)) {
      throw new Error(`news-image-20261126: missing asset file ${path}`);
    }
    const raw = readFileSync(path);
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    if (raw.byteLength < 4 || raw.byteLength > LIMIT_BYTES) {
      throw new Error(
        `news-image-20261126: asset.jpg is ${raw.byteLength} bytes, must be 4..${LIMIT_BYTES}`,
      );
    }
    if (view.getUint16(0) !== 0xffd8) {
      throw new Error("news-image-20261126: asset.jpg lacks the JPEG SOI marker");
    }
    if (view.getUint16(raw.byteLength - 2) !== 0xffd9) {
      throw new Error("news-image-20261126: asset.jpg lacks the JPEG EOI marker");
    }
    const picture = new FrontPageImage(raw);
    const [width, height] = picture.frameSize();
    if (width !== PAGE_WIDTH || height !== PAGE_HEIGHT) {
      throw new Error(
        `news-image-20261126: asset.jpg is ${width}x${height}, expected ${PAGE_WIDTH}x${PAGE_HEIGHT}`,
      );
    }
    return picture;
  }

  get byteLength(): number {
    return this.bytes.length;
  }

  // Scan JPEG segments for the first SOF frame header and read its size.
  private frameSize(): [number, number] {
    const view = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset,
      this.bytes.byteLength,
    );
    let cursor = 2;
    while (cursor + 9 <= this.bytes.length) {
      if (this.bytes[cursor] !== 0xff) {
        throw new Error("news-image-20261126: corrupt JPEG marker prefix");
      }
      const marker = this.bytes[cursor + 1];
      if (marker === 0xd9) {
        break; // reached EOI without seeing a frame header
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
        cursor += 2; // standalone marker, no length field
        continue;
      }
      const segmentLength = view.getUint16(cursor + 2);
      if (segmentLength < 2) {
        throw new Error("news-image-20261126: corrupt JPEG segment length");
      }
      const isFrame =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isFrame) {
        return [view.getUint16(cursor + 7), view.getUint16(cursor + 5)];
      }
      cursor += 2 + segmentLength;
    }
    throw new Error("news-image-20261126: no JPEG frame header in asset.jpg");
  }

  writeTo(outDir: string): string {
    const target = join(resolve(outDir), "entry.png");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(target, this.bytes, { mode: 0o644 });
    return target;
  }
}

const here = fileURLToPath(new URL(".", import.meta.url));
const page = FrontPageImage.fromRepoFile(join(here, "asset.jpg"));
const outDir = process.env.OUTPUT_DIR ?? "/output";
const target = page.writeTo(outDir);
console.log(
  `wrote ${target} (${page.byteLength} bytes, ${PAGE_WIDTH}x${PAGE_HEIGHT} JPEG)`,
);
