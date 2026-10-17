const { useState, useEffect, useRef, useMemo } = React;

const SUPABASE_URL = 'https://xgeqkpitsoziywgzautn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xMKJ_dj27JkM6XGFJH_8bA_7hM4vyJj';
const THEMES = [['oxblood','Oxblood'],['hall','Hall'],['dispatch','Dispatch']];
const ROOM = {
  oxblood:  { subtitle:'The Salon of Sessions',          label:'The wall', dock:'Hang a new frame', verb:'hang' },
  hall:     { subtitle:'The Library of the Collection', label:'The library', dock:'To shelve as',   verb:'shelve' },
  dispatch: { subtitle:'Catalogue of Sessions',          label:'Section A',  dock:'New session',    verb:'file' },
};

/* ---------- sign-in: email + 6-digit code (Supabase Auth); the session is kept on this device ---------- */
const SESSION_KEY = 'catch:session';
let session = (() => { try{ return JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){ return null; } })();
function setSession(s){
  session = s;
  try{ s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); }catch(e){}
}
async function auth(path, body, token){
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method:'POST', body: JSON.stringify(body || {}),
    headers:{ 'apikey':SUPABASE_KEY, 'Content-Type':'application/json', ...(token ? { 'Authorization':`Bearer ${token}` } : {}) },
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok){ const e = new Error(data.msg || data.error_description || data.message || `Sign-in error ${res.status}`); e.status = res.status; throw e; }
  return data;
}
function keepSession(d){
  setSession({ access_token:d.access_token, refresh_token:d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now()/1000) + (d.expires_in || 3600), email: (d.user && d.user.email) || (session && session.email) });
}
let renewing = null;
// a working access token, renewed when it's about to run out; offline, this throws and the caller waits
async function accessToken(){
  if(!session) return null;
  if(session.expires_at - 60 > Date.now()/1000) return session.access_token;
  if(!renewing) renewing = auth('token?grant_type=refresh_token', { refresh_token:session.refresh_token })
    .then(keepSession)
    .catch(e => { if(e.status === 400 || e.status === 401){ setSession(null); window.dispatchEvent(new Event('catch:signedout')); } throw e; })
    .finally(() => { renewing = null; });
  await renewing;
  return session && session.access_token;
}

