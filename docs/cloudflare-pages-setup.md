# Cloudflare Pages Setup

1. Create a new GitHub repository, suggested name: `spell-quest-junior`.
2. Push this repository to GitHub.
3. In Cloudflare Dashboard, open Workers & Pages.
4. Choose Pages, then Connect to Git.
5. Select the `spell-quest-junior` repository.
6. Use these build settings:

```text
Framework preset: None
Build command: leave empty
Build output directory: site
Root directory: /
Production branch: main
```

7. Deploy.

The production URL will look like:

```text
https://spell-quest-junior.pages.dev/
```

## Future Audio Expansion

For a small first release, MP3 files can live under:

```text
site/assets/audio/generated/
```

If the audio library grows too large for a clean Git repository, move MP3 files to Cloudflare R2 and update only:

```text
site/data/audio-manifest.json
```

