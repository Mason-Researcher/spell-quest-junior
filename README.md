# Spell Quest Junior

Cloudflare Pages deployment repository for the Grade 2 spelling practice website.

Production site:

```text
https://spell-quest-junior.pages.dev/
```

## Cloudflare Pages Settings

Use these settings when creating the Pages project:

```text
Framework preset: None
Build command: leave empty
Build output directory: site
Root directory: /
Production branch: main
```

## Local Preview

```powershell
cd site
python -m http.server 4173 --bind 127.0.0.1
```

Open:

```text
http://127.0.0.1:4173/
```

## Deploy

```powershell
npm run deploy
```

## Data Expansion

Runtime data is under:

```text
site/data/words.json
site/data/question-packs/
site/data/audio-manifest.json
```

All cards and exam questions must resolve to records in `site/data/words.json`.

## Audio Strategy

The website plays high-quality MP3 clips first through `site/data/audio-manifest.json`.
If no MP3 exists, the browser speech engine is used as fallback.