async function sb(path, options = {}) {
  const token = await accessToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token || SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || 'return=representation',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`Supabase ${res.status}: ${errText}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function rowToLink(r){ return { id:r.id, url:r.url, sessionNo:r.session_no, name:r.name||'', folderId:r.folder_id, domain:r.domain, addedAt:r.added_at, read:!!r.read, art:r.art||null }; }
function linkToRow(l){ return { id:l.id, url:l.url, session_no:l.sessionNo, name:l.name||'', folder_id:l.folderId||null, domain:l.domain, added_at:l.addedAt, read:!!l.read }; }
function rowToFolder(r){ return { id:r.id, name:r.name, colorIdx: r.color_idx || 0 }; }

function domainFrom(url){
  try{ const u = new URL(url.match(/^https?:\/\//) ? url : 'https://' + url); return u.hostname.replace(/^www\./,''); }
  catch(e){ return url.slice(0,30); }
}
function normalizeUrl(raw){
  let v = raw.trim();
  if(!v) return null;
  if(!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try{ const u = new URL(v); return (u.hostname.includes('.') || u.hostname === 'localhost') ? v : null; }catch(e){ return null; }
}
function pad(n){ return String(n).padStart(3,'0'); }
function displayTitle(l){ return l.name ? l.name : l.url.replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,''); }
function hashStr(s){ let h=0; for(let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i)) >>> 0; } return h; }
function chunk(arr, size){ const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; }
function readJSON(key, fallback){ try{ const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
function writeJSON(key, v){ try{ localStorage.setItem(key, JSON.stringify(v)); }catch(e){} }

/* ---------- offline: a copy of the archive kept on this device, plus an outbox of changes waiting to reach the database ---------- */
const CACHE_KEY = 'catch:cache', OUTBOX_KEY = 'catch:outbox';
function queue(method, path, body, prefer){ const q = readJSON(OUTBOX_KEY, []); q.push({ method, path, body, prefer }); writeJSON(OUTBOX_KEY, q); }
function outboxSize(){ return readJSON(OUTBOX_KEY, []).length; }
// what the person would call a change (the session counter rides along with a new link)
function pendingChanges(){ return readJSON(OUTBOX_KEY, []).filter(op => !op.path.startsWith('meta')).length; }
let flushing = null;
// sends waiting changes oldest-first; stops at the first one that can't get through and returns how many are left
function flushOutbox(){
  if(flushing) return flushing;
  flushing = (async () => {
    while(true){
      const q = readJSON(OUTBOX_KEY, []);
      if(!q.length) break;
      const op = q[0];
      try{ await sb(op.path, { method:op.method, body: op.body ? JSON.stringify(op.body) : undefined, prefer: op.prefer || 'return=minimal' }); }
      catch(e){
        // no connection, or the database is busy: keep it for later. A flat "no" (e.g. already saved) is dropped so it can't block the rest.
        const refused = e.status >= 400 && e.status < 500 && ![401,403,408,429].includes(e.status);
        if(!refused) break;
        console.error('Dropped a change the database refused', op, e);
      }
      const now = readJSON(OUTBOX_KEY, []); now.shift(); writeJSON(OUTBOX_KEY, now);
    }
    return outboxSize();
  })();
  return flushing.finally(() => { flushing = null; });
}

/* ---------- page titles: links caught without a name get the page's own title from the "title" helper (supabase/functions/title) ---------- */
const UNTITLED_KEY = 'catch:untitled', TRIED_KEY = 'catch:title-tried';
async function fetchTitle(url){
  const res = await fetch(`${SUPABASE_URL}/functions/v1/title`, { method:'POST', headers:{ 'Content-Type':'application/json', 'apikey':SUPABASE_KEY }, body: JSON.stringify({ url }) });
  if(!res.ok) throw new Error(`title helper ${res.status}`);
  const { title } = await res.json();
  return (title || '').trim();
}

/* ---------- shared shelves: ?shelf=<token> shows one folder from someone's archive, read-only, no sign-in ---------- */
const SHELF = new URLSearchParams(window.location.search).get('shelf');
const shelfLink = token => `${window.location.origin}${window.location.pathname}?shelf=${token}`;

/* ---------- iPhone Shortcut: a private key that lets the "save" helper (supabase/functions/save) file links into this archive ---------- */
// the Shortcut's iCloud install link; it asks for the key while being added (set in the Shortcut's setup question)
const SHORTCUT_LINK = 'https://www.icloud.com/shortcuts/d717e12344cd429aadb765d373616a96';
async function sha256hex(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const ART = window.CatchArt || null;
function autoArt(l){ try{ return ART ? ART.pick(l.url, l.name) : 'key'; }catch(e){ return 'key'; } }
function Motif({ k }){
  const s = ART && (ART.subjects[k] || ART.subjects.key);
  if(!s) return null;
  return <svg className="motif" viewBox="0 0 64 52" aria-hidden="true" dangerouslySetInnerHTML={{__html: s.svg}} />;
}

/* painted grounds for the salon miniatures: a lamp-lit vignette in the oxblood palette */
const GROUNDS = [
  'radial-gradient(circle at 30% 28%, #8a4a4f 0%, #73303C 34%, #40101D 78%, #1A1519 100%)',
  'radial-gradient(circle at 70% 30%, #b98d63 0%, #73303C 40%, #40101D 80%)',
  'radial-gradient(ellipse at 50% 85%, #73303C 0%, #40101D 55%, #1A1519 100%)',
  'linear-gradient(170deg, #5b2a35 0%, #40101D 55%, #1A1519 100%)',
];
const SHAPES = ['arch','oval','rect'];
const CLOTHS = [ ['#22352F',false], ['#59523E',false], ['#748C76',true], ['#B09C70',true] ];

function shade(hex, amt){
  const n = parseInt(hex.slice(1),16); let r=n>>16, g=(n>>8)&255, b=n&255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round(r + (t-r)*p); g = Math.round(g + (t-g)*p); b = Math.round(b + (t-b)*p);
  return '#' + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
}

/* ---------- Oxblood salon pieces (geometry lifted from the approved sketches) ---------- */
const OX_MAST = {
  night: `<path fill="#40101D" d="M70 166V160C69 128 42 112 45 76 48 46 100 30 195 28 290 30 342 46 345 76 348 112 321 128 320 160V166Z"/>
    <path class="ln" stroke-width="1" d="M52 163.5H338M88 166H302"/>
    <use href="#half"/><use href="#half" transform="translate(390 0) scale(-1 1)"/>
    <g class="ln" stroke-width="1"><path d="M195 20c-5-5-5-12 0-17 5 5 5 12 0 17zM195 20c-7-1-12-6-13-12 6 1 11 6 13 12zM195 20c7-1 12-6 13-12-6 1-11 6-13 12z"/>
    <path stroke-width=".8" d="M150 112h34M206 112h34M195 108l4 4-4 4-4-4z"/></g>`,
  day: `<rect width="390" height="166" fill="#40101D"/>
    <use href="#half"/><use href="#half" transform="translate(390 0) scale(-1 1)"/>
    <path fill="#E6CFAF" stroke="#73303C" stroke-width="2" d="M70 166V160C69 128 42 112 45 76 48 46 100 30 195 28 290 30 342 46 345 76 348 112 321 128 320 160V166Z"/>
    <path fill="none" stroke="#73303C" stroke-width=".7" d="M78 166V160C77 130 51 114 54 78 57 52 106 38 195 36 284 38 333 52 336 78 339 114 313 130 312 160V166"/>
    <g class="ln" stroke-width="1"><path d="M195 20c-5-5-5-12 0-17 5 5 5 12 0 17zM195 20c-7-1-12-6-13-12 6 1 11 6 13 12zM195 20c7-1 12-6 13-12-6 1-11 6-13 12z"/></g>
    <path fill="none" stroke="#73303C" stroke-width=".8" d="M150 112h34M206 112h34M195 108l4 4-4 4-4-4z"/>`
};
const OX_FRAMES = {
  arch:   { fr:'M12 150V72a48 48 0 0 1 96 0v78z', ln:'M15 147V72a45 45 0 0 1 90 0v75z', mat:'M20 142V72a40 40 0 0 1 80 0v70z',
            clip:'M23 139V72a37 37 0 0 1 74 0v67z', box:[23,35,74,104], ros:[96,52], cords:'M60 6L32 40M60 6L88 40',
            curls:'M12 150c-6-3-8-11-2-12 4-1 5 4 2 5M108 150c6-3 8-11 2-12-4-1-5 4-2 5' },
  oval:   { el:[60,96,38,48], ln:[35,45], mat:[31,41], clip:[28,38], box:[32,58,56,76], ros:[80,48], cords:'M60 6L44 52M60 6L76 52' },
  rect:   { rect:[22,52,76,88], ln:[26,56,68,80], mat:[30,60,60,72], clipR:[32,62,56,68], box:[32,62,56,68], ros:[88,38], cords:'M60 6L34 52M60 6L86 52' },
  cusped: { fr:'M32 56h56a10 10 0 0 0 10 10v74H22v-74a10 10 0 0 0 10-10z', mat:'M36 64h48a6 6 0 0 0 6 6v62H30v-62a6 6 0 0 0 6-6z',
            clip:'M38 68h44a4 4 0 0 0 4 4v56H34v-56a4 4 0 0 0 4-4z', box:[34,68,52,60], ros:[90,44], cords:'M60 6L36 58M60 6L84 58' },
};
const OX_SHAPES = ['oval','cusped','rect'];  // by session number: …003 oval, 001 cusped, 002 rect, as in the sketch
function frameParts(f){
  if(f.el) return { frame:<React.Fragment><ellipse className="fr" cx={f.el[0]} cy={f.el[1]} rx={f.el[2]} ry={f.el[3]}/>
      <ellipse className="ornl" cx={f.el[0]} cy={f.el[1]} rx={f.ln[0]} ry={f.ln[1]} strokeWidth=".6"/>
      <ellipse className="mat" cx={f.el[0]} cy={f.el[1]} rx={f.mat[0]} ry={f.mat[1]}/></React.Fragment>,
    clip:<ellipse cx={f.el[0]} cy={f.el[1]} rx={f.clip[0]} ry={f.clip[1]}/> };
  if(f.rect) return { frame:<React.Fragment><rect className="fr" x={f.rect[0]} y={f.rect[1]} width={f.rect[2]} height={f.rect[3]} rx="2"/>
      <rect className="ornl" x={f.ln[0]} y={f.ln[1]} width={f.ln[2]} height={f.ln[3]} strokeWidth=".6"/>
      <rect className="mat" x={f.mat[0]} y={f.mat[1]} width={f.mat[2]} height={f.mat[3]}/></React.Fragment>,
    clip:<rect x={f.clipR[0]} y={f.clipR[1]} width={f.clipR[2]} height={f.clipR[3]}/> };
  return { frame:<React.Fragment><path className="fr" d={f.fr}/>{f.ln && <path className="ornl" d={f.ln} strokeWidth=".6"/>}<path className="mat" d={f.mat}/>
      {f.curls && <path className="ornl" d={f.curls}/>}</React.Fragment>, clip:<path d={f.clip}/> };
}
/* a painted miniature: the hand-painted scene for the subject if one exists, else a lamp-lit vignette around its drawing */
function OxPainting({ k, box }){
  const P = window.OxbloodArt && window.OxbloodArt.paintings[k];
  const [x,y,w,h] = box;
  if(P){
    const [bx,by,bw,bh] = P.box;
    return <svg x={x} y={y} width={w} height={h} viewBox={`${bx} ${by} ${bw} ${bh}`} preserveAspectRatio="xMidYMid slice" dangerouslySetInnerHTML={{__html:P.svg}} />;
  }
  const S = ART && (ART.subjects[k] || ART.subjects.key);
  return (
    <svg x={x} y={y} width={w} height={h} viewBox="0 0 60 80" preserveAspectRatio="xMidYMid slice">
      <g filter="url(#w-brush)"><rect width="60" height="80" fill="url(#w-room)"/><circle cx="16" cy="28" r="36" fill="url(#w-glow)"/>
        <path d="M0 62l60-3v21H0z" fill="url(#w-cloth)"/></g>
      {S && <svg x="7" y="20" width="46" height="38" viewBox="0 0 64 52" fill="none" stroke="#D9B88F" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{__html:S.svg}} />}
      <rect width="60" height="80" filter="url(#w-canvas)" opacity=".2"/><rect width="60" height="80" fill="url(#w-vig)"/>
    </svg>
  );
}

/* ---------- Dispatch pieces (lifted from the approved r9 sketches) ---------- */
// the sketch's own engravings for the first four subjects; every other subject uses its library drawing
const DP_DRAW = {
  synth: '<path d="M5 30.5l52-.8.3 13.6-52.4.5z"/><path d="M11 30.3v13M17.2 30.4l.1 12.8M23.5 30v13.2M29.6 30.2v13M36 30.1l-.2 13M42.1 30v13.1M48.3 30.2v12.9"/><path d="M14.2 30.5v7.4h3.1v-7.5M26.6 30.3l.2 7.6 3-.1v-7.4M39 30.2v7.6h3M45.4 30.3l-.1 7.4 3 .1"/><path d="M6 30.4c.2-6.2.1-9 .4-11.8l50.3-.6.4 11.6"/><circle cx="13" cy="24" r="2.3"/><circle cx="21" cy="24.2" r="2.2"/><path d="M30 22h14.5M30.5 25.8l13.8-.2M49.5 21.4l3.6 5"/>',
  map: '<path d="M8 12.5l14.6-4.8 15.8 5.4 15.6-5 .3 31.8-15.4 5.2-16-5.6L8.4 44z"/><path d="M22.6 7.8l.4 31.5M38.4 13.2l.6 31.8"/><path d="M13 19c3 4 6 1 9 4s3 7 6 7 5-5 9-3 2 7 8 6" stroke-dasharray="2 2.4"/><path d="M45.4 30.2l3.5 3.4M48.8 30.1l-3.3 3.6"/><path d="M14.5 34.6c1-.8 2.4-.6 3 .4"/><path d="M12 40.5l4-1.3M29 41.6l5 1.6"/>',
  mystic: '<path d="M4.6 26.4C13 14.2 22 9.8 31.3 10c9.6.1 18.4 5 26.4 16.3-8 11.4-17 15.6-26.6 15.4C21.6 41.6 12.4 37 4.6 26.4z"/><circle cx="31" cy="26" r="9.4"/><circle cx="31.2" cy="25.8" r="3.6" fill="currentColor"/><path d="M27.4 21.6l1.8 1.4"/><path d="M14.8 15l-2.6-4.4M22.4 11l-1.2-4.6M31 9.6V4.8M39.6 11l1.4-4.6M47.4 15.2l2.8-4.2"/><path d="M20 39.6c-1.2 4.4-.3 7.4 3 8.6"/>',
  beats: '<path d="M3.8 22.2l53.8-.6.6 12.2L4.2 34.6z"/><path d="M8 22.2l1-6.8 44.2-.4.8 6.6"/><path d="M8.2 27.8l7.6-.1M18.4 27.6h7.8M28.6 27.8h7.6M38.8 27.6l7.6.1M49 27.8h5.6"/><path d="M7.6 31.4h46.8" stroke-dasharray="1.2 2"/><path d="M15 15.4c1.4-4 4-6.6 8-7.6M44.4 15c-.6-3.8-2.6-6.8-6.4-7.4"/><circle cx="31" cy="18.6" r="1.4"/><path d="M12 18.6h6M38 18.6h10"/>',
};
const DP_RINGS = [
  'M58 4C26 1 4 22 5 55c1 33 20 53 49 52 30-1 43-25 41-54C93 22 74 5 48 6 36 8 27 12 22 16',
  'M30 10C10 20 2 45 8 70c6 26 30 38 55 34 26-4 35-30 32-58C92 18 72 3 46 5 33 6 22 13 16 19',
  'M64 6C30 0 6 20 6 52c0 34 18 54 48 54s42-24 40-54C92 22 76 7 50 6 40 6 30 10 24 15',
  'M40 5C14 10 3 34 6 60c3 30 24 48 52 45 27-3 39-28 36-56C91 21 72 4 48 5 38 6 28 10 21 17',
];
function DpDrawing({ k }){
  const own = DP_DRAW[k] || (window.DPDraw && window.DPDraw[k]);
  if(own) return <svg viewBox="0 0 62 52" aria-hidden="true" style={{ color:'#BFB493' }} dangerouslySetInnerHTML={{__html: own}} />;
  const S = ART && (ART.subjects[k] || ART.subjects.key);
  return S ? <svg viewBox="0 0 64 52" aria-hidden="true" style={{ color:'#BFB493' }} dangerouslySetInnerHTML={{__html: S.svg}} /> : null;
}
const DpPostmark = ({ small }) => (
  <svg className="dp-pm" viewBox="0 0 92 50" preserveAspectRatio={small ? 'xMinYMid meet' : 'none'} aria-hidden="true">
    <path d="M0 14c4-3 8 3 12 0s8 3 12 0 8 3 12 0 8 3 12 0M0 22c4-3 8 3 12 0s8 3 12 0 8 3 12 0 8 3 12 0M0 30c4-3 8 3 12 0s8 3 12 0 8 3 12 0 8 3 12 0M0 38c4-3 8 3 12 0s8 3 12 0 8 3 12 0 8 3 12 0"/>
    <circle cx="70" cy="25" r="19"/><circle cx="70" cy="25" r="15.5" strokeWidth=".7"/><path d="M57 25h26" strokeWidth=".6"/>
    <text x="70" y="22" fontSize="6.4" letterSpacing=".5">CLOSED</text>
  </svg>
);

/* ---------- Green Hall pieces ---------- */
// cloths from the hall's palette plus one quiet mist blue; [cloth, title ink, groove]
const GH_INK = '#142420';
const GH_CLOTHS = [
  ['#1B2B26'], ['#423C2D'], ['#4E6352'], ['#7E6E4B'], ['#56706F'],
];
const GH_GOLD = '#9A8760', GH_PAPER = '#A9B29A';
/* a storybook tome: flat painted cloth, one hard-edged cel shadow, ink outline, carved grooves and a stone-tablet label */
function GhBook({ id, w, h, cloth, no, title, art, unread }){
  const [c] = cloth;
  const mid = w/2, medR = Math.min(w/2 - 6, 13), medY = h - 30, gTop = 58, gBot = medY - medR - 12, gH = gBot - gTop;
  const maxChars = Math.max(4, Math.floor((gH - 10) / 6.4));
  const t = title.length > maxChars ? title.slice(0, maxChars - 1) + '…' : title;
  const S = ART && (ART.subjects[art] || ART.subjects.key);
  const cid = 'ghb-' + id;
  const EM = window.GHEmblem && window.GHEmblem[art];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs><clipPath id={cid}><rect x=".7" y=".7" width={w-1.4} height={h-1.4} rx="3"/></clipPath></defs>
      <g clipPath={`url(#${cid})`}>
        <rect width={w} height={h} fill={c}/>
        <rect x={w*0.68} width={w} height={h} fill={shade(c,-.16)}/>
        <rect width={w} height={h} filter="url(#gh-age)"/>
        <rect width={w} height="10.5" fill={shade(c,-.25)}/><rect y={h-10.5} width={w} height="10.5" fill={shade(c,-.25)}/>
        <g fill="#C9C2A8" opacity=".16"><circle cx="0" cy="0" r="7"/><circle cx={w} cy="0" r="6"/><circle cx="0" cy={h} r="7"/><circle cx={w} cy={h} r="8"/></g>
      </g>
      <path d={`M4 14.5H${w-4}M4 ${h-14.5}H${w-4}`} stroke={GH_GOLD} strokeWidth="1" opacity=".85"/>
      <rect x="4.5" y="19" width={w-14} height="24" rx="5" fill={GH_PAPER} stroke="#142420" strokeOpacity=".8"/>
      <text x={mid-2.5} y="28.5" textAnchor="middle" fontFamily="Cinzel" fontSize="6.5" fill="#22302B">Nº</text>
      <text x={mid-2.5} y="38.5" textAnchor="middle" fontFamily="Cinzel" fontWeight="600" fontSize="10" fill="#22302B">{no}</text>
      <g fill={GH_GOLD} opacity=".9"><circle cx={mid-5} cy="50" r="1.2"/><circle cx={mid} cy="50" r="1.2"/><circle cx={mid+5} cy="50" r="1.2"/></g>
      <rect x="7" y={gTop} width={w-14} height={gH} rx={(w-14)/2} fill={GH_PAPER} stroke={GH_GOLD} strokeWidth="1.1"/>
      <rect x="9" y={gTop+2} width={w-18} height={gH-4} rx={(w-18)/2} fill="none" stroke="#142420" strokeOpacity=".25" strokeWidth=".6"/>
      <text transform={`translate(${mid+4.6} ${gTop + gH/2}) rotate(-90)`} textAnchor="middle" fontFamily="EB Garamond" fontWeight="600" fontSize="13.5" letterSpacing=".02em" fill="#1E2B26">{t}</text>
      <path d={`M${mid-8} ${gBot+6}q2-3 4 0t4 0 4 0 4 0`} fill="none" stroke={GH_GOLD} strokeWidth="1" strokeLinecap="round"/>
      <circle cx={mid} cy={medY} r={medR+3} fill="none" stroke={GH_GOLD} strokeWidth=".9"/>
      <circle cx={mid} cy={medY} r={medR} fill={GH_PAPER} stroke="#142420" strokeOpacity=".85" strokeWidth="1.1"/>
      {(EM || S) && <svg x={mid-medR*0.82} y={medY-medR*0.7} width={medR*1.64} height={medR*1.4} viewBox="0 0 64 52" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color:'#423C2D' }} dangerouslySetInnerHTML={{__html: EM || S.svg}} />}
      <rect x=".7" y=".7" width={w-1.4} height={h-1.4} rx="3" fill="none" stroke="#142420" strokeOpacity=".9" strokeWidth="1.2"/>
      {unread && <React.Fragment>
        <path d={`M${w-7.5} -6q2-3 4 0v62l-2-3-2 3z`} fill="#7E1E1E" stroke="#142420" strokeWidth=".6"/>
        <g transform={`translate(${w-4.5} 60) rotate(-8)`}><path d="M-5 0h10v12l-5 3.6-5-3.6z" fill={GH_PAPER} stroke="#142420" strokeWidth=".7"/>
          <circle cy="3.8" r="1.2" fill="none" stroke="#423C2D" strokeWidth=".6"/><path d="M-2.3 8.4h4.6" stroke="#8C2020" strokeWidth=".8"/></g>
      </React.Fragment>}
    </svg>
  );
}
const GhBookend = ({ right, day }) => (
  <svg className={"gh-end" + (right ? " r" : "")} viewBox="-4 232 34 180" preserveAspectRatio="none" aria-hidden="true">
    <path d="M-3 410V250A16 16 0 0 1 29 250V410Z" fill="#B09C70"/>
    <path d="M1 410V250A12 12 0 0 1 25 250V410Z" fill={day ? '#2A403A' : '#B1BFA3'} stroke={day ? '#2A403A' : '#59523E'} strokeWidth="1"/>
    <g fill="none" stroke={day ? '#B09C70' : '#59523E'} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 402C13 380 11 340 13 300M13 384C5 376 4 362 8 352C10 362 12 372 13 384M13 360C21 352 22 338 18 328C16 338 14 348 13 360M13 300C7 292 5 280 8 268M13 300C19 292 21 280 18 268M13 300V272M8 268C9 275 17 275 18 268M8 268c-2-3-4-2-3 0M18 268c2-3 4-2 3 0M11 272l-1.5-7M15 272l1.5-7M7 252c3-6 9-6 12 0M5 404c3-3 13-3 16 0"/>
    </g>
    <g fill={day ? '#B09C70' : '#59523E'}><circle cx="9.5" cy="264.5" r="1.1"/><circle cx="16.5" cy="264.5" r="1.1"/><circle cx="13" cy="243" r="1.3"/></g>
  </svg>
);
const GhBracket = ({ right }) => (
  <svg className={"gh-brk" + (right ? " r" : " l")} viewBox="10 418 50 50" aria-hidden="true">
    <path fill="none" stroke="#B09C70" strokeWidth="1.4" strokeLinecap="round" d="M14 422C14 446 22 462 40 464C52 465 56 454 48 450C42 447 38 454 43 456M14 422C30 426 44 432 54 423M14 422c-6 6-6 14 0 16c3 1 4-2 2-3"/>
  </svg>
);
const GhCeiling = () => (
  <svg className="gh-ceil" viewBox="0 0 390 52" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <pattern id="gh-cof" width="39" height="31" patternUnits="userSpaceOnUse"><rect width="39" height="31" fill="#2A403A"/><rect x="2.5" y="2.5" width="34" height="26" fill="#59523E" stroke="#B09C70" strokeWidth=".6"/><rect x="7.5" y="6.5" width="24" height="18" fill="#2A403A" stroke="#B09C70" strokeWidth=".4" opacity=".9"/><path d="M19.5 11.6v7.8M15.6 15.5h7.8" stroke="#B09C70" strokeWidth=".5"/><circle cx="19.5" cy="15.5" r="2" fill="#B09C70"/><circle cx="19.5" cy="15.5" r="3.6" fill="none" stroke="#B09C70" strokeWidth=".4"/></pattern>
      <linearGradient id="gh-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#59523E" stopOpacity=".75"/><stop offset="1" stopColor="#59523E" stopOpacity="0"/></linearGradient>
    </defs>
    <rect x="-4" width="400" height="31" fill="url(#gh-cof)"/><rect width="390" height="31" fill="url(#gh-shade)"/>
    <path d="M0 33.5h390" stroke="#B09C70"/><path d="M0 38.5h390" stroke="#B09C70" strokeWidth="4" strokeDasharray="2.4 3.1" opacity=".8"/>
    <path d="M0 42.5h390" stroke="#B09C70" strokeWidth=".6"/><path d="M0 45.5h390" stroke="#59523E" strokeWidth="2.5"/><path d="M0 48h390" stroke="#B09C70" strokeWidth=".4" opacity=".55"/>
  </svg>
);
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

