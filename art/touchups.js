/* Proposed redraws, kept separate until approved (see compare.html). Nothing in the app reads this file. */
window.TouchUps = {
  // Dispatch "key" stamp: one key on a diagonal, filling the stamp like the other engravings
  dpKeyA: '<g transform="rotate(-32 31 26)"><circle cx="12" cy="26" r="9.5"/><circle cx="12" cy="26" r="4.8"/><circle cx="12" cy="26" r=".9" fill="currentColor"/>'
    + '<path d="M21.5 24.4H54v3.2H21.5"/><path d="M24.6 22v8.4M27.6 22v8.4"/><path d="M42 27.6V37h3.2v-3.4H48V37h3.2v-9.4"/></g>',
  dpKeyB: '<g transform="rotate(-32 31 26)"><circle cx="12" cy="26" r="9.5"/><circle cx="12" cy="23.2" r="2.5"/><circle cx="12" cy="28.8" r="2.5"/><circle cx="9.2" cy="26" r="2.5"/><circle cx="14.8" cy="26" r="2.5"/>'
    + '<circle cx="12" cy="26" r=".9" fill="currentColor"/><path d="M21.5 24.4H54v3.2H21.5"/><path d="M24.6 22v8.4M27.6 22v8.4M30.6 23v6.4"/><path d="M42 27.6V37h3.2v-3.4H48V37h3.2v-9.4"/></g>',
  // Green Hall "money" emblem: one bold object instead of a purse squeezed beside coins
  ghMoneyA: '<path stroke="currentColor" fill="currentColor" fill-opacity=".35" d="M26 19C12 26 10 46 32 46S52 26 38 19z"/><path stroke="currentColor" fill="currentColor" fill-opacity=".35" d="M26 18q-2-5-6-8h24q-4 3-6 8z"/>'
    + '<path stroke="currentColor" fill="none" d="M24 19h16"/><circle stroke="currentColor" fill="none" cx="32" cy="33" r="5"/><path stroke="currentColor" fill="none" d="M32 30.5v5"/>',
  ghMoneyB: '<path stroke="currentColor" fill="currentColor" fill-opacity=".35" d="M10 26v14a12 4 0 0 0 24 0V26"/><ellipse stroke="currentColor" fill="currentColor" fill-opacity=".35" cx="22" cy="26" rx="12" ry="4"/>'
    + '<path stroke="currentColor" fill="none" d="M10 31a12 4 0 0 0 24 0M10 35.5a12 4 0 0 0 24 0"/><circle stroke="currentColor" fill="currentColor" fill-opacity=".35" cx="45" cy="30" r="11"/><circle stroke="currentColor" fill="none" cx="45" cy="30" r="6.5"/>',
  // Green Hall "game" emblem: one clear object instead of a die and a chess piece side by side
  ghGameA: '<path stroke="currentColor" fill="currentColor" fill-opacity=".35" d="M15 18h34q8 0 9 9l2 11q1 6-5 6-4 0-7-6l-2-3H18l-2 3q-3 6-7 6-6 0-5-6l2-11q1-9 9-9z"/>'
    + '<path stroke="currentColor" fill="none" d="M15 27h8M19 23v8"/><circle fill="currentColor" cx="43" cy="25" r="2.2"/><circle fill="currentColor" cx="48" cy="30" r="2.2"/>',
  ghGameB: '<g transform="translate(-24.4 -8.2) scale(1.2)"><path vector-effect="non-scaling-stroke" stroke="currentColor" fill="currentColor" fill-opacity=".35" d="M40 42c1-6 5-9 5-14l-5 2-4-4c2-7 8-13 15-14l1-3 3 3c4 4 5 16 3 30z"/>'
    + '<path vector-effect="non-scaling-stroke" stroke="currentColor" fill="currentColor" d="M37 42h21v4H37z"/><circle fill="currentColor" cx="47" cy="19" r="1.8"/></g>',
};
