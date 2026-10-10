# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Right now: one person (the owner), who saves links on the go and comes back to them later. Mostly used on iPhone as a home-screen app. The owner wants it to work equally well on phone and computer, and is open to sharing it publicly if it proves interesting.

## Product Purpose

Catch is a personal "read it later" archive. Paste a link, optionally name it and file it in a folder, and find it again later. Its tagline: "Paste it, find it later. Nothing else." Success means saving is quick and finding things later is easy.

## Positioning

Saved links are shown as numbered "sessions" — book spines on library shelves, filed in folder cards — not as a plain list. The archive/library character is part of why the owner values it.

## Operating Context

- Saving often happens quickly on a phone, sometimes through a share link (`?url=…&title=…`).
- Browsing happens later: search, filter by read/unread, sort, and filter by folder.
- Links sync across browsers and devices through a Supabase database.

## Capabilities and Constraints

- Single static `index.html` (React + in-browser Babel from a CDN). No build step.
- Features: save link with optional name and folder, folders, search, status filter (all/unread/read), sort (newest/oldest/A–Z), mark closed/reopen, rename/refile, delete, two themes (Leather, Sage), privacy note.
- No login or per-user accounts. The database key in the page is public by design, so anyone with it could read or change the data. **Open decision:** going public would first require real accounts and access control (the in-app privacy note says the same).

## Brand Commitments

- Name "Catch", wordmark "Session Log", tagline "Paste it, find it later. Nothing else."
- Vocabulary: links are "sessions", read links are "closed", the collection is "the archive".
- The bookshelf/archive look and the Leather and Sage themes matter to the owner.

## Evidence on Hand

No testimonials, users, or usage numbers yet. Do not invent any.

## Product Principles

1. Saving must stay quick: one paste, one tap.
2. Finding should be as pleasant as saving.
3. The archive character is the product, not decoration to remove.
4. Phone first, but equally good on a computer.
5. Be honest about privacy. Don't present it as public-ready until accounts exist.
