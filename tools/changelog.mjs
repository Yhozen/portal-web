#!/usr/bin/env node
// Builds the GitHub Pages changelog (HTML + SVG badges) from docs/changelog-data.json.
// Videos stay on GitHub releases; the pages only link and embed them.
//
//   node tools/changelog.mjs --out changelog-site

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const data = JSON.parse(readFileSync(join(root, 'docs/changelog-data.json'), 'utf8'))

const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const outDir = resolve(root, outIdx >= 0 ? args[outIdx + 1] : 'changelog-site')

const releaseUrl = (tag, file) =>
  `https://github.com/${data.repo}/releases/download/${tag}/${file}`
const releasePage = (tag) =>
  `https://github.com/${data.repo}/releases/tag/${tag}`
const commitUrl = (sha) =>
  `https://github.com/${data.repo}/commit/${sha}`

function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function badge(label, value, ok) {
  const left = 8
  const lw = label.length * 7 + 16
  const vw = String(value).length * 7 + 16
  const color = ok ? '#4c1' : '#dfb317'
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${lw + vw}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}">
  <title>${esc(label)}: ${esc(value)}</title>
  <rect width="${lw}" height="20" fill="#555"/>
  <rect x="${lw}" width="${vw}" height="20" fill="${color}"/>
  <rect width="${lw + vw}" height="20" fill="url(#s)"/>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${lw / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(label)}</text>
    <text x="${lw / 2}" y="14">${esc(label)}</text>
    <text x="${lw + vw / 2}" y="15" fill="#010101" fill-opacity=".3">${esc(value)}</text>
    <text x="${lw + vw / 2}" y="14">${esc(value)}</text>
  </g>
</svg>
`
}

function playTable(rows) {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${esc(r.map)}</td><td>${esc(r.time)}</td><td>${esc(r.next)}</td></tr>`,
    )
    .join('\n')
  return `<table>
  <thead><tr><th>Map</th><th>Time (s)</th><th>Next</th></tr></thead>
  <tbody>
${body}
  </tbody>
</table>`
}

function videoBlock(session, v) {
  const src = releaseUrl(session.tag, v.file)
  return `<figure class="clip" id="${esc(session.id)}-${esc(v.role === 'reel' ? 'reel' : v.file.replace(/\.mp4$/, ''))}">
  <figcaption><strong>${esc(v.title)}</strong> · ${esc(v.seconds)} s · recorded ${esc(v.recorded)} · from <a href="${commitUrl(v.commit)}"><code>${esc(v.commitShort)}</code></a></figcaption>
  <video src="${esc(src)}" controls playsinline preload="metadata"></video>
  <p>${esc(v.caption)} <a href="${esc(src)}">Download</a>.</p>
</figure>`
}

function sessionSection(s) {
  const videos = s.videos.map((v) => videoBlock(s, v)).join('\n')
  const landed = s.landed.map((x) => `<li>${esc(x)}</li>`).join('\n')
  const remains = s.remains.map((x) => `<li>${esc(x)}</li>`).join('\n')
  const commits = s.commitsSincePrev
    ? `<p>${esc(String(s.commitsSincePrev))} commits since the previous session, on <code>${esc(s.branch)}</code> at <a href="${commitUrl(s.tip)}"><code>${esc(s.tipShort)}</code></a>. Checks ${esc(s.checks)}.</p>`
    : `<p>On <code>${esc(s.branch)}</code> at <a href="${commitUrl(s.tip)}"><code>${esc(s.tipShort)}</code></a>. Checks ${esc(s.checks)}.</p>`
  const regression = s.regression
    ? `<p>${esc(s.regression)}</p>`
    : ''
  const reel = s.videos.find((v) => v.role === 'reel')
  const reelLine = reel
    ? `<p>Reel: <a href="#${esc(s.id)}-reel">${esc(reel.title)}</a> (${esc(reel.seconds)} s). The files live in the <a href="${releasePage(s.tag)}">${esc(s.tag)} release</a>, not in the tree.</p>`
    : ''
  return `<section id="${esc(s.id)}">
  <h2>${esc(s.title)} <span class="date">${esc(s.dateLabel)}</span></h2>
  <p class="meta">From ${esc(s.started)} through ${esc(s.ended)}.</p>
  <p>${esc(s.lede)}</p>
  ${commits}
  ${reelLine}
  ${videos}
  <h3>What landed</h3>
  <ul>
${landed}
  </ul>
  ${regression}
  <h3>Playthrough</h3>
  <p>${esc(s.playthroughNote)}</p>
  ${playTable(s.playthrough)}
  <h3>Still ahead</h3>
  <ul>
${remains}
  </ul>
</section>`
}

