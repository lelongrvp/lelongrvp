import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const login = process.argv[2]
const token = process.env.GITHUB_TOKEN
const snakePath = join(root, 'dist', 'snake.svg')
const statsPath = join(root, 'dist', 'stats.svg')

const color = {
  background: '#1d2021',
  surface: '#282828',
  elevated: '#3c3836',
  text: '#ebdbb2',
  textSecondary: '#d5c4a1',
  accent: '#fe8019',
}

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection { contributionCalendar { totalContributions } }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false) {
      totalCount
      nodes { languages(first: 5, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name } } } }
    }
  }
}`

async function fetchProfile() {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login } }),
  })
  const payload = await response.json()
  if (!response.ok || payload.errors) {
    throw new Error(`GraphQL request failed: ${JSON.stringify(payload.errors ?? response.status)}`)
  }
  return payload.data.user
}

function topLanguages(repositories, count) {
  const sizeByLanguage = new Map()
  for (const repository of repositories.nodes) {
    for (const edge of repository.languages.edges) {
      sizeByLanguage.set(edge.node.name, (sizeByLanguage.get(edge.node.name) ?? 0) + edge.size)
    }
  }
  const total = [...sizeByLanguage.values()].reduce((sum, size) => sum + size, 0)
  return [...sizeByLanguage.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, count)
    .map(([name, size]) => ({ name, share: total === 0 ? 0 : size / total }))
}

function loadFontFaces() {
  const encode = (fileName) => readFileSync(join(root, 'scripts', 'fonts', fileName)).toString('base64')
  return `@font-face{font-family:'JetBrains Mono';font-weight:400;src:url(data:font/woff2;base64,${encode('JetBrainsMono-Regular.woff2')}) format('woff2')}@font-face{font-family:'JetBrains Mono';font-weight:700;src:url(data:font/woff2;base64,${encode('JetBrainsMono-Bold.woff2')}) format('woff2')}`
}

function escapeXml(raw) {
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildStatsCard({ publicRepositories, contributions, languages }) {
  const width = 600
  const height = 252
  const barLeft = 170
  const barMaxWidth = 330
  const languageRows = languages.map((language, index) => {
    const y = 184 + index * 24
    const percentage = Math.round(language.share * 100)
    const barWidth = Math.max(4, Math.round(barMaxWidth * language.share))
    return `<text class="small secondary" x="24" y="${y}">${escapeXml(language.name)}</text>
<rect x="${barLeft}" y="${y - 11}" width="${barMaxWidth}" height="10" fill="${color.elevated}"/>
<rect x="${barLeft}" y="${y - 11}" width="${barWidth}" height="10" fill="${color.accent}"/>
<text class="small" x="576" y="${y}" text-anchor="end">${percentage}%</text>`
  })
  const description = `Activity. ${publicRepositories} public repositories, ${contributions} contributions in the last 12 months. Top languages: ${languages.map((language) => `${language.name} ${Math.round(language.share * 100)} percent`).join(', ')}.`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
<title id="title">Activity</title>
<desc id="description">${escapeXml(description)}</desc>
<style>
${loadFontFaces()}
text{font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:${color.text}}
.label{font-size:14px;font-weight:700;letter-spacing:2px;fill:${color.accent}}
.key{font-size:14px;font-weight:700;letter-spacing:2px;fill:${color.textSecondary}}
.small{font-size:15px}
.secondary{fill:${color.textSecondary}}
.figure{font-size:34px;font-weight:700;fill:${color.accent}}
</style>
<defs><pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${color.background}" opacity=".35"/></pattern></defs>
<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" fill="${color.surface}" stroke="${color.elevated}"/>
<rect x=".5" y=".5" width="${width - 1}" height="40" fill="${color.elevated}"/>
<rect width="4" height="${height}" fill="${color.accent}"/>
<text class="label" x="22" y="26">SECTOR 04 :: ACTIVITY</text>
<text class="key" x="576" y="26" text-anchor="end">LIVE FEED</text>
<text class="key" x="24" y="76">PUBLIC REPOS</text>
<text class="figure" x="24" y="116">${publicRepositories}</text>
<text class="key" x="250" y="76">CONTRIBUTIONS · 12 MO</text>
<text class="figure" x="250" y="116">${contributions}</text>
<text class="key" x="24" y="154">LANGUAGES</text>
${languageRows.join('\n')}
<rect width="${width}" height="${height}" fill="url(#scanlines)"/>
</svg>
`
}

function frameSnake(snakeMarkup) {
  const rootTag = snakeMarkup.match(/<svg[^>]*>/)[0]
  const viewBox = rootTag.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number)
  const [minX, minY, boxWidth, boxHeight] = viewBox
  const background = `<rect x="${minX}" y="${minY}" width="${boxWidth}" height="${boxHeight}" fill="${color.background}"/>`
  return snakeMarkup.replace(rootTag, `${rootTag}${background}`)
}

const user = await fetchProfile()
writeFileSync(
  statsPath,
  buildStatsCard({
    publicRepositories: user.repositories.totalCount,
    contributions: user.contributionsCollection.contributionCalendar.totalContributions,
    languages: topLanguages(user.repositories, 3),
  }),
)

try {
  writeFileSync(snakePath, frameSnake(readFileSync(snakePath, 'utf8')))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
