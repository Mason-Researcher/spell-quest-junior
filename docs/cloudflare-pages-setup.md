# Cloudflare Pages Setup

## Preferred Automatic Deployment

The repository uses GitHub Actions for production deployment because it is explicit, version locked, and does not depend on the Cloudflare Pages GitHub App state.

Required GitHub repository secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

The workflow file is:

```text
.github/workflows/cloudflare-pages.yml
```

It deploys with:

```text
npm run deploy
```

## Cloudflare Pages Project Settings

Use these settings for the `spell-quest-junior` Pages project:

```text
Framework preset: None
Build command: leave empty
Build output directory: site
Root directory: /
Production branch: main
```

The production URL will look like:

```text
https://spell-quest-junior.pages.dev/
```

## Optional Cloudflare Git App Deployment

Cloudflare Dashboard can also deploy by connecting Pages directly to GitHub:

1. In Cloudflare Dashboard, open Workers & Pages.
2. Choose Pages, then Connect to Git.
3. Select the `spell-quest-junior` repository.
4. Apply the same project settings above.

If Cloudflare returns an internal Git installation error, uninstall and reinstall the Cloudflare Pages GitHub App, then retry from the Dashboard.

## Future Audio Expansion

For a small first release, MP3 files can live under:

```text
site/assets/audio/generated/
```

If the audio library grows too large for a clean Git repository, move MP3 files to Cloudflare R2 and update only:

```text
site/data/audio-manifest.json
```