const Rosette = () => (
  <svg className="rosette" viewBox="0 0 24 30" aria-hidden="true">
    <path d="M8 16l-3 13 5-3 2 4 1-14zM16 16l3 13-5-3-2 4-1-14z" fill="#73303C"/>
    <circle cx="12" cy="11" r="9" fill="#D9B88F"/>
    <g fill="#73303C">{[0,45,90,135,180,225,270,315].map(a => <ellipse key={a} cx="12" cy="5.4" rx="2.2" ry="3.4" transform={`rotate(${a} 12 11)`}/>)}</g>
    <circle cx="12" cy="11" r="3" fill="#D9B88F" stroke="#73303C"/>
  </svg>
);
const Lily = ({ right }) => (
  <svg className={"bookend" + (right ? " right" : "")} viewBox="0 0 30 150" preserveAspectRatio="none" aria-hidden="true">
    <path d="M2 150V22A13 13 0 0 1 28 22V150Z" fill="var(--bookend)" stroke="var(--bookend-line)"/>
    <g fill="none" stroke="var(--bookend-line)" strokeWidth="1.1" strokeLinecap="round">
      <path d="M15 142C15 110 13 80 15 50M15 120c-7-6-8-16-4-24M15 100c7-6 8-16 4-24M10 50c1 6 9 6 10 0M15 50c-2-5-1-9 0-12 1 3 2 7 0 12z"/>
    </g>
  </svg>
);
const Postmark = () => (
  <svg className="postmark" viewBox="0 0 94 110" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.3">
    <circle cx="38" cy="50" r="17"/><circle cx="38" cy="50" r="13" strokeWidth=".7"/>
    <text x="38" y="53" textAnchor="middle" fontSize="8" fill="currentColor" stroke="none" fontFamily="Old Standard TT">READ</text>
    <path d="M58 40c5-4 9 4 14 0s9 4 14 0M58 50c5-4 9 4 14 0s9 4 14 0M58 60c5-4 9 4 14 0s9 4 14 0"/>
  </svg>
);

