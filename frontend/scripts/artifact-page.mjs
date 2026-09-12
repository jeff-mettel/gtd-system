// Turn Vite's dist/index.html into the body fragment the Artifact host expects (it supplies its own
// <html>/<head>/<body>), keeping the stylesheet and module-script tags. Writes dist/artifact.html.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const keep = [...head.matchAll(/<title>[\s\S]*?<\/title>|<link\b[^>]*>|<script\b[^>]*><\/script>/g)].map(m => m[0]).filter(t => !/rel="icon"/.test(t));
writeFileSync(new URL('../dist/artifact.html', import.meta.url), keep.join('\n') + '\n' + body.trim() + '\n');
console.log('dist/artifact.html written with', keep.length, 'head tags');