const latest = data.sessions[0]
const nav = data.sessions
  .map((s) => `<a href="#${esc(s.id)}">${esc(s.title)}</a>`)
  .join(' · ')

const html = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>portal-web changelog</title>
<style>
  :root { color-scheme: dark; }
  body { font: 16px/1.55 system-ui, sans-serif; background: #111; color: #ddd; max-width: 980px; margin: 2em auto; padding: 0 1.2em 4em; }
  a { color: #8cf; }
  h1 { font-weight: 650; letter-spacing: -0.02em; margin-bottom: 0.3em; }
  h2 { font-weight: 650; margin-top: 2.2em; padding-top: 0.4em; border-top: 1px solid #333; }
  h3 { font-weight: 600; margin-top: 1.4em; }
  .date { color: #9aa; font-weight: 500; font-size: 0.85em; }
  .meta, .lead { color: #bbb; }
  header p { color: #bbb; }
  nav { margin: 1em 0 2em; }
  video { width: 100%; background: #000; border-radius: 4px; margin: 0.4em 0; }
  figure.clip { margin: 1.4em 0; }
  figcaption { color: #ccc; margin-bottom: 0.3em; }
  table { border-collapse: collapse; width: 100%; margin: 0.6em 0 1.2em; font-variant-numeric: tabular-nums; }
  th, td { text-align: left; padding: 0.35em 0.6em; border-bottom: 1px solid #2a2a2a; }
  th { color: #aaa; font-weight: 600; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.9em; }
  ul { padding-left: 1.2em; }
  li { margin: 0.35em 0; }
  .badges img { vertical-align: middle; }
  footer { margin-top: 3em; color: #888; font-size: 0.9em; }
</style>
<header>
  <h1>portal-web</h1>
  <p class="lead">A clean-room, browser-based player for Portal (2007). This page is the dated changelog: what each oracle session landed, the scripted playthroughs, and the gameplay reels. The videos live on <a href="https://github.com/${esc(data.repo)}/releases">GitHub releases</a>, not in the source tree.</p>
  <p class="badges">
    <a href="#${esc(latest.id)}"><img src="badge-checks.svg" alt="checks ${esc(data.checks.pass)}/${esc(data.checks.total)}"></a>
    <a href="#${esc(latest.id)}"><img src="badge-maps.svg" alt="maps ${esc(data.maps.changelevel)}/${esc(data.maps.total)} changelevel"></a>
  </p>
  <nav>${nav}</nav>
</header>
<main>
${data.sessions.map(sessionSection).join('\n')}
</main>
<footer>
  <p>Source: <a href="https://github.com/${esc(data.repo)}">github.com/${esc(data.repo)}</a> · ${esc(data.maps.note)} Updated ${esc(data.updated)}.</p>
  <p>Portal and its assets are © Valve. The clips show the port playing from the owner's own install; no game files are in the repository.</p>
</footer>
`

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'index.html'), html)
writeFileSync(join(outDir, '.nojekyll'), '')
writeFileSync(
  join(outDir, 'badge-checks.svg'),
  badge('checks', `${data.checks.pass}/${data.checks.total}`, data.checks.pass === data.checks.total),
)
writeFileSync(
  join(outDir, 'badge-maps.svg'),
  badge('changelevel', `${data.maps.changelevel}/${data.maps.total}`, data.maps.changelevel === data.maps.total),
)
console.log(`wrote ${outDir}`)