// the bookmarks-bar button: opens a small Catch window with the current page's address and title
function bookmarklet(){
  const app = window.location.origin + window.location.pathname;
  return `javascript:(()=>{window.open('${app}?from=button&url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'catch','width=440,height=640')})()`;
}

function SignIn({ onSignedIn }){
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const why = e => navigator.onLine === false ? "You're offline. Connect to the internet to sign in."
    : e.status === 429 ? 'Too many tries. Wait a minute, then try again.' : e.message;
  async function sendCode(ev){
    ev.preventDefault();
    if(!/^\S+@\S+\.\S+$/.test(email.trim())){ setErr("That doesn't look like an email address."); return; }
    setBusy(true); setErr('');
    try{ await auth('otp', { email:email.trim(), create_user:true }); setStep('code'); }
    catch(e){ console.error(e); setErr(why(e)); }
    setBusy(false);
  }
  async function verify(ev){
    ev.preventDefault();
    setBusy(true); setErr('');
    try{ keepSession(await auth('verify', { type:'email', email:email.trim(), token:code.replace(/\s/g,'') })); onSignedIn(); }
    catch(e){ console.error(e); setErr(e.status >= 400 && e.status < 500 && e.status !== 429 ? "That code didn't work. Check it, or send a new one." : why(e)); setBusy(false); }
  }
  return (
    <div className="signin-wrap">
      <form className="sheet modal signin" noValidate onSubmit={step === 'email' ? sendCode : verify} aria-labelledby="signin-title">
        <h2 id="signin-title">Catch</h2>
        {step === 'email' ? (
          <React.Fragment>
            <p>Your archive is private to you. Enter your email and we'll send you a 6-digit code to sign in.</p>
            <div className="edit-row"><input type="email" autoComplete="email" aria-label="Email" placeholder="you@example.com" value={email}
              onChange={e=>{ setEmail(e.target.value); setErr(''); }} autoFocus /></div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <p>We sent a code to <b>{email.trim()}</b>. Type it here. It can take a minute to arrive.</p>
            <div className="edit-row"><input inputMode="numeric" autoComplete="one-time-code" aria-label="Code from the email" placeholder="123456" value={code}
              onChange={e=>{ setCode(e.target.value); setErr(''); }} autoFocus /></div>
          </React.Fragment>
        )}
        {err && <div className="save-error" role="alert">{err}</div>}
        <div className="actions">
          {step === 'code' && <button type="button" onClick={()=>{ setStep('email'); setCode(''); setErr(''); }}>Use another email</button>}
          <button type="submit" className="primary" disabled={busy}>{busy ? '···' : step === 'email' ? 'Send code' : 'Sign in'}</button>
        </div>
      </form>
    </div>
  );
}

