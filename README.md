# GreenCoach

Free, local-first training tracker with an explainable smart coach. No accounts, no backend, no ads, no tracking. All data stays on your device.

**Status:** milestone 1 of 8 (scaffold, PWA, theme, EN/JA, storage, export/import). See [DECISIONS.md](DECISIONS.md).

## Development
```bash
npm install
npm run dev      # dev server
npm test         # unit tests
npm run build    # type-check + production build (incl. service worker)
npm run preview  # try the installable/offline build
```

## Data
Settings -> Data: export everything as one JSON file, import it (merge or replace), or delete all data. Clearing browser data deletes everything unless you exported it first.

## Deploy
`npm run build` produces a static site in `dist/` (relative paths, works on any subpath). Upload it to GitHub Pages, Cloudflare Pages or Netlify.
