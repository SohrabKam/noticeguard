// Photo evidence integrity — deterministic checks on site photos.
// No external deps: manual EXIF parser + content hash for duplicates.

export interface PhotoIntegrity {
  hasGps: boolean
  hasTimestamp: boolean
  isDuplicate: boolean
  warnings: string[]
  status: "green" | "amber"
}

/** Computes a content hash for duplicate detection. */
export function contentHash(buffer: Buffer): string {
  let hash = 0
  for (let i = 0; i < Math.min(4096, buffer.length); i++) {
    hash = ((hash << 5) - hash + buffer[i]) | 0
  }
  return `${(hash >>> 0).toString(16)}-${buffer.length}`
}

/** Check if two hashes are similar enough to be duplicates. */
export function isDuplicate(a: string, b: string): boolean {
  return a === b
}

/** Extract EXIF GPS + timestamp from a JPEG buffer (minimal parser, no deps). */
export function extractExifMeta(buffer: Buffer): { gpsLat: number | null; gpsLon: number | null; dateTime: string | null } {
  const r = { gpsLat: null as number | null, gpsLon: null as number | null, dateTime: null as string | null }
  try {
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return r
    let off = 2
    while (off < buffer.length - 4) {
      if (buffer[off] !== 0xff) break
      const m = buffer[off + 1]
      if (m === 0xda) break
      const len = (buffer[off + 2] << 8) | buffer[off + 3]
      if (m === 0xe1 && len > 10) {
        const s = off + 4
        if (buffer.toString("ascii", s, s + 6) !== "Exif\0\0") break
        const be = buffer[s + 6] === 0x4d
        const r16 = (p: number) => be ? (buffer[p] << 8) | buffer[p + 1] : buffer[p] | (buffer[p + 1] << 8)
        const r32 = (p: number) => be ? (buffer[p] << 24) | (buffer[p + 1] << 16) | (buffer[p + 2] << 8) | buffer[p + 3] : buffer[p] | (buffer[p + 1] << 8) | (buffer[p + 2] << 16) | (buffer[p + 3] << 24)
        const ts = s + 6
        const ifd = ts + r32(ts + 4)
        const n = r16(ifd)
        for (let i = 0; i < Math.min(n, 60); i++) {
          const ep = ifd + 2 + i * 12
          const tag = r16(ep)
          if (tag === 0x9003) { // DateTimeOriginal
            const cnt = r32(ep + 4); const o = cnt > 4 ? ts + r32(ep + 8) : ep + 8
            r.dateTime = buffer.toString("ascii", o, o + Math.min(cnt, 19)).replace(/\0/g, "")
          }
          if (tag === 0x8825) { // GPS IFD pointer
            const gps = ts + r32(ep + 8); const gn = r16(gps)
            let lr = "", lor = ""; const lp: number[] = []; const lop: number[] = []
            for (let j = 0; j < Math.min(gn, 12); j++) {
              const gp = gps + 2 + j * 12; const gt = r16(gp)
              if (gt === 1) lr = buffer.toString("ascii", gp + 8, gp + 10).replace(/\0/g, "")
              if (gt === 2) { const o = ts + r32(gp + 8); for (let k = 0; k < r32(gp + 4); k++) { lp.push(r32(o + k * 8) / r32(o + k * 8 + 4)) } }
              if (gt === 3) lor = buffer.toString("ascii", gp + 8, gp + 10).replace(/\0/g, "")
              if (gt === 4) { const o = ts + r32(gp + 8); for (let k = 0; k < r32(gp + 4); k++) { lop.push(r32(o + k * 8) / r32(o + k * 8 + 4)) } }
            }
            if (lp.length >= 2) r.gpsLat = (lp[0] + (lp[1] ?? 0) / 60) * (lr === "S" ? -1 : 1)
            if (lop.length >= 2) r.gpsLon = (lop[0] + (lop[1] ?? 0) / 60) * (lor === "W" ? -1 : 1)
          }
        }
      }
      off += 2 + len
    }
  } catch {}
  return r
}

/** Full integrity check on a photo buffer. */
export function checkPhotoIntegrity(buffer: Buffer, existingHashes: string[]): PhotoIntegrity {
  const meta = extractExifMeta(buffer)
  const hash = contentHash(buffer)
  const dup = existingHashes.some((h) => isDuplicate(hash, h))
  const warnings: string[] = []
  if (!meta.gpsLat) warnings.push("No GPS location")
  if (!meta.dateTime) warnings.push("No capture timestamp")
  if (dup) warnings.push("Duplicate photo detected")
  return {
    hasGps: !!(meta.gpsLat && meta.gpsLon),
    hasTimestamp: !!meta.dateTime,
    isDuplicate: dup,
    warnings,
    status: warnings.length > 0 ? "amber" : "green",
  }
}