function PrivacyModal({ onClose }){
  const closeRef = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    closeRef.current && closeRef.current.focus();
    const onKey = e => { if(e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prev && prev.focus && prev.focus(); };
  }, []);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title" onClick={e=>e.stopPropagation()}>
        <h2 id="privacy-title">About your data</h2>
        <p>Catch stores everything you save — links, names, folders — in a cloud database (Supabase). This is what lets the same archive show up on your phone and your computer. A copy is also kept on each device you sign in on, so it opens quickly and works offline.</p>
        <h3>Who can access it</h3>
        <p>You sign in with your email. The database checks who you are on every request and only ever shows you your own links; other people with accounts have their own separate archives and can't see yours. The people who run the database (the app's owner and Supabase) can technically see everything stored in it.</p>
        <h3>Shared folders</h3>
        <p>If you share a folder, anyone with its link can see the links in that folder (not whether you've read them, and nothing else in your archive) until you stop sharing it.</p>
        <h3>Page titles</h3>
        <p>When you catch a link without naming it, a small helper visits that page once to read its title. Nothing else about you is sent with it.</p>
        <h3>What's not happening</h3>
        <p>Nothing is sold, and there are no ads or analytics tracking you across other sites. This app talks only to its own database.</p>
        <div className="actions"><button ref={closeRef} className="primary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

function App(){
  const [signedIn, setSignedIn] = useState(() => !!session);
  const cached = useMemo(() => session && !SHELF ? readJSON(CACHE_KEY, null) : null, []);
  const [shelf, setShelf] = useState(null);       // the shared folder being viewed: { folder } or { missing } or { error }
  const [shares, setShares] = useState(null);     // this person's shared folders: { folderId: token }
  const [shareNote, setShareNote] = useState('');
  const [shortcutKey, setShortcutKey] = useState('');  // shown once, right after it's made
  const [shortcutNote, setShortcutNote] = useState('');
  const [shortcutReady, setShortcutReady] = useState(false);  // key made and copied; next tap installs the Shortcut
  const [links, setLinks] = useState(() => cached ? cached.links : null);
  const [folders, setFolders] = useState(() => cached ? cached.folders : []);
  const [counter, setCounter] = useState(() => cached ? cached.counter : 0);
  const [pending, setPending] = useState(pendingChanges);
  const [inputVal, setInputVal] = useState('');
  const [nameVal, setNameVal] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [folderFilter, setFolderFilter] = useState('all');
  const [sortMode, setSortMode] = useState('newest');
  const [showHint, setShowHint] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState(false);
  // ?room=hall&mode=night opens a specific room without changing the saved choice
  const urlRoom = new URLSearchParams(window.location.search).get('room');
  const urlMode = new URLSearchParams(window.location.search).get('mode');
  const [theme, setTheme] = useState(() => {
    const t = urlRoom || readJSON('catch:room', null);
    return THEMES.some(([k]) => k === t) ? t : 'oxblood';
  });
  const [modePref, setModePref] = useState(() => ['day','night','auto'].includes(urlMode) ? urlMode : readJSON('catch:mode', 'auto'));
  const [systemDark, setSystemDark] = useState(() => !window.matchMedia || window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editFolder, setEditFolder] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [artOverrides, setArtOverrides] = useState(() => readJSON('catch:art', {}));
  const [showPicker, setShowPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [justCaught, setJustCaught] = useState(null);
  const [fromButton, setFromButton] = useState(false);
  const [wide, setWide] = useState(() => window.innerWidth >= 640);
  const [desk, setDesk] = useState(() => window.innerWidth >= 1100);  // computer screens: form in a side column, room fills the rest
  const inputRef = useRef(null);

  const mode = modePref === 'auto' ? (systemDark ? 'night' : 'day') : modePref;

  useEffect(() => {
    if(SHELF) loadShelf(); else refresh();
    const onSignedOut = () => forgetDevice();
    window.addEventListener('catch:signedout', onSignedOut);
    (() => {
      // the add-to-home-screen tip only makes sense on iOS Safari, outside the installed app
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const installed = window.navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
      if(!ios || installed) setShowHint(false);
      try{ if(localStorage.getItem('catch:hint-dismissed') === 'true') setShowHint(false); }catch(e){}
    })();
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = e => setSystemDark(e.matches);
    mq && mq.addEventListener && mq.addEventListener('change', onScheme);
    const onResize = () => { setWide(window.innerWidth >= 640); setDesk(window.innerWidth >= 1100); };
    window.addEventListener('resize', onResize);
    // back online, or back to the app after a while: send what's waiting and pick up changes from other devices
    const onOnline = () => refresh();
    const onVisible = () => { if(document.visibilityState === 'visible') refresh(); };
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisible);
    return () => { mq && mq.removeEventListener && mq.removeEventListener('change', onScheme); window.removeEventListener('resize', onResize);
      window.removeEventListener('online', onOnline); document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('catch:signedout', onSignedOut); };
  }, []);

  useEffect(() => {
    if(links === null) return;
    try{
      const params = new URLSearchParams(window.location.search);
      const incoming = params.get('url');
      if(incoming){
        addLink(incoming, params.get('title') || '', '');
        window.history.replaceState({}, '', window.location.pathname);
        // opened by the browser's Catch button: say so, then close the little window
        if(params.get('from') === 'button'){
          setFromButton('sending');
          flushOutbox().then(left => {
            if(left){ setFromButton('waiting'); return; }
            setFromButton('done'); setTimeout(() => window.close(), 1500);
          });
        }
      }
    }catch(e){}
    // eslint-disable-next-line
  }, [links === null]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-mode', mode);
    const tc = document.querySelector('meta[name="theme-color"]');
    if(tc) tc.setAttribute('content', theme === 'hall' ? '#2A403A' : theme === 'dispatch' ? '#393D3C' : '#40101D');
  }, [theme, mode]);

  // keep this device's copy of the archive current, so it opens instantly and works offline
  useEffect(() => { if(links !== null) writeJSON(CACHE_KEY, { links, folders, counter }); }, [links, folders, counter]);

  async function sync(){ const left = await flushOutbox(); setPending(pendingChanges()); return left; }
  function send(method, path, body, prefer){ queue(method, path, body, prefer); sync(); }
  async function refresh(){
    if(!session || SHELF) return;
    if(await sync() > 0){ setSyncError(true); setLinks(prev => prev || []); return; }  // still offline: keep the local copy
    try{
      const [l, f, m] = await Promise.all([
        sb('links?select=*&order=session_no.desc'), sb('folders?select=*&order=created_at.asc'), sb('meta?select=value&key=eq.counter')]);
      if(outboxSize() > 0) return;  // something was caught while loading; the next refresh will include it
      // links from before pictures were kept get today's picture locked in, so later titles can't change it
      const kept = readJSON('catch:art', {}), waitingIds = new Set(readJSON(UNTITLED_KEY, []).map(u => u.id));
      const fresh = (l || []).map(rowToLink).map(x => x.art || waitingIds.has(x.id) ? x : { ...x, art: kept[x.id] || autoArt(x), lockNow:true });
      fresh.filter(x => x.lockNow).forEach(x => { kept[x.id] = x.art; queue('PATCH', `links?id=eq.${x.id}&art=is.null`, { art:x.art }); delete x.lockNow; });
      writeJSON('catch:art', kept); setArtOverrides(kept);
      setLinks(fresh); setFolders((f || []).map(rowToFolder)); setCounter(Math.max(0, ...(m || []).map(r => parseInt(r.value, 10) || 0)));
      setSyncError(false);
      // older links that were caught without a name get their page titles too, once
      const tried = new Set(readJSON(TRIED_KEY, [])), waiting = readJSON(UNTITLED_KEY, []), queued = new Set(waiting.map(u => u.id));
      const older = (l || []).filter(r => !r.name && !tried.has(r.id) && !queued.has(r.id)).map(r => ({ id:r.id, url:r.url }));
      if(older.length) writeJSON(UNTITLED_KEY, [...waiting, ...older]);
      sync();
    }catch(e){ console.error(e); setSyncError(true); setLinks(prev => prev || []); }
    nameUntitled();
  }

  // fills in titles for links caught without a name; anything that can't be reached yet waits for the next sync
  const naming = useRef(false);
  async function nameUntitled(){
    if(naming.current) return;
    naming.current = true;
    try{
      for(const { id, url } of readJSON(UNTITLED_KEY, [])){
        let title;
        try{ title = await fetchTitle(url); }catch(e){ console.error(e); break; }
        writeJSON(UNTITLED_KEY, readJSON(UNTITLED_KEY, []).filter(u => u.id !== id));
        writeJSON(TRIED_KEY, [...readJSON(TRIED_KEY, []), id]);  // asked once; don't ask again
        lockArt(id, autoArt({ url, name:title || '' }), true);  // a new catch's picture is chosen now, helped by the title
        if(!title) continue;
        setLinks(prev => (prev || []).map(l => l.id === id && !l.name ? { ...l, name:title } : l));
        send('PATCH', `links?id=eq.${id}&name=eq.`, { name:title });  // only if it's still unnamed
      }
    }finally{ naming.current = false; }
  }

  async function loadShelf(){
    try{
      const d = await sb('rpc/shared_shelf', { method:'POST', body: JSON.stringify({ share_token:SHELF }) });
      if(!d){ setShelf({ missing:true }); setLinks([]); return; }
      setLinks((d.links || []).map(r => rowToLink({ ...r, read:false })));
      setShelf({ folder:d.folder });
      if(!urlRoom && THEMES.some(([k]) => k === d.room)) setTheme(d.room);  // show it in the room it was shared from
    }catch(e){ console.error(e); setShelf({ error:true }); setLinks([]); }
  }
  // sharing a folder: a private link that shows only that folder, read-only. Needs a connection (not queued).
  async function loadShares(){
    try{ const rows = await sb('shares?select=token,folder_id'); setShares(Object.fromEntries((rows || []).map(r => [r.folder_id, r.token]))); }
    catch(e){ console.error(e); setShares(null); }
  }
  async function hand(link, folderName){
    try{
      if(navigator.share && /iPhone|iPad|Android/.test(navigator.userAgent)){ await navigator.share({ title:`${folderName} · Catch`, url:link }); return; }
      await navigator.clipboard.writeText(link); setShareNote(`Link to “${folderName}” copied.`);
    }catch(e){ if(e.name !== 'AbortError') setShareNote(link); }
  }
  async function shareFolder(f){
    setShareNote('');
    try{
      const rows = await sb('shares?on_conflict=user_id,folder_id', { method:'POST', body: JSON.stringify({ folder_id:f.id, room:theme }),
        prefer:'resolution=merge-duplicates,return=representation' });
      const token = rows && rows[0] && rows[0].token;
      setShares(prev => ({ ...(prev || {}), [f.id]:token }));
      hand(shelfLink(token), f.name);
    }catch(e){ console.error(e); setShareNote("Couldn't reach the archive. Try again when you're online."); }
  }
  async function stopSharing(f){
    setShareNote('');
    try{
      await sb(`shares?folder_id=eq.${encodeURIComponent(f.id)}`, { method:'DELETE', prefer:'return=minimal' });
      setShares(prev => { const n = { ...(prev || {}) }; delete n[f.id]; return n; });
      setShareNote(`“${f.name}” is no longer shared; its link has stopped working.`);
    }catch(e){ console.error(e); setShareNote("Couldn't reach the archive. Try again when you're online."); }
  }
  useEffect(() => { if(showMenu && signedIn && !SHELF){ setShareNote(''); loadShares(); } }, [showMenu]);
  // only the key's fingerprint is stored, so it can be shown just this once; a new key switches the old one off
  function newKey(){
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function saveKey(key){
    await sb('shortcut_keys?on_conflict=user_id', { method:'POST', body: JSON.stringify({ key_hash: await sha256hex(key) }),
      prefer:'resolution=merge-duplicates,return=minimal' });
  }
  async function makeShortcutKey(){
    setShortcutNote('');
    const key = newKey();
    try{ await saveKey(key); setShortcutKey(key); }
    catch(e){ console.error(e); setShortcutNote("Couldn't reach the archive. Try again when you're online."); }
  }
  // one-tap setup: copy a fresh key first (phones only allow copying straight after a tap), then register it;
  // the install link opens on the next tap, and the Shortcut asks for the key, which is already on the clipboard
  async function addToIphone(){
    setShortcutNote(''); setShortcutReady(false); setShortcutKey('');
    const key = newKey();
    let copied = true;
    try{ await navigator.clipboard.writeText(key); }catch(e){ copied = false; }
    try{ await saveKey(key); }
    catch(e){ console.error(e); setShortcutNote("Couldn't reach the archive. Try again when you're online."); return; }
    if(copied) setShortcutReady(true); else setShortcutKey(key);  // couldn't copy: show it so it can be copied by hand
  }
  async function copyShortcutKey(){
    try{ await navigator.clipboard.writeText(shortcutKey); setShortcutNote('Key copied. Paste it into your Shortcut.'); }
    catch(e){ setShortcutNote('Select the key above and copy it.'); }
  }

  function signedInNow(){ setSignedIn(true); refresh(); }
  // signing out clears this device's copy, so the next person to sign in here starts from their own archive
  function forgetDevice(){
    [CACHE_KEY, OUTBOX_KEY, UNTITLED_KEY, TRIED_KEY, 'catch:art'].forEach(k => { try{ localStorage.removeItem(k); }catch(e){} });
    setLinks(null); setFolders([]); setCounter(0); setPending(0); setSyncError(false); setSelectedId(null);
    setSignedIn(false);
  }
  async function signOut(){
    const left = pendingChanges();
    if(left && !window.confirm(`${left === 1 ? '1 change hasn\'t' : left + " changes haven't"} reached the database yet and will be lost if you sign out now. Sign out anyway?`)) return;
    const token = session && session.access_token;
    setSession(null); setShowMenu(false); forgetDevice();
    try{ await auth('logout', {}, token); }catch(e){}
  }

  function chooseTheme(t){ setTheme(t); writeJSON('catch:room', t); }
  function cycleMode(){ const next = modePref === 'auto' ? 'day' : modePref === 'day' ? 'night' : 'auto'; setModePref(next); writeJSON('catch:mode', next); }

  async function createFolder(){
    const name = window.prompt('Name this folder (e.g. AI, Recipes, Gifts):');
    if(!name || !name.trim()) return null;
    const colorIdx = folders.length % 4;
    const folder = { id:'f_'+Date.now()+'_'+Math.random().toString(36).slice(2,5), name:name.trim(), colorIdx };
    send('POST', 'folders', { id:folder.id, name:folder.name, color_idx:colorIdx });
    setFolders(prev => [...prev, folder]);
    return folder.id;
  }
  async function handleFolderSelectChange(e, setter){
    if(e.target.value === '__new__'){ const id = await createFolder(); setter(id || ''); }
    else{ setter(e.target.value); }
  }

  async function addLink(raw, name, folderId){
    const url = normalizeUrl(raw);
    if(!url) return false;
    // the share link can save before the meta counter has loaded, so never trust it alone
    const nextCounter = Math.max(counter, ...(links || []).map(l => l.sessionNo || 0)) + 1;
    const entry = { id:'l_'+Date.now()+'_'+Math.random().toString(36).slice(2,7), url, sessionNo: nextCounter,
      name: (name||'').trim(), folderId: folderId || null, domain: domainFrom(url), addedAt: Date.now(), read: false };
    queue('POST', 'links', linkToRow(entry));
    if(entry.name){ const k = autoArt(entry); entry.art = k; writeJSON('catch:art', { ...readJSON('catch:art', {}), [entry.id]:k }); queue('PATCH', `links?id=eq.${entry.id}`, { art:k }); }
    send('POST', 'meta?on_conflict=user_id,key', { key:'counter', value: String(nextCounter) }, 'resolution=merge-duplicates,return=minimal');
    setCounter(nextCounter);
    setLinks(prev => [entry, ...(prev || [])]);
    setJustCaught(entry.id); setTimeout(() => setJustCaught(null), 900);
    if(!entry.name){ writeJSON(UNTITLED_KEY, [...readJSON(UNTITLED_KEY, []), { id:entry.id, url }]); nameUntitled(); }
    return true;
  }

  async function handleSaveClick(){
    if(!inputVal.trim()){ inputRef.current && inputRef.current.focus(); return; }
    if(!normalizeUrl(inputVal)){ setSaveError("That doesn't look like a link. Try something like example.com"); return; }
    setSaveError('');
    setSaving(true);
    const ok = await addLink(inputVal, nameVal, selectedFolder);
    setSaving(false);
    if(ok){ setInputVal(''); setNameVal(''); setSelectedFolder(''); inputRef.current && inputRef.current.blur(); }
  }

  async function toggleRead(id){
    const target = links.find(l => l.id === id);
    if(!target) return;
    const nextRead = !target.read;
    setLinks(links.map(l => l.id===id ? {...l, read: nextRead} : l));
    send('PATCH', `links?id=eq.${id}`, { read: nextRead });
  }
  async function removeLink(id){
    setLinks(links.filter(l => l.id!==id));
    if(selectedId === id) setSelectedId(null);
    send('DELETE', `links?id=eq.${id}`);
  }
  async function dismissHint(){ setShowHint(false); try{ localStorage.setItem('catch:hint-dismissed','true'); }catch(e){} }

  function openLink(l){ if(SHELF){ window.open(l.url, '_blank', 'noopener'); return; } setConfirmDelete(false); setShowPicker(false); setSelectedId(l.id); setEditName(l.name || ''); setEditFolder(l.folderId || ''); }
  function closeSheet(){ setSelectedId(null); setConfirmDelete(false); setShowPicker(false); }
  async function saveEdit(id){
    const newFolderId = editFolder || null;
    const newName = editName.trim();
    setLinks(links.map(l => l.id===id ? {...l, name:newName, folderId:newFolderId} : l));
    send('PATCH', `links?id=eq.${id}`, { name:newName, folder_id:newFolderId });
    setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1800);
  }
  // a link's picture is decided once and then kept: renaming or a fetched title never changes it, only "change picture" does.
  // it's saved with the link (the art column) and on this device (catch:art), so it holds even before the database knows it
  function lockArt(id, key, onlyIfUnset){
    const kept = readJSON('catch:art', {});
    if(onlyIfUnset && kept[id]) return;
    const next = { ...kept, [id]:key };
    writeJSON('catch:art', next); setArtOverrides(next);
    setLinks(prev => (prev || []).map(l => l.id === id && !(onlyIfUnset && l.art) ? { ...l, art:key } : l));
    send('PATCH', `links?id=eq.${id}${onlyIfUnset ? '&art=is.null' : ''}`, { art:key });
  }
  function setArt(id, key){ const l = links.find(x => x.id === id); if(l) lockArt(id, key || autoArt(l)); }
  const artOf = l => l.art || artOverrides[l.id] || autoArt(l);

  useEffect(() => {
    if(!showMenu) return;
    const onKey = e => { if(e.key === 'Escape') setShowMenu(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showMenu]);
  useEffect(() => {
    if(!selectedId) return;
    const onKey = e => { if(e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const folderById = useMemo(() => { const m = {}; folders.forEach(f => m[f.id]=f); return m; }, [folders]);
  const visible = useMemo(() => {
    if(!links) return [];
    let list = links;
    if(statusFilter==='unread') list = list.filter(l=>!l.read);
    if(statusFilter==='read') list = list.filter(l=>l.read);
    if(folderFilter!=='all') list = list.filter(l=>l.folderId===folderFilter);
    if(query.trim()){
      const q = query.trim().toLowerCase();
      list = list.filter(l =>
        (l.name||'').toLowerCase().includes(q) || l.domain.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) || (folderById[l.folderId]?.name || '').toLowerCase().includes(q)
      );
    }
    list = [...list];
    if(sortMode==='alphabetical') list.sort((a,b)=> displayTitle(a).localeCompare(displayTitle(b)));
    else if(sortMode==='oldest') list.sort((a,b)=> a.addedAt - b.addedAt);
    else list.sort((a,b)=> b.addedAt - a.addedAt);
    return list;
  }, [links, statusFilter, folderFilter, query, folderById, sortMode]);

  const unreadCount = links ? links.filter(l=>!l.read).length : 0;
  const countText = links ? (SHELF ? `${links.length} ${links.length === 1 ? 'link' : 'links'}` : `${links.length} caught · ${unreadCount} open`) : '';
  const filtersActive = statusFilter !== 'all' || sortMode !== 'newest';
  const selectedLink = selectedId && links ? links.find(l=>l.id===selectedId) : null;
  const nextNo = Math.max(counter, ...((links || []).map(l => l.sessionNo || 0))) + 1;
  const newestId = links && links.length ? [...links].sort((a,b)=>b.addedAt-a.addedAt)[0].id : null;
  const room = ROOM[theme];

  function itemLabel(l){ return `Session ${pad(l.sessionNo)}, ${displayTitle(l)}, ${l.domain}, ${l.read ? 'read' : 'unread'}`; }

  /* ---------- the three rooms ---------- */
  function Salon(){
    // frames hang in number order, newest first (the newest keeps its arched frame)
    const list = visible;
    const ghosts = (!SHELF && !query && folderFilter==='all' && statusFilter==='all') ? [0,1] : [];
    return (
      <React.Fragment>
        <svg className="rail" viewBox="0 0 390 20" preserveAspectRatio="none" aria-hidden="true">
          <path className="ln" strokeWidth="1.1" d="M0 12H390"/><path className="ln" strokeWidth=".5" opacity=".6" d="M0 16H390"/>
          <path className="ln" strokeWidth=".8" d="M180 12c4-6 11-6 15 0 4-6 11-6 15 0M195 12v-5"/>
        </svg>
        <div className="salon2">
          {list.map(l => {
            const h = hashStr(l.id);
            const newest = l.id === newestId;
            const f = OX_FRAMES[newest ? 'arch' : OX_SHAPES[(l.sessionNo || 0) % 3]];
            const parts = frameParts(f);
            const t = displayTitle(l);
            const title = t.length > 14 ? t.slice(0,13) + '…' : t;
            const cid = 'clip-' + l.id;
            return (
              <button key={l.id} className={"hang2" + (l.read ? " closed" : "") + (justCaught===l.id ? " just" : "")} aria-label={itemLabel(l)} onClick={()=>openLink(l)}>
                <svg width="120" height="214" viewBox="0 0 120 214" aria-hidden="true">
                  <defs><clipPath id={cid}>{parts.clip}</clipPath></defs>
                  <path className="cord" d={f.cords}/>
                  <use href="#nail" x="60" y="6"/>
                  {parts.frame}
                  <g className="paint" clipPath={`url(#${cid})`}><OxPainting k={artOf(l)} box={f.box} /></g>
                  {!l.read && <use href="#ros" x={f.ros[0]} y={f.ros[1]} width="22" height="28"/>}
                  {newest
                    ? <React.Fragment><path className="pl" d="M22 160h76a6 6 0 0 0 6 6v30a6 6 0 0 0-6 6H22a6 6 0 0 0-6-6v-30a6 6 0 0 0 6-6z"/>
                        <path className="pli" d="M22 163h76a3 3 0 0 0 3 3v30a3 3 0 0 0-3 3H22a3 3 0 0 0-3-3v-30a3 3 0 0 0 3-3z"/></React.Fragment>
                    : <React.Fragment><rect className="pl" x="16" y="160" width="88" height="42" rx="3"/><rect className="pli" x="19" y="163" width="82" height="36" rx="2"/></React.Fragment>}
                  <text x="60" y="173" textAnchor="middle" className="n" style={newest ? { fontSize:'8px', letterSpacing:'.06em' } : null}>Nº {pad(l.sessionNo)}{newest ? ' · Newest' : ''}</text>
                  <text x="60" y="188" textAnchor="middle" className="ti" style={title.length > 11 ? { fontSize:'12.5px' } : null}>{title}</text>
                  <text x="60" y="198" textAnchor="middle" className="dm">{l.domain.length > 18 ? l.domain.slice(0,17) + '…' : l.domain}</text>
                </svg>
              </button>
            );
          })}
          {ghosts.map(i => (
            <svg key={'g'+i} className="ghost2" viewBox="0 0 120 214" aria-hidden="true">
              <use href="#nail" x="60" y="6"/>
              {i === 0 ? <rect className="gh" x="24" y="52" width="72" height="84" rx="2"/> : <ellipse className="gh" cx="60" cy="96" rx="34" ry="42"/>}
              <rect className="gh" x="16" y="160" width="88" height="42" rx="3" style={{ opacity:.3 }}/>
              <text x="60" y="100" textAnchor="middle" className="cap">{pad(nextNo + i)}</text>
            </svg>
          ))}
        </div>
        <div className="wall-cap">Sessions {pad(Math.min(...visible.map(l=>l.sessionNo)))} — {pad(Math.max(...visible.map(l=>l.sessionNo)))} {SHELF ? '' : ' · room for more'}</div>
      </React.Fragment>
    );
  }
  function Shelves(){
    const perRow = desk ? 16 : wide ? 12 : 6;
    const rows = chunk(visible, perRow);
    const ghosts = !SHELF && !query && folderFilter==='all' && statusFilter==='all';
    const shelfCount = rows.length + (ghosts ? 1 : 0);
    const day = mode === 'day';
    const nums = visible.map(l=>l.sessionNo);
    return (
      <React.Fragment>
        <div className="gh-sec"><span>The Library · Shelves I – {ROMAN[Math.min(shelfCount, 12) - 1]}</span></div>
        {rows.map((row, ri) => (
          <div className="gh-shelf" key={ri}>
            <GhBookend day={day} />
            {row.map(l => {
              const h = hashStr(l.id);
              return (
                <button key={l.id} className={"gh-book" + (l.read ? " closed" : "") + (justCaught===l.id ? " just" : "")} aria-label={itemLabel(l)} onClick={()=>openLink(l)}>
                  <GhBook id={l.id} w={40 + ((h >>> 5) % 9)} h={216 + ((h >>> 9) % 30)} cloth={GH_CLOTHS[(l.sessionNo || 0) % GH_CLOTHS.length]}
                    no={pad(l.sessionNo)} title={displayTitle(l)} art={artOf(l)} unread={!l.read} />
                </button>
              );
            })}
            <GhBookend right day={day} />
            <div className="gh-plank"></div><GhBracket /><GhBracket right />
          </div>
        ))}
        {ghosts && (
          <div className="gh-shelf" style={{ minHeight:170 }}>
            {[0,1,2,3].map(i => (
              <div key={i} className="gh-ghost" aria-hidden="true" style={{ width:36, height:[128,140,120,134][i] }}>{pad(nextNo + i)}</div>
            ))}
            <div className="gh-more">room for more</div>
            <div className="gh-plank"></div><GhBracket /><GhBracket right />
          </div>
        )}
        <div className="gh-plaque"><span>Sessions {pad(Math.min(...nums))} – {pad(Math.max(...nums))}</span></div>
      </React.Fragment>
    );
  }
  function Stamps(){
    const showReserved = !SHELF && !query && folderFilter==='all' && statusFilter==='all';
    return (
      <React.Fragment>
        <div className="dp-grid">
          {visible.map(l => (
            <div key={l.id} className={"dp-c" + (l.read ? " closed" : "")}>
              <button className={"dp-st" + (justCaught===l.id ? " just" : "")} aria-label={itemLabel(l)} onClick={()=>openLink(l)}>
                <span className="face"><DpDrawing k={artOf(l)} /><em>{l.sessionNo}</em></span>
                {l.read ? <DpPostmark /> : (
                  <svg className="dp-ring" viewBox="0 0 100 112" preserveAspectRatio="none" aria-hidden="true">
                    <path className="h" d={DP_RINGS[(l.sessionNo || 0) % 4]}/><path className="k" d={DP_RINGS[(l.sessionNo || 0) % 4]}/>
                  </svg>
                )}
              </button>
              <div className="dp-code">S-{pad(l.sessionNo)}</div>
              <div className="dp-t">{displayTitle(l).slice(0,40)}<small>{l.domain}</small></div>
              {l.id === newestId && <span className="dp-new">newest</span>}
            </div>
          ))}
          {showReserved && [0,1].map(i => (
            <div key={'r'+i} className="dp-c dp-r" aria-hidden="true"><div className="tile"><span>{pad(nextNo + i)}</span></div><div className="dp-code">reserved</div></div>
          ))}
        </div>
        {showReserved && <div className="dp-more"><i></i><span>{pad(nextNo + 2)} onward · more room below</span><i></i></div>}
        <div className="dp-key">
          <div className="dp-ms">
            <span className="dp-st"><span className="face"><DpDrawing k="mystic" /></span></span>
            <DpPostmark small />
          </div>
          <div><div className="lb">Key</div><p>read links get postmarked</p></div>
        </div>
      </React.Fragment>
    );
  }

  if(!signedIn && !SHELF) return <SignIn onSignedIn={signedInNow} />;

  return (
    <div className="app">
      {theme === 'oxblood' ? (
        <div className="ox-top"><header className="ox-mast">
          <svg width="390" height="166" viewBox="0 0 390 166" aria-hidden="true" dangerouslySetInnerHTML={{__html: OX_MAST[mode]}} />
          <h1>Catch</h1>
          <div className="sub">{room.subtitle}</div>
          <div className="tag">Paste it, find it later. Nothing else.</div>
          {links && links.length > 0 && <div className="cnt">{countText}</div>}
        </header></div>
      ) : theme === 'dispatch' ? (
        <header className="dp-mast">
          <div className="orn2" aria-hidden="true"><i></i><svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 .5L9.5 5 5 9.5.5 5z" fill="none" stroke="currentColor" strokeWidth=".8"/><circle cx="5" cy="5" r="1.2" fill="currentColor"/></svg><i></i></div>
          <h1>CATCH</h1>
          <div className="sub">Catalogue of Sessions</div>
          <div className="tag">Paste it, find it later. Nothing else.</div>
        </header>
      ) : theme === 'hall' ? (
        <React.Fragment>
          <div className="gh-top" aria-hidden="true"></div>
          <GhCeiling />
          <header className="gh-mast">
            <h1>CATCH</h1>
            <svg className="orn3" viewBox="0 0 300 14" fill="none" stroke="#B09C70" strokeLinecap="round" aria-hidden="true">
              <path d="M12 7h112M176 7h112" strokeWidth=".7"/><path d="M124 7c6 0 9-5 15-5 4 0 4 4 1.5 4.6M176 7c-6 0-9 5-15 5-4 0-4-4-1.5-4.6" strokeWidth=".8"/>
              <path d="M150 2.2l4.8 4.8-4.8 4.8-4.8-4.8z" fill="#B09C70" stroke="none"/><path d="M12 7c-4 0-6-3-4-4.4 1.6-1 3 .6 2 1.6M288 7c4 0 6 3 4 4.4-1.6 1-3-.6-2-1.6" strokeWidth=".7"/>
            </svg>
            <div className="sub">Catalogue of the Collection</div>
          </header>
          <div className="gh-tag"><i>Paste it, find it later. Nothing else.</i>{links && links.length > 0 && <b>{countText.toUpperCase()}</b>}</div>
        </React.Fragment>
      ) : (
        <header className="mast">
          <div className="orn" aria-hidden="true"><i></i><b></b><i></i></div>
          <h1>Catch</h1>
          <div className="subtitle">{room.subtitle}</div>
          <div className="tagline">Paste it, find it later. Nothing else.</div>
          {links && links.length > 0 && <div className="count">{countText}</div>}
        </header>
      )}

      {(syncError || pending > 0) && (
        <div className="banner" role="status">
          <span>{pending > 0
            ? `Offline — ${pending === 1 ? '1 change is' : pending + ' changes are'} kept on this device and will sync when you're back online.`
            : "Can't reach the archive right now — showing the copy kept on this device."}</span>
          <button onClick={refresh}>Try again</button>
        </div>
      )}
      {SHELF && (
        <div className="banner" role="status">
          <span>{shelf && shelf.folder ? <React.Fragment>A shelf shared from someone's Catch archive: <b>{shelf.folder}</b>. You can look and open links; nothing here can be changed.</React.Fragment>
            : shelf && shelf.missing ? "This shared shelf isn't available any more. Its owner may have stopped sharing it."
            : shelf && shelf.error ? "Couldn't open this shelf right now. Check your connection and try again."
            : 'Opening the shared shelf…'}</span>
        </div>
      )}
      {fromButton && (
        <div className="banner" role="status">
          <span>{fromButton === 'sending' ? 'Catching…' : fromButton === 'done' ? 'Caught. This window will close in a moment.'
            : "Caught, and kept on this device. It will reach your archive next time you're online with Catch open."}</span>
          <button onClick={()=>window.close()}>Close</button>
        </div>
      )}
      {showHint && (
        <div className="banner">
          <span>On iPhone: Share → Add to Home Screen, so this opens full-screen like an app.</span>
          <button className="x" aria-label="Dismiss tip" onClick={dismissHint}><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2l8 8M10 2l-8 8"/></svg></button>
        </div>
      )}

      <div className="desk">
      <div className="desk-side">
      {!SHELF && <div className={"save-block" + (inputVal.trim() || nameVal ? " has-text" : "")}>
        <svg className="iron" viewBox="0 0 390 30" preserveAspectRatio="none" aria-hidden="true">
          <defs><pattern id="iron" width="40" height="30" patternUnits="userSpaceOnUse"><path fill="none" stroke="#AC9B86" strokeWidth=".8" opacity=".85" d="M0 13C10 3 20 3 20 13S30 23 40 13M20 13c-4 0-5-4-2-5 2 0 3 2 1 3M0 13c4 0 5 4 2 5-2 0-3-2-1-3M40 13c-4 0-5 4-2 5 2 0 3-2 1-3"/></pattern></defs>
          <path d="M0 13H390" stroke="#40101D" strokeWidth="12"/><rect x="0" y="0" width="390" height="30" fill="url(#iron)"/>
          <path fill="#40101D" stroke="#AC9B86" d="M195 2c9 0 17 5 20 11-3 6-11 11-20 11s-17-5-20-11c3-6 11-11 20-11z"/>
          <path fill="none" stroke="#AC9B86" d="M195 19c-3-3-3-8 0-11 3 3 3 8 0 11zM195 19c-5 0-8-3-9-7 4 0 7 3 9 7zM195 19c5 0 8-3 9-7-4 0-7 3-9 7z"/>
        </svg>
        <div className="dock-label">
          {theme === 'hall' ? <React.Fragment><span>New acquisition</span><span>To shelve as Nº {pad(nextNo)}</span></React.Fragment>
            : theme === 'dispatch' ? <React.Fragment><span>New session Nº {pad(nextNo)}</span><span>one link · nothing else</span></React.Fragment>
            : <span>{room.dock} · Nº {pad(nextNo)}</span>}
        </div>
        <div className="save-row">
          <input ref={inputRef} type="text" inputMode="url" aria-label="Link to save" placeholder="paste a link…" value={inputVal}
            onChange={e=>{ setInputVal(e.target.value); setSaveError(''); }} onKeyDown={e=>{ if(e.key==='Enter') handleSaveClick(); }} />
          <button className="save-btn" onClick={handleSaveClick} disabled={saving}>{saving ? '···' : 'Catch'}</button>
        </div>
        {saveError && <div className="save-error" role="alert">{saveError}</div>}
        <div className="fine">One link at a time — kept until you need it.</div>
        <div className="detail-row">
          <input type="text" aria-label="Name (optional)" placeholder="name it (optional)…" value={nameVal}
            onChange={e=>setNameVal(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') handleSaveClick(); }} />
          <select aria-label="Folder" value={selectedFolder} onChange={e=>handleFolderSelectChange(e, setSelectedFolder)}>
            <option value="">No folder</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            <option value="__new__">+ New folder…</option>
          </select>
        </div>
      </div>}

      <div className="search-row">
        <input type="text" aria-label="Search the archive" placeholder="search the archive…" value={query} onChange={e=>setQuery(e.target.value)} />
        <button className="filter-toggle" aria-expanded={showFilters} onClick={()=>setShowFilters(v=>!v)}>
          {filtersActive && <span className="pip"></span>}Filter
        </button>
        <button className="filter-toggle menu-icon" aria-label="Menu: room, lighting, account" onClick={()=>setShowMenu(true)}>
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M1 2h16M1 7h16M1 12h16"/></svg>
        </button>
      </div>
      {!showFilters && filtersActive && (
        <div className="filter-summary">Showing {statusFilter === 'all' ? 'all' : statusFilter === 'unread' ? 'unread' : 'read'}, {sortMode === 'alphabetical' ? 'A–Z' : sortMode + ' first'}</div>
      )}
      {showFilters && <React.Fragment>
        {!SHELF && <React.Fragment><div className="row-label">Status</div>
        <div className="chips">
          {[['all','all'],['unread','unread'],['read','read']].map(([f,label]) => (
            <button key={f} className="chip" aria-pressed={statusFilter===f} onClick={()=>setStatusFilter(f)}>
              {label}{f==='unread' && unreadCount>0 ? ` · ${unreadCount}` : ''}
            </button>
          ))}
        </div>
        </React.Fragment>}
        <div className="row-label">Sort</div>
        <div className="chips">
          {[['newest','newest'],['oldest','oldest'],['alphabetical','A–Z']].map(([v,label]) => (
            <button key={v} className="chip" aria-pressed={sortMode===v} onClick={()=>setSortMode(v)}>{label}</button>
          ))}
        </div>
  {!SHELF && <React.Fragment><div className="row-label">Folders</div>
        <div className="catalog">
          <button className="card" aria-pressed={folderFilter==='all'} onClick={()=>setFolderFilter('all')}>
            <div className="fname">All</div><div className="fcount">{links ? links.length : 0}</div>
          </button>
          {folders.map(f => (
            <button key={f.id} className="card" aria-pressed={folderFilter===f.id} onClick={()=>setFolderFilter(f.id)}>
              <div className="fname">{f.name}</div><div className="fcount">{links ? links.filter(l=>l.folderId===f.id).length : 0}</div>
            </button>
          ))}
          <button className="card" aria-label="New folder" onClick={createFolder}><div className="fname">+ new</div></button>
        </div></React.Fragment>}
      </React.Fragment>}

      </div>
      <div className="desk-main">
      {theme === 'dispatch' && links && links.length > 0 && (
        <div className="dp-meta"><span>Section A · {pad(Math.min(...links.map(l=>l.sessionNo)))}–{pad(nextNo + 2)}</span><i></i><b style={{ fontWeight:400 }}>{countText}</b></div>
      )}
      <main className="room">
        {links === null && <div className="empty">opening the archive…</div>}
        {links !== null && links.length === 0 && (
          <div className="empty">Nothing caught yet. Paste a link and it becomes Session 001.</div>
        )}
        {links !== null && links.length > 0 && visible.length === 0 && (
          <div className="empty">Nothing in the collection matches that.<br/>
            <button className="clear-btn" onClick={()=>{ setQuery(''); setStatusFilter('all'); setFolderFilter('all'); }}>Clear search &amp; filters</button>
          </div>
        )}
        {links !== null && visible.length > 0 && <React.Fragment>
          <div className="room-label">{room.label}</div>
          {theme === 'oxblood' && Salon()}
          {theme === 'hall' && Shelves()}
          {theme === 'dispatch' && Stamps()}
        </React.Fragment>}
      </main>

      {links !== null && links.length > 0 && (
        <div className="count-footer">{countText}</div>
      )}
      </div>
      </div>

      {selectedLink && (
        <div className="overlay" onClick={closeSheet}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={displayTitle(selectedLink)} onClick={e=>e.stopPropagation()}>
            <div className="num">Session {pad(selectedLink.sessionNo)} · {selectedLink.read ? 'Read' : 'Unread'}</div>
            <h2><a href={selectedLink.url} target="_blank" rel="noopener noreferrer">{displayTitle(selectedLink)}</a></h2>
            <div className="url">{selectedLink.url.replace(/^https?:\/\//,'')}</div>
            <div className="pic-row">
              <div className="pic"><Motif k={artOf(selectedLink)} /></div>
              <div>
                <div>{ART && (ART.subjects[artOf(selectedLink)] || ART.subjects.key).label}</div>
                <button className="ghost" onClick={()=>setShowPicker(v=>!v)} aria-expanded={showPicker}>{showPicker ? 'Done' : 'Change picture'}</button>
              </div>
            </div>
            {showPicker && ART && (
              <div className="picker">
                <button aria-pressed="false" onClick={()=>setArt(selectedLink.id, null)}>
                  <Motif k={autoArt(selectedLink)} />Suggested
                </button>
                {ART.order.map(k => (
                  <button key={k} aria-pressed={artOf(selectedLink)===k} onClick={()=>setArt(selectedLink.id, k)}>
                    <Motif k={k} />{ART.subjects[k].label}
                  </button>
                ))}
              </div>
            )}
            <div className="edit-row">
              <input type="text" aria-label="Name" placeholder="name it…" value={editName} onChange={e=>setEditName(e.target.value)} />
              <select aria-label="Folder" value={editFolder} onChange={e=>handleFolderSelectChange(e, setEditFolder)}>
                <option value="">No folder</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                <option value="__new__">+ New folder…</option>
              </select>
            </div>
            <div className="actions">
              <button className="primary" onClick={()=>saveEdit(selectedLink.id)}>Save changes</button>
              {savedFlash && <span className="saved" role="status">Saved.</span>}
              <button onClick={()=>toggleRead(selectedLink.id)}>{selectedLink.read ? 'Mark unread' : 'Mark read'}</button>
              <button onClick={closeSheet}>Close</button>
              {confirmDelete ? (
                <div className="confirm">
                  <span>Delete for good?</span>
                  <button className="primary" onClick={()=>{ setConfirmDelete(false); removeLink(selectedLink.id); }}>Yes, delete</button>
                  <button onClick={()=>setConfirmDelete(false)}>Keep</button>
                </div>
              ) : (
                <button className="danger" onClick={()=>setConfirmDelete(true)}>Delete</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showMenu && (
        <div className="overlay" onClick={()=>setShowMenu(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Menu" onClick={e=>e.stopPropagation()}>
            <div className="num">Room</div>
            <div className="opts">{THEMES.map(([k,label]) => <button key={k} aria-pressed={theme===k} onClick={()=>chooseTheme(k)}>{label}</button>)}</div>
            <div className="num">Lighting</div>
            <div className="opts">{[['auto','Auto'],['day','Day'],['night','Night']].map(([k,label]) => (
              <button key={k} aria-pressed={modePref===k} onClick={()=>{ setModePref(k); writeJSON('catch:mode', k); }}>{label}</button>))}</div>
            {!SHELF && folders.length > 0 && <React.Fragment>
              <div className="num">Shared folders</div>
              <p className="who">Share a folder to give someone a link to just that folder. They can look and open links, but not change anything or see the rest of your archive.</p>
              <div className="share-list">
                {folders.map(f => (
                  <div key={f.id} className="share-row">
                    <span>{f.name}{shares && shares[f.id] ? <em> · shared</em> : ''}</span>
                    {shares === null ? null : shares[f.id]
                      ? <React.Fragment><button onClick={()=>hand(shelfLink(shares[f.id]), f.name)}>Copy link</button><button onClick={()=>stopSharing(f)}>Stop sharing</button></React.Fragment>
                      : <button onClick={()=>shareFolder(f)}>Share</button>}
                  </div>
                ))}
              </div>
              {shareNote && <p className="who" role="status">{shareNote}</p>}
            </React.Fragment>}
            {!SHELF && <React.Fragment>
              <div className="num">iPhone Shortcut</div>
              {SHORTCUT_LINK ? <React.Fragment>
                <p className="who">Catch links from any app's Share button, without opening a browser.</p>
                {shortcutReady ? <React.Fragment>
                  <p className="who">Your private key is copied. Tap below, and when the Shortcuts app asks for your Catch key, tap the box, then Paste, then Add Shortcut.</p>
                  <div className="opts"><a className="bookmarklet" href={SHORTCUT_LINK} target="_blank" rel="noopener">Install the Shortcut</a></div>
                </React.Fragment> : !shortcutKey && <div className="opts"><button onClick={addToIphone}>Add to iPhone</button></div>}
                <p className="who small">Setting it up again gives you a new key and switches the old one off, so set up every device at the same time.</p>
              </React.Fragment> : <p className="who">Your Shortcut needs a private key to save into your archive without opening a browser.</p>}
              {shortcutKey ? <React.Fragment>
                <div className="key-box" aria-label="Your Shortcut key">{shortcutKey}</div>
                <p className="who">This is shown only once, so copy it now and keep it private. Making a new key switches this one off.</p>
                <div className="opts"><button onClick={copyShortcutKey}>Copy key</button></div>
              </React.Fragment> : !SHORTCUT_LINK && <div className="opts"><button onClick={makeShortcutKey}>Make a Shortcut key</button></div>}
              {shortcutNote && <p className="who" role="status">{shortcutNote}</p>}
            </React.Fragment>}
            {!SHELF && desk && <React.Fragment>
              <div className="num">Catch button for your browser</div>
              <p className="who">Drag this button up to your bookmarks bar. Then, on any web page, click it to catch that page.</p>
              <div className="opts"><a className="bookmarklet" ref={el => el && el.setAttribute('href', bookmarklet())} onClick={e => { e.preventDefault(); }}
                title="Drag me to your bookmarks bar">+ Catch</a></div>
            </React.Fragment>}
            {!SHELF && <React.Fragment><div className="num">Account</div>
            <p className="who">Signed in as {session && session.email}</p></React.Fragment>}
            <div className="actions">
              {!SHELF && <button onClick={signOut}>Sign out</button>}
              <button onClick={()=>{ setShowMenu(false); setShowPrivacy(true); }}>About your data</button>
              <button className="primary" onClick={()=>setShowMenu(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
      {showPrivacy && <PrivacyModal onClose={()=>setShowPrivacy(false)} />}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
// lets the app open without a connection (see sw.js)
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.error(e));
