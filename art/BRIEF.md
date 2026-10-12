# Catch picture library brief

Catch is a read-later app. Every saved link gets a small picture chosen by its subject. There are 3 visual "rooms";
each subject must be drawn in the style of the room you are assigned. Write ONLY the file named in your task. No other files.
After writing, validate with node that the file parses and every key you were given is present and non-empty
(e.g. `node -e "global.window={};require('/abs/path/file.js');console.log(Object.keys(window.X...))"`).

## Subjects (key — label — what to draw; keep it charming and slightly whimsical, readable at small size)
music — Music — gramophone with notes flying out like little birds
synth — Instruments — small synthesizer with keys and knobs
beats — Beats & samplers — drum machine / sampler with a 4x4 pad grid
video — Video — old film projector casting a beam
film — Films & TV — cinema ticket with a striped popcorn box
podcast — Podcasts & radio — antique arched radio with sound waves
map — Maps & places — folded treasure map, dotted route, an X
travel — Travel — hot-air balloon over little hills
food — Food & recipes — steaming pot with a ladle
drink — Drinks — wine glass (and a tiny bubble or a cork)
shop — Shopping — wrapped parcel with a big bow
fashion — Fashion — hat on a stand with a pair of gloves
art — Art & design — painter's palette and brush
photo — Photography — vintage bellows camera
book — Books — open book with a candle
news — Articles & news — folded newspaper
writing — Writing & notes — quill in an inkwell
learn — Learning — globe on a stand
space — Science & space — brass telescope under stars
nature — Nature — potted fern with a little snail
code — Code — clockwork gears
ai — AI & tech — curious little automaton head with an antenna
tool — Apps & tools — pocket watch
game — Games — die and a chess knight
sport — Sport & fitness — pennant flag and a ball
health — Health — apothecary bottle with a label
money — Money & business — coin purse with coins
job — Jobs & careers — briefcase
social — Social — chattering parrot on a perch
mail — Messages & newsletters — sealed letter with a wax seal
event — Events & tickets — theatre ticket stub
home — Home & interiors — armchair beside a lamp
car — Cars & transport — vintage car
mystic — Mysticism — an eye beneath a crescent moon with tiny stars
kids — Kids & family — rocking horse
idea — Ideas & inspiration — lightbulb with a moth fluttering near it
key — Anything else — a curious old key tied with a ribbon

## Room A — OXBLOOD (whimsical painted miniatures)
Study /Users/berhe/Desktop/PROJECTS/Catch/oxblood-art.js: it contains 4 approved paintings (synth, mystic, map, beats) — match their
quality, painterly look and humour exactly (lamp-lit scenes, soft light from one side, a playful touch like notes flying as birds, a cat asleep).
Each painting is SVG markup for a canvas box of [0,0,60,80] (portrait; it is shown cropped with object-fit "cover" inside oval, arched,
rectangular and cusped frames, so keep the subject centred within roughly x 8–52, y 12–68).
Use ONLY these colours: #1A1519 #40101D #73303C #D9B88F #AC9B86 (+ opacity). You may use these shared defs by id (already on the page):
gradients w-room w-glow w-shade w-cloth w-body w-keys w-night w-sclera w-iris w-land w-hill w-wax w-wine; filters w-brush (wrap the
painted background group in filter="url(#w-brush)"), w-canvas; vignette fill w-vig; symbols w-spk (sparkle), w-nt (note), w-bn (note-bird)
used via <use href="#w-nt" .../>. Structure like the examples: background (w-room + a w-glow light pool), table/cloth, the subject with
gradients and small dark shading, a whimsical touch, then `<rect width="60" height="80" filter="url(#w-canvas)" opacity=".2"/><rect width="60" height="80" fill="url(#w-vig)"/>`.
Each painting under ~2500 characters. Do NOT define new ids (no <defs>, no id= attributes).
Output file format (JS):
  Object.assign((window.OxbloodArt = window.OxbloodArt || { paintings:{} }).paintings, {
    music: { box:[0,0,60,80], svg:'...' }, ...
  });

## Room B — DISPATCH (engraved stamp drawings)
Fine single-weight line engravings like a postage stamp, drawn in khaki on a charcoal stamp face. Match these approved examples exactly
in weight and density (viewBox 0 0 62 52, stroke only, the host sets stroke="currentColor" fill="none" stroke-width 1, round caps):
synth: <path d="M5 30.5l52-.8.3 13.6-52.4.5z"/><path d="M11 30.3v13M17.2 30.4l.1 12.8M23.5 30v13.2M29.6 30.2v13M36 30.1l-.2 13M42.1 30v13.1M48.3 30.2v12.9"/><path d="M14.2 30.5v7.4h3.1v-7.5M26.6 30.3l.2 7.6 3-.1v-7.4M39 30.2v7.6h3M45.4 30.3l-.1 7.4 3 .1"/><path d="M6 30.4c.2-6.2.1-9 .4-11.8l50.3-.6.4 11.6"/><circle cx="13" cy="24" r="2.3"/><circle cx="21" cy="24.2" r="2.2"/><path d="M30 22h14.5M30.5 25.8l13.8-.2M49.5 21.4l3.6 5"/>
mystic: <path d="M4.6 26.4C13 14.2 22 9.8 31.3 10c9.6.1 18.4 5 26.4 16.3-8 11.4-17 15.6-26.6 15.4C21.6 41.6 12.4 37 4.6 26.4z"/><circle cx="31" cy="26" r="9.4"/><circle cx="31.2" cy="25.8" r="3.6" fill="currentColor"/><path d="M27.4 21.6l1.8 1.4"/><path d="M14.8 15l-2.6-4.4M22.4 11l-1.2-4.6M31 9.6V4.8M39.6 11l1.4-4.6M47.4 15.2l2.8-4.2"/><path d="M20 39.6c-1.2 4.4-.3 7.4 3 8.6"/>
Slightly hand-made (tiny wobbles in coordinates), engraved hatching for shade is welcome (short parallel lines), no fills except tiny solid
dots with fill="currentColor". Each drawing under ~900 characters. Output file format:
  window.DPDraw = Object.assign(window.DPDraw || {}, { music:'<path .../>...', ... });

## Room C — GREEN HALL (storybook emblems, our own style inspired by the hand-painted look of The Legend of Zelda: Breath of the Wild)
Do NOT copy any Nintendo symbol, logo, Sheikah eye, Hylian crest or game icon. Make original emblems: chunky, rounded, friendly
silhouettes with a clean bold outline and simple two-tone flat fills, like a storybook map icon or a carved wooden token.
They are shown SMALL (about 26px wide) inside a pale paper medallion, in dark olive. ViewBox 0 0 64 52. Use stroke="currentColor"
for outlines (the host sets stroke-width ~2.2, round caps) and for fills use fill="currentColor" with fill-opacity=".35" for the
shaded tone or fill="currentColor" for small solid accents. Keep each to 2–5 bold shapes (no thin detail lines, no hatching) so it reads at 26px.
Each emblem under ~700 characters. Output file format:
  window.GHEmblem = Object.assign(window.GHEmblem || {}, { music:'<path .../>...', ... });
