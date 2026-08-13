# Boarding Pass No. 247 — HH Goa 2026 builder ID

Upload a photo, get issued a Hacker House Goa 2026 builder pass. One screen, no
account, no signup gate. Download it as a PNG or share it straight to X with a
pre-filled caption and `#FrameInGoa`.

Built for the HH Goa 2026 shortlisting task (Format B — Builder ID Card).

## Run it

```bash
npm install
npm run dev
```

## Environment

Both are optional — the app works without either, it just does less.

| Variable | What it does | Without it |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Absolute origin, e.g. `https://pass.hhgoa.com`. Used as the `metadataBase` for OG tags and to build the URL that goes in the share caption. | Falls back to `http://localhost:3000`, so link previews resolve against the wrong host. **Set this in production.** |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token. The generated PNG is uploaded speculatively in the background so a shared link already has the real card as its `og:image` by the time the X composer opens. | Publishing is skipped. Download still works, Share to X still works, but the caption goes out without a link — so no link preview at all rather than a wrong one. |

## Architecture, in one paragraph

The card is a single pure-SVG document built by `lib/card/renderCard.ts` — no
`<foreignObject>` anywhere. That constraint is the whole design: a pure-SVG
string rasterises identically through `ctx.drawImage()` in every browser
including iOS Safari, where `foreignObject` rasterisation is unreliable. The
same string drives the live preview, the PNG download and the share image, so
there is no second renderer to drift out of sync. SVG has no text wrapping and
no off-DOM measurement API, so every fit, wrap and justification is arithmetic
against the font metrics measured into `lib/card/metrics.ts`. Fonts are
inlined as base64 for export because a rasterised SVG loads in an isolated
context and would otherwise silently bake in a system fallback.

Everything on the card that isn't the photo or the two typed fields is derived
deterministically from `handle|stack` in `lib/identity.ts` — the same input
always produces the same pass. Two of the four stats are literally computed
from what the user typed rather than pulled from the hash, because the card
should not invent claims about a person it knows nothing about.

## Layout

```
app/page.tsx            the one screen: stage, pass, dock
app/api/publish/        speculative PNG upload for link previews
app/c/[id]/             the shared-pass page whose og:image is the real card
components/             UploadZone, CardPreview, Dock, TopBar, GoaScene
hooks/usePhotoFraming   drag / pinch / keyboard photo framing
lib/brand.ts            tokens lifted verbatim from hhgoa.com's stylesheet
lib/card/               the renderer, its metrics, fonts, and the गोवा outlines
lib/identity.ts         deterministic title, stats, tier, serial, MRZ
lib/photo.ts            decode, EXIF orientation, HEIC, downscale, cover-fit
lib/export.ts           card PNG (1080x1350) and link-preview PNG (1200x630)
lib/share.ts            caption weighting, Web Share L2, x.com intent fallback
```
