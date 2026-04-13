/**
 * Downloads anime poster images from AniList CDN URLs stored in the JSON batch
 * files and saves them as numbered JPGs in public/media/single/ for use with
 * the uncompressed single texture mode (VITE_EXPERIMENTAL_MEDIA_VERSION_3_ENABLED=1).
 *
 * Image naming: globalIndex.jpg where
 *   globalIndex = subgrid * BATCH_SIZE + subgridIndex
 *
 * Usage:
 *   bun run scripts/download-posters.mjs
 *   bun run scripts/download-posters.mjs --start=0 --end=24   # only first 25 batches
 *   bun run scripts/download-posters.mjs --concurrency=5
 */

import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'

const __dirname = dirname(fileURLToPath(import.meta.url))
const JSON_DIR = join(__dirname, '..', 'public', 'json')
const OUTPUT_DIR = join(__dirname, '..', 'public', 'media', 'single')

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.slice(2).split('=')
      return [k, v ?? true]
    }),
)

const CONCURRENCY = Number(args.concurrency ?? 8)
const START_BATCH = Number(args.start ?? 0)

// Determine available batch files
const batchFiles = readdirSync(JSON_DIR)
  .filter((f) => /^\d+\.json$/.test(f))
  .map((f) => Number(f.replace('.json', '')))
  .sort((a, b) => a - b)

const END_BATCH = Number(args.end ?? batchFiles[batchFiles.length - 1] ?? 0)

mkdirSync(OUTPUT_DIR, { recursive: true })

// Read batch size from first file
const firstBatch = JSON.parse(readFileSync(join(JSON_DIR, '0.json'), 'utf-8'))
const BATCH_SIZE = firstBatch.length

console.log(`Batch size: ${BATCH_SIZE}`)
console.log(`Processing batches ${START_BATCH}–${END_BATCH}`)
console.log(`Concurrency: ${CONCURRENCY}`)
console.log(`Output: ${OUTPUT_DIR}\n`)

// Build work queue: { globalIndex, url }
const queue = []
for (let b = START_BATCH; b <= END_BATCH; b++) {
  const batchPath = join(JSON_DIR, `${b}.json`)
  if (!existsSync(batchPath)) continue
  const batch = JSON.parse(readFileSync(batchPath, 'utf-8'))
  for (let i = 0; i < batch.length; i++) {
    const entry = batch[i]
    const url = entry.poster_path
    if (!url) continue
    const globalIndex = b * BATCH_SIZE + i
    queue.push({ globalIndex, url })
  }
}

console.log(`Total images to download: ${queue.length}`)

let done = 0
let skipped = 0
let failed = 0

async function downloadOne({ globalIndex, url }) {
  const dest = join(OUTPUT_DIR, `${globalIndex}.jpg`)
  if (existsSync(dest)) {
    skipped++
    return
  }
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await pipeline(res.body, createWriteStream(dest))
    done++
  } catch (err) {
    failed++
    // Write a 1x1 transparent placeholder so the index is not retried
    // on next run if the URL is permanently broken.
    // (comment out if you'd rather retry failed ones)
    // fs.writeFileSync(dest, Buffer.alloc(0))
  }
  if ((done + skipped + failed) % 100 === 0) {
    console.log(`  ${done} downloaded, ${skipped} skipped, ${failed} failed  (${queue.length - done - skipped - failed} remaining)`)
  }
}

// Process queue with limited concurrency
async function runQueue() {
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const item = queue.shift()
      if (item) await downloadOne(item)
    }
  })
  await Promise.all(workers)
}

await runQueue()
console.log(`\nDone. ${done} downloaded, ${skipped} already existed, ${failed} failed.`)
