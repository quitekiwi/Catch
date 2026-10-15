// Catch's title helper: given a link, fetches the page and returns its title.
// Runs as a Supabase Edge Function named "title" (the app calls /functions/v1/title).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", mdash: '—', ndash: '–', hellip: '…' };
function decode(s: string) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ').trim();
}
function meta(html: string, prop: string) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i'));
  const content = tag && tag[0].match(/content=["']([^"']*)["']/i);
  return content ? content[1] : '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  let url: URL;
  try { url = new URL((await req.json()).url); } catch { return json({ error: 'bad link' }, 400); }
  // only ordinary public web pages: no local addresses or bare IP numbers
  if (!/^https?:$/.test(url.protocol) || url.hostname === 'localhost' || /^[\d.]+$|:/.test(url.hostname)) return json({ error: 'bad link' }, 400);

  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CatchTitleBot/1.0)', 'Accept': 'text/html' },
    });
    if (!(res.headers.get('content-type') || '').includes('html')) return json({ title: '' });
    // the title lives near the top; don't read more than ~300 KB
    const reader = res.body!.getReader();
    let html = '', bytes = 0;
    const dec = new TextDecoder();
    while (bytes < 300_000) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      html += dec.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    reader.cancel().catch(() => {});
    const title = meta(html, 'og:title') || meta(html, 'twitter:title') || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    return json({ title: decode(title).slice(0, 140) });
  } catch {
    return json({ title: '' });
  }
});
