// Builds src/app.jsx into app.js and stamps index.html with a new version so phones pick up the change.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

await build({ entryPoints:['src/app.jsx'], outfile:'app.js', bundle:false, minify:true, jsx:'transform', target:['es2018','safari13'] });
// the version covers the page's own look too, so a change to colours or layout alone also counts as an update
const page = readFileSync('index.html', 'utf8');
const v = createHash('sha1').update(readFileSync('app.js')).update(page.replace(/app\.js\?v=[\w]+/, '')).digest('hex').slice(0, 8);
const html = page.replace(/app\.js\?v=[\w]+/, `app.js?v=${v}`);
writeFileSync('index.html', html);
console.log(`app.js built (v=${v})`);
