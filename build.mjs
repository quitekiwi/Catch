// Builds src/app.jsx into app.js and stamps index.html with a new version so phones pick up the change.
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

await build({ entryPoints:['src/app.jsx'], outfile:'app.js', bundle:false, minify:true, jsx:'transform', target:['es2018','safari13'] });
const v = createHash('sha1').update(readFileSync('app.js')).digest('hex').slice(0, 8);
const html = readFileSync('index.html', 'utf8').replace(/app\.js\?v=[\w]+/, `app.js?v=${v}`);
writeFileSync('index.html', html);
console.log(`app.js built (v=${v})`);
