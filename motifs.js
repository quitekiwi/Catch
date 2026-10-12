/* Catch — picture library.
   Each saved link gets a small line illustration picked from its URL + title.
   SVG strings are inner markup for viewBox "0 0 64 52". The host element sets
   stroke="currentColor", fill="none", stroke-width 1.3, round caps/joins. */
(function () {
  'use strict';

  var F = ' fill="currentColor"';

  // 4x4 drum pads, built once
  var pads = '';
  for (var r = 0; r < 4; r++) {
    for (var c = 0; c < 4; c++) pads += 'M' + (19 + c * 7) + ' ' + (20 + r * 6.5) + 'h5v4.5h-5z';
  }

  var subjects = {
    music: { label: 'Music', svg:
      '<rect x="12" y="36" width="24" height="10" rx="1.5"/>' +
      '<ellipse cx="24" cy="36" rx="9" ry="1.6"/>' +
      '<path d="M24 34V30l6-3M30 27C34 18 41 12 50 9c3 8 0 16-6 20-5-1-10-1-14-2z"/>' +
      '<circle cx="46" cy="40" r="1.6"' + F + '/><path d="M47.6 40v-7c2 0 4 1 5 3"/>' +
      '<circle cx="54" cy="24" r="1.3"' + F + '/><path d="M55.3 24v-6c1.5 0 3 1 3.5 2.5"/>' +
      '<path d="M8 20q2-2 4 0q2-2 4 0"/>' },

    synth: { label: 'Instruments', svg:
      '<rect x="8" y="14" width="48" height="26" rx="2.5"/><path d="M8 25h48"/>' +
      '<circle cx="14" cy="19.5" r="2"/><circle cx="21" cy="19.5" r="2"/><circle cx="28" cy="19.5" r="2"/>' +
      '<path d="M38 17v5M44 17v5M50 17v5"/><circle cx="44" cy="19" r="1"' + F + '/>' +
      '<path d="M14 25v15M20 25v15M26 25v15M32 25v15M38 25v15M44 25v15M50 25v15"/>' +
      '<path d="M12.8 25h2.4v8h-2.4zM18.8 25h2.4v8h-2.4zM30.8 25h2.4v8h-2.4zM36.8 25h2.4v8h-2.4zM42.8 25h2.4v8h-2.4z"' + F + '/>' +
      '<path d="M14 40l-2 6M50 40l2 6"/>' },

    beats: { label: 'Beats & samplers', svg:
      '<rect x="13" y="6" width="38" height="42" rx="3"/>' +
      '<rect x="18" y="10" width="17" height="6" rx="1"/><circle cx="44" cy="13" r="3"/>' +
      '<path d="' + pads + '"/><path d="M40 39.5h5V44h-5z"' + F + '/>' },

    video: { label: 'Video', svg:
      '<circle cx="15" cy="16" r="6"/><circle cx="29" cy="14" r="7"/>' +
      '<circle cx="15" cy="16" r="1"' + F + '/><circle cx="29" cy="14" r="1"' + F + '/>' +
      '<rect x="9" y="23" width="25" height="13" rx="2"/><rect x="34" y="26" width="5" height="7"/>' +
      '<path d="M39 27l18-7M39 32l18 7" stroke-dasharray="1.5 2.5"/>' +
      '<path d="M21 36l-5 10M21 36l5 10M21 36v10"/>' },

    film: { label: 'Films & TV', svg:
      '<path d="M6 22h26v6a3 3 0 0 0 0 6v6H6v-6a3 3 0 0 0 0-6z"/>' +
      '<path d="M26 23v16" stroke-dasharray="1.5 2"/><path d="M15 28l1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z"/>' +
      '<path d="M37 22l4 24h12l4-24zM43 22l1.5 24M51 22l-1.5 24"/>' +
      '<circle cx="40" cy="19" r="3"/><circle cx="46.5" cy="17" r="3.5"/><circle cx="53" cy="19" r="3"/><circle cx="44" cy="12" r="2.5"/>' },

    podcast: { label: 'Podcasts & radio', svg:
      '<path d="M14 46V24C14 10 44 10 44 24v22z"/>' +
      '<path d="M20 34v-9c0-9 18-9 18 0v9zM25 20v14M29 18.5V34M33 20v14"/>' +
      '<circle cx="23" cy="40" r="2"/><circle cx="35" cy="40" r="2"/>' +
      '<path d="M16 46v2M42 46v2M50 18q3 4 0 8M54 14q5 8 0 16"/>' },

    map: { label: 'Maps & places', svg:
      '<path d="M6 12l16-4 18 4 18-4v32l-18 4-18-4-16 4z"/><path d="M22 8v32M40 12v32"/>' +
      '<path d="M11 36c6-8 13-2 17-9s11-9 17-8" stroke-dasharray="2 2.5"/>' +
      '<path d="M47 15l5 5M52 15l-5 5"/><circle cx="11" cy="36" r="1.3"' + F + '/>' +
      '<path d="M14 15l2-4 2 4zM16 15v2"/>' },

    travel: { label: 'Travel', svg:
      '<path d="M32 5C19 5 14 17 18 25c3 5 9 8 10 11h8c1-3 7-6 10-11 4-8-1-20-14-20z"/>' +
      '<path d="M32 5c-6 8-6 22-4 31M32 5c6 8 6 22 4 31"/>' +
      '<path d="M28 36l1 4M36 36l-1 4"/><rect x="28" y="40" width="8" height="6" rx="1"/>' +
      '<path d="M47 33q2-2 4 0q2-2 4 0M8 40q0-4 4-3q2-4 6-1q4 0 3 4z"/>' },

    food: { label: 'Food & recipes', svg:
      '<path d="M14 27h36v13c0 5-4 6-8 6H22c-4 0-8-1-8-6z"/><path d="M11 27h42M14 31h-4M50 31h4"/>' +
      '<path d="M40 27l7-16"/><path d="M47 11q1-3 4-1.5"/>' +
      '<path d="M22 21c-2-3 2-5 0-8M28 20c-2-3 2-5 0-8M34 21c-2-3 2-5 0-8"/>' },

    drink: { label: 'Drinks', svg:
      '<path d="M22 7h20c0 14-4 21-10 21s-10-7-10-21z"/><path d="M23 15c6 2 12-2 18 0"/>' +
      '<path d="M32 28v14M24 45q8-4 16 0"/>' +
      '<circle cx="34" cy="21" r="1.2"/><circle cx="47" cy="15" r="1.6"/><circle cx="51" cy="9" r="1"/>' },

    shop: { label: 'Shopping', svg:
      '<rect x="12" y="20" width="40" height="26" rx="1.5"/><path d="M32 20v26M12 31h40"/>' +
      '<path d="M32 20c-6-8-12-6-8-1 2 2 6 1 8 1 2 0 6 1 8-1 4-5-2-7-8 1z"/>' +
      '<path d="M32 20l-4 6M32 20l4 6"/><path d="M44 38l6-4" stroke-dasharray="1 2"/>' },

    fashion: { label: 'Fashion', svg:
      '<ellipse cx="26" cy="24" rx="14" ry="3"/><path d="M18 23c0-11 16-11 16 0M18.5 19.5h15"/>' +
      '<path d="M34 18c4-6 9-8 12-11"/><path d="M26 27v19M20 46h12"/>' +
      '<path d="M41 46v-9q0-2 1.5 0v-3q0-2 1.5 0v-1q0-2 1.5 0v1q0-2 1.5 0v6l2-2q2 0 1 2l-3 6z"/>' },

    art: { label: 'Art & design', svg:
      '<path d="M29 8C14 8 6 20 9 31c3 10 14 15 22 13 6-1 4-8 8-9 6-1 14 1 16-7 2-12-10-20-26-20z"/>' +
      '<circle cx="44" cy="25" r="3"/><circle cx="19" cy="18" r="2.5"/><circle cx="29" cy="14" r="2.5"' + F + '/>' +
      '<circle cx="16" cy="29" r="2.5"/><circle cx="24" cy="37" r="2.5"/>' +
      '<path d="M38 46l16-18M54 28c3-5 3-7 2-8-3 0-5 2-5 5"/>' },

    photo: { label: 'Photography', svg:
      '<rect x="8" y="18" width="48" height="26" rx="3"/><path d="M22 18l3-6h14l3 6"/>' +
      '<circle cx="32" cy="31" r="9"/><circle cx="32" cy="31" r="5"/><circle cx="30" cy="29" r="1.2"' + F + '/>' +
      '<rect x="46" y="14" width="6" height="4" rx="1"/><rect x="12" y="22" width="6" height="4" rx="1"/>' },

    book: { label: 'Books', svg:
      '<path d="M6 42c6-3 12-3 17 0 5-3 11-3 17 0V26c-6-3-12-3-17 0-5-3-11-3-17 0z"/><path d="M23 26v16"/>' +
      '<path d="M10 31q4-1.5 9 0M10 35q4-1.5 9 0M27 31q4-1.5 9 0M27 35q4-1.5 9 0"/>' +
      '<rect x="47" y="25" width="6" height="17" rx="1"/><path d="M44 44h12"/>' +
      '<path d="M50 22c-3-4 0-7 0-9 1 2 3 5 0 9z"/>' },

    news: { label: 'Articles & news', svg:
      '<path d="M12 10h34v32q0 4 4 4H16q-4 0-4-4z"/><path d="M46 16h6v27q0 3-3 3"/>' +
      '<path d="M17 16h24M17 20h24"/><rect x="17" y="24" width="10" height="8"/>' +
      '<path d="M30 25h11M30 28h11M30 31h11M17 36h24M17 39h24M17 42h16"/>' },

    writing: { label: 'Writing & notes', svg:
      '<path d="M24 28h12M25 28v4c-3 1-6 2-6 6v8h22v-8c0-4-3-5-6-6v-4"/>' +
      '<path d="M30 33L56 5"/><path d="M34 28C37 16 46 9 56 5c-2 9-10 19-20 23z"/>' +
      '<path d="M42 17l4 3M47 12l3 3"/><circle cx="14" cy="44" r="1.2"' + F + '/>' },

    learn: { label: 'Learning', svg:
      '<circle cx="31" cy="22" r="13"/><ellipse cx="31" cy="22" rx="5.5" ry="13"/><path d="M18 22h26M20 15h22M20 29h22"/>' +
      '<path d="M44 6A18 18 0 0 1 31 40M31 40v4M23 47q8-6 16 0z"/>' },

    space: { label: 'Science & space', svg:
      '<path d="M14 31l29-16 3 6-29 16zM14 31l-4 2 2 4 5-0M43 15l4-2 3 6-4 2"/>' +
      '<path d="M30 28l-8 18M30 28l8 18M30 28v18"/>' +
      '<path d="M53 30l1 3 3 1-3 1-1 3-1-3-3-1 3-1z"/>' +
      '<circle cx="10" cy="10" r="1"' + F + '/><circle cx="22" cy="8" r="1"' + F + '/><circle cx="56" cy="8" r="1"' + F + '/><circle cx="34" cy="6" r=".8"' + F + '/>' },

    nature: { label: 'Nature', svg:
      '<rect x="15" y="31" width="24" height="3.5" rx="1"/><path d="M17 34.5h20l-2 11.5H19z"/>' +
      '<path d="M27 31c0-9-4-16-12-20M27 31c2-11 8-18 16-20M27 31c0-8 0-15 3-24"/>' +
      '<path d="M20 15l-3 2M23 20l-3 2M37 15l2 2M33 20l3 1M29 13l-3-1"/>' +
      '<circle cx="50" cy="42" r="4"/><path d="M50 42a1.5 1.5 0 1 1 1.5 1.5M43 46h12c2 0 3-2 2-4M57 42l1-4M57 42l3-3"/>' },

    code: { label: 'Code', svg:
      '<circle cx="23" cy="29" r="9"/><circle cx="23" cy="29" r="10.5" stroke-width="3" stroke-dasharray="2.75 2.75"/>' +
      '<path d="M23 21v16M15 29h16"/><circle cx="23" cy="29" r="2"' + F + '/>' +
      '<circle cx="44" cy="17" r="6"/><circle cx="44" cy="17" r="7.5" stroke-width="2.6" stroke-dasharray="2.36 2.36"/><circle cx="44" cy="17" r="1.6"/>' +
      '<circle cx="46" cy="38" r="4"/><circle cx="46" cy="38" r="5.3" stroke-width="2.4" stroke-dasharray="2.08 2.08"/>' },

    ai: { label: 'AI & tech', svg:
      '<rect x="18" y="16" width="28" height="23" rx="5"/><path d="M32 16V9"/><circle cx="32" cy="7" r="2"/>' +
      '<path d="M27 5l-2-1M37 5l2-1"/><circle cx="26" cy="26" r="4"/><circle cx="38" cy="26" r="4"/>' +
      '<circle cx="27.3" cy="24.8" r="1.5"' + F + '/><circle cx="39.3" cy="24.8" r="1.5"' + F + '/>' +
      '<path d="M27 34h10M30 33v2M34 33v2"/><rect x="14" y="23" width="4" height="8" rx="1"/><rect x="46" y="23" width="4" height="8" rx="1"/>' +
      '<path d="M28 39v4M36 39v4M22 46q10-5 20 0"/>' },

    tool: { label: 'Apps & tools', svg:
      '<circle cx="32" cy="7" r="3"/><rect x="30" y="10" width="4" height="4" rx="1"/>' +
      '<circle cx="32" cy="29" r="15"/><circle cx="32" cy="29" r="12.5"/>' +
      '<path d="M32 29v-9M32 29l6 3M32 18.5v2M42.5 29h-2M32 39.5v-2M21.5 29h2"/><circle cx="32" cy="29" r="1.2"' + F + '/>' +
      '<path d="M46 34c6 2 8 8 6 12" stroke-dasharray="1.5 2"/>' },

    game: { label: 'Games', svg:
      '<rect x="8" y="24" width="20" height="20" rx="3"/>' +
      '<circle cx="13" cy="29" r="1.6"' + F + '/><circle cx="18" cy="34" r="1.6"' + F + '/><circle cx="23" cy="39" r="1.6"' + F + '/>' +
      '<path d="M36 46h20v-3H36z"/><path d="M38 43c0-7 6-9 4-15l-6 2c-2-2 0-6 4-10 2-4 6-6 8-8l1 3c5 3 7 11 5 28"/>' +
      '<path d="M48 18c3 6 4 14 2 22M47 12l1-3"/><circle cx="44" cy="20" r="1"' + F + '/>' },

    sport: { label: 'Sport & fitness', svg:
      '<path d="M14 6v41M14 8l30 8-30 8z"/><path d="M19 13l2 5-2 4" stroke-dasharray="1 1.6"/>' +
      '<circle cx="44" cy="38" r="8"/><path d="M44 35l3 2-1 3.5h-4l-1-3.5zM44 35v-5M47 37l4.5-2M46 40.5l2.5 4M42 40.5l-2.5 4M41 37l-4.5-2"/>' +
      '<path d="M8 47h48"/>' },

    health: { label: 'Health', svg:
      '<rect x="26" y="6" width="12" height="5" rx="1"/>' +
      '<path d="M27 11v7c-9 4-11 10-11 16v10q0 3 3 3h26q3 0 3-3V34c0-6-2-12-11-16v-7"/>' +
      '<rect x="22" y="30" width="20" height="11" rx="1"/><path d="M32 32.5v6M29 35.5h6"/><path d="M27 22q-3 2-4 5"/>' },

    money: { label: 'Money & business', svg:
      '<path d="M12 24h40c2 12-4 22-20 22S10 36 12 24z"/><path d="M14 24c0-6 8-8 18-8s18 2 18 8"/>' +
      '<circle cx="29" cy="14" r="2.2"/><circle cx="35" cy="14" r="2.2"/>' +
      '<circle cx="55" cy="43" r="3.5"/><circle cx="55" cy="43" r="1"' + F + '/><path d="M24 32q8 4 16 0"/>' },

    job: { label: 'Jobs & careers', svg:
      '<rect x="10" y="18" width="44" height="28" rx="3"/><path d="M26 18v-5q0-2 2-2h8q2 0 2 2v5M10 28h44"/>' +
      '<rect x="29" y="26" width="6" height="5" rx="1"/>' +
      '<circle cx="14" cy="42" r=".9"' + F + '/><circle cx="50" cy="42" r=".9"' + F + '/>' },

    social: { label: 'Social', svg:
      '<circle cx="34" cy="17" r="6"/><path d="M40 15c4 0 4 5 1 6l-2-2"/><circle cx="35" cy="16" r="1.1"' + F + '/>' +
      '<path d="M31 22c-7 3-9 12-4 18 4 1 9-1 10-7 1-4 1-8-1-11"/><path d="M29 27c4 2 5 7 3 11"/>' +
      '<path d="M27 40l-4 7M30 41l-2 7"/><path d="M12 42h42"/><path d="M48 10l4-2M48 14h5M48 18l4 2"/>' },

    mail: { label: 'Messages & newsletters', svg:
      '<rect x="8" y="12" width="48" height="30" rx="2"/><path d="M8 14l24 16 24-16M8 42l18-14M56 42L38 28"/>' +
      '<circle cx="32" cy="30" r="5"/><circle cx="32" cy="30" r="2"' + F + '/>' +
      '<path d="M29 34l-2 6 3-2M35 34l2 6-3-2"/>' },

    event: { label: 'Events & tickets', svg:
      '<path d="M6 14h52v8a4 4 0 0 0 0 8v8H6v-8a4 4 0 0 0 0-8z"/><path d="M44 15v22" stroke-dasharray="1.5 2"/>' +
      '<path d="M24 19l1.8 3.6 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z"/>' +
      '<path d="M49 22h4M49 26h5M49 30h4"/>' },

    home: { label: 'Home & interiors', svg:
      '<path d="M14 32V20c0-6 20-6 20 0v12"/>' +
      '<path d="M9 28q0-3 3-3t3 3v12H9zM33 28q0-3 3-3t3 3v12h-6zM15 34h18v6H15zM11 40v4M37 40v4"/>' +
      '<path d="M50 18v26M45 46h10M44 18h12l-3-10h-6z"/><path d="M54 18v4"/><circle cx="54" cy="23" r=".9"' + F + '/>' },

    car: { label: 'Cars & transport', svg:
      '<path d="M8 36v-5q0-3 4-3h6l4-10h16l6 10h8q4 0 4 4v4H51M41 36H23M13 36H8"/>' +
      '<path d="M24 20l-3 8h9v-8zM32 20v8h9l-4-8z"/>' +
      '<circle cx="18" cy="37" r="5"/><circle cx="46" cy="37" r="5"/><circle cx="18" cy="37" r="1.2"' + F + '/><circle cx="46" cy="37" r="1.2"' + F + '/>' +
      '<circle cx="55" cy="31" r="1.3"/><circle cx="6" cy="33" r="1.5"/>' },

    mystic: { label: 'Mysticism', svg:
      '<path d="M35 4a8 8 0 1 0 4 13 6.5 6.5 0 1 1-4-13z"/>' +
      '<path d="M10 34q22-18 44 0-22 18-44 0z"/><circle cx="32" cy="34" r="7"/><circle cx="32" cy="34" r="3"' + F + '/>' +
      '<path d="M18 27l-2-3M25 24l-1-3.5M39 24l1-3.5M46 27l2-3"/>' +
      '<path d="M12 10l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8zM52 8l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>' +
      '<circle cx="48" cy="20" r=".9"' + F + '/><circle cx="17" cy="20" r=".9"' + F + '/>' },

    kids: { label: 'Kids & family', svg:
      '<path d="M8 42q24 12 48 0"/><rect x="18" y="26" width="26" height="9" rx="4.5"/>' +
      '<path d="M22 35l-3 10M26 35v11M37 35v11M41 35l3 10"/>' +
      '<path d="M42 28l4-12q1-4 6-2l4 4-4 2-4 2-2 7"/><path d="M47 13l1-4 2 4M46 16c-3 2-4 6-4 10M18 28c-6-2-6 6-8 8M30 26v9"/>' +
      '<circle cx="51" cy="16" r=".9"' + F + '/>' },

    idea: { label: 'Ideas & inspiration', svg:
      '<path d="M26 34c0-4-8-8-8-16 0-8 7-13 14-13s14 5 14 13c0 8-8 12-8 16z"/>' +
      '<path d="M27 37h10M27 40h10M29 43h6M28 27l2-6 2 4 2-4 2 6"/>' +
      '<path d="M53 32c-6-6-6 4 0 2 6 2 6-8 0-2zM53 30l-2-3M53 30l2-3M53 33v4"/>' +
      '<path d="M12 12l3 2M10 20h3M48 8l-2 3"/>' },

    key: { label: 'Anything else', svg:
      '<circle cx="15" cy="26" r="8"/><circle cx="15" cy="26" r="3"/>' +
      '<path d="M23 26h31M48 26v6h4v-6M42 26v4"/>' +
      '<path d="M29 26c-5-8 4-11 2-3zM29 26c5-8 9 1 2 2"/>' +
      '<path d="M29 26c-2 4 2 8-3 13M29 26c3 4-1 9 4 14"/>' }
  };

  var order = ['music', 'synth', 'beats', 'video', 'film', 'podcast', 'map', 'travel', 'food', 'drink',
    'shop', 'fashion', 'art', 'photo', 'book', 'news', 'writing', 'learn', 'space', 'nature', 'code',
    'ai', 'tool', 'game', 'sport', 'health', 'money', 'job', 'social', 'mail', 'event', 'home', 'car',
    'mystic', 'kids', 'idea', 'key'];

  // Matching rules, tested in this order (specific before generic).
  var rules = [
    ['mystic', /tarot|astrolog|zodiac|osiris|mystic|spirit|horoscope/],
    ['map', /maps\.google|google\.com\/maps|maps\.apple|openstreetmap|\bmaps?\b|terrain|\blocation|terraink/],
    ['beats', /\bmpc|drum|\bbeats?\b|sampler|\b808\b|akai/],
    ['synth', /roland|moog|korg|synth|keyboard|guitar|piano|plugin|\bvst|pedal/],
    ['music', /spotify|soundcloud|bandcamp|music\.apple|tidal|deezer|album|\bsongs?\b|playlist|lyrics|\bmusic/],
    ['podcast', /podcast|episode|\bradio|overcast|pocketcasts/],
    ['video', /youtube|youtu\.be|vimeo|twitch|tiktok/],
    ['film', /netflix|letterboxd|imdb|\bhbo|disney|trailer|\bfilms?\b|movie|\bseries\b/],
    ['event', /eventbrite|ticketmaster|dice\.fm|ticket|\bevents?\b|concert|festival/],
    ['travel', /airbnb|booking|expedia|skyscanner|tripadvisor|flight|hotel|\btrips?\b|travel/],
    ['drink', /\bwines?\b|coffee|cocktail|\bbeers?\b|\btea\b/],
    ['food', /recipe|\bcook|\bfood|restaurant|allrecipes|nytcooking|kitchen/],
    ['fashion', /fashion|outfit|sneaker|clothing|\bwear\b|streetwear|ssense|farfetch/],
    ['photo', /flickr|unsplash|\bphoto|camera|\bvsco/],
    ['art', /behance|dribbble|artstation|gallery|museum|\bdesign|\barts?\b|illustrat/],
    ['mail', /gmail|(^|[^a-z])mail\.|newsletter|\binbox|\bemail/],
    ['social', /twitter|(^|[^a-z0-9])x\.com|reddit|threads\.net|\bthreads\b|instagram|facebook|bsky|mastodon/],
    ['book', /goodreads|\bbooks?\b|\bnovels?\b|\bauthor|library/],
    ['kids', /\bbab(y|ies)\b|\bkids?\b|\btoys?\b|\bparent|\bfamil/],
    ['home', /interior|furniture|\bhome\b|apartment|ikea|decor/],
    ['car', /\bcars?\b|\bbikes?\b|\btrains?\b|\bauto\b|\bmotor|tesla/],
    ['space', /nasa|\bspace\b|science|physics|astronom/],
    ['nature', /\bplants?\b|garden|nature|animal|\bbirds?\b|flower/],
    ['health', /health|\bsleep|therapy|medical|wellness/],
    ['money', /\bbank|invest|financ|\bmoney|\bstocks?\b|crypto|startup|stripe/],
    ['job', /linkedin|indeed|\bjobs?\b|career|hiring|resume/],
    ['writing', /notion|docs\.google|\bnotes?\b|essay|\bwrit(e|ing)|journal/],
    ['ai', /openai|anthropic|claude|chatgpt|huggingface|\bai\b|robot|\bgpt|\btech/],
    ['code', /github|gitlab|stackoverflow|\bnpm|\bcode|\bapi\b|developer|\bdocs\b/],
    ['sport', /espn|strava|\bsports?\b|workout|fitness|football|\brun(s|ning)?\b/],
    ['learn', /wikipedia|coursera|udemy|khan|\bcourses?\b|tutorial|how to|\bguide|\blearn/],
    ['tool', /apps\.apple|play\.google|producthunt|\bapps?\b|\btools?\b|software/],
    ['game', /steampowered|\bsteam\b|itch\.io|epicgames|\bgam(e|es|ing)\b|\bplay\b/],
    ['idea', /pinterest|are\.na|inspiration|moodboard|\bideas?\b/],
    ['shop', /amazon|etsy|ebay|shopify|\bshop|\bstores?\b|\bbuy\b|\bcart\b|\bproducts?\b/],
    ['news', /nytimes|bbc|theguardian|\bcnn|reuters|medium\.com|substack|\bnews|article|\bblog/]
  ];

  function pick(url, title) {
    try {
      var u = String(url || '').toLowerCase().trim()
        .replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^www\./, '');
      var s = u + ' ' + String(title || '').toLowerCase();
      for (var i = 0; i < rules.length; i++) {
        if (rules[i][1].test(s)) return rules[i][0];
      }
    } catch (e) { /* fall through */ }
    return 'key';
  }

  window.CatchArt = { order: order, subjects: subjects, pick: pick };

  // Tiny self-check: set window.CATCH_ART_TEST = true before loading.
  if (window.CATCH_ART_TEST) {
    var cases = [
      ['https://roland50.studio', 'Roland Studio', 'synth'],
      ['https://ypc2000.fun', 'Vir MPC', 'beats'],
      ['https://osirisai.live', 'EyeOfOsiris', 'mystic'],
      ['https://terraink.app', 'Map', 'map'],
      ['https://example.com/x', 'Untitled', 'key']
    ];
    cases.forEach(function (t) {
      var got = pick(t[0], t[1]);
      if (got !== t[2]) console.warn('CatchArt: ' + t[0] + ' -> ' + got + ' (expected ' + t[2] + ')');
    });
    order.forEach(function (k) {
      if (!subjects[k] || !subjects[k].label || !subjects[k].svg) console.warn('CatchArt: missing ' + k);
    });
  }
})();
