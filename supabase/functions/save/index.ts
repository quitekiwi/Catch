// Catch's Shortcut helper: saves a link straight into someone's archive, no browser needed.
// The iPhone Shortcut sends { key, url, title? }; the key (made in Catch → menu → iPhone Shortcut) says whose archive.
// Runs as a Supabase Edge Function named "save" with JWT verification off.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const text = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

async function db(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}
async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// the page's own title, same as the "title" helper
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", mdash: '—', ndash: '–', hellip: '…' };
const decode = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
  .replace(/\s+/g, ' ').trim();
function meta(html: string, prop: string) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i'));
  const content = tag && tag[0].match(/content=["']([^"']*)["']/i);
  return content ? content[1] : '';
}
async function pageTitle(url: URL) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CatchTitleBot/1.0)', 'Accept': 'text/html' } });
    if (!(res.headers.get('content-type') || '').includes('html')) return '';
    const html = (await res.text()).slice(0, 300_000);
    return decode(meta(html, 'og:title') || meta(html, 'twitter:title') || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').slice(0, 140);
  } catch { return ''; }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return text('Send a POST with key and url.', 405);
  let body: { key?: string; url?: string; title?: string };
  try { body = await req.json(); } catch { return text('Catch needs a link and your Shortcut key.', 400); }

  // whose archive: the key's fingerprint is all that's stored
  const key = String(body.key || '').trim();
  if (key.length < 20) return text('Your Shortcut key is missing. Make one in Catch → menu → iPhone Shortcut.', 401);
  const owners = await db(`shortcut_keys?select=user_id&key_hash=eq.${await sha256(key)}`);
  if (!owners?.length) return text("That Shortcut key doesn't work any more. Make a new one in Catch → menu → iPhone Shortcut.", 401);
  const userId = owners[0].user_id;

  // the link: the share sheet sometimes hands over text with a link inside it
  const raw = String(body.url || '').match(/https?:\/\/\S+/i)?.[0] || String(body.url || '').trim();
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); if (!url.hostname.includes('.')) throw 0; }
  catch { return text("That doesn't look like a link.", 400); }

  const given = String(body.title || '').trim();
  const name = (given && !/^https?:\/\//i.test(given) ? given : await pageTitle(url)).slice(0, 140);

  // the next session number, never reusing one
  const [last] = await db(`links?select=session_no&user_id=eq.${userId}&order=session_no.desc&limit=1`);
  const [counter] = await db(`meta?select=value&user_id=eq.${userId}&key=eq.counter`);
  const no = Math.max(last?.session_no || 0, parseInt(counter?.value || '0', 10) || 0) + 1;
  const now = Date.now();
  await db('links', { method: 'POST', body: JSON.stringify({
    id: `l_${now}_${Math.random().toString(36).slice(2, 7)}`, user_id: userId, url: url.href, session_no: no,
    name, folder_id: null, domain: url.hostname.replace(/^www\./, ''), added_at: now, read: false }) });
  await db('meta?on_conflict=user_id,key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, key: 'counter', value: String(no) }) });

  return text(`Caught as Nº ${String(no).padStart(3, '0')}${name ? ` · ${name}` : ''}`);
});
