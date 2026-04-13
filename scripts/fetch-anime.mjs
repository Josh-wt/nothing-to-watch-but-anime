import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const JSON_DIR = join(__dirname, '..', 'public', 'json')

// Determine batch size from existing JSON files
function getBatchSize() {
  const files = readdirSync(JSON_DIR).filter((f) => f.endsWith('.json'))
  if (files.length === 0) {
    console.log('No existing JSON files found, using default batch size of 216')
    return 216
  }
  const first = JSON.parse(readFileSync(join(JSON_DIR, '0.json'), 'utf-8'))
  console.log(`Detected batch size: ${first.length}`)
  return first.length
}

const BATCH_SIZE = getBatchSize()
const ANILIST_API = 'https://graphql.anilist.co'

const QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      hasNextPage
      currentPage
    }
    media(type: ANIME, sort: POPULARITY_DESC) {
      id
      title {
        romaji
        english
      }
      coverImage {
        extraLarge
        large
      }
      genres
      averageScore
      episodes
      season
      seasonYear
      studios(isMain: true) {
        nodes {
          name
        }
      }
      format
      status
      description(asHtml: false)
      popularity
    }
  }
}
`

async function fetchPage(page) {
  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: QUERY,
      variables: { page, perPage: 50 },
    }),
  })

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const wait = (retryAfter ? parseInt(retryAfter, 10) : 60) * 1000
    console.log(`Rate limited, waiting ${wait / 1000}s...`)
    await new Promise((r) => setTimeout(r, wait))
    return fetchPage(page)
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }

  const json = await response.json()
  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`)
  }
  return json.data.Page
}

function transformEntry(entry) {
  return {
    id: entry.id,
    title: entry.title.romaji,
    tagline: entry.title.english ?? '',
    overview: entry.description ?? '',
    genres: (entry.genres ?? []).join(', '),
    release_year: entry.seasonYear ?? 0,
    vote_average: (entry.averageScore ?? 0) / 10,
    popularity: entry.popularity ?? 0,
    poster_path: entry.coverImage?.large ?? '',
    backdrop_path: entry.coverImage?.extraLarge ?? '',
    studio: entry.studios?.nodes?.[0]?.name ?? '',
    format: entry.format ?? '',
    season: entry.season ?? '',
    episodes: entry.episodes ?? null,
  }
}

// The Voroforce engine uses subgrids of 216 cells each. With ~20k anime entries
// that's ~93 subgrids (18 cols × 12 rows × 93 layers = 20,088 cells).
// Every subgrid index maps to a JSON batch file. Files that don't exist cause
// parse errors because the Vite dev server returns HTML instead of a 404.
// We must write all subgrid files — batches beyond the fetched data are empty arrays.
const TOTAL_SUBGRIDS = 93

async function main() {
  console.log('Fetching anime data from AniList...')
  const allEntries = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const result = await fetchPage(page)
    const entries = result.media
    allEntries.push(...entries.map(transformEntry))
    hasNextPage = result.pageInfo.hasNextPage
    console.log(
      `Page ${page}: fetched ${entries.length} entries (total: ${allEntries.length})`
    )
    page++

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 700))
  }

  console.log(`\nTotal entries fetched: ${allEntries.length}`)

  // Remove existing JSON files
  const existingFiles = readdirSync(JSON_DIR).filter((f) =>
    /^\d+\.json$/.test(f)
  )
  for (const f of existingFiles) {
    const path = join(JSON_DIR, f)
    writeFileSync(path, '') // clear before overwriting
  }

  // Split into batches and write all subgrid files.
  // Batches beyond the fetched data are written as empty arrays so the
  // engine can load them without hitting a 404 / HTML parse error.
  const totalBatches = Math.max(
    TOTAL_SUBGRIDS,
    Math.ceil(allEntries.length / BATCH_SIZE),
  )
  for (let i = 0; i < totalBatches; i++) {
    const batch = allEntries.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
    const filePath = join(JSON_DIR, `${i}.json`)
    writeFileSync(filePath, JSON.stringify(batch))
  }

  const populatedBatches = Math.ceil(allEntries.length / BATCH_SIZE)
  console.log(
    `\nDone! Wrote ${totalBatches} batch files to ${JSON_DIR} (${populatedBatches} with data, ${totalBatches - populatedBatches} empty)`,
  )
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
