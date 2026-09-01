# Troubleshooting

## False-positive Chrome console warnings in dev mode

**Related issue:** [#33](https://github.com/hutusi/amytis/issues/33)

When running `bun dev` and opening the site in Chrome with certain browser extensions installed, you may see two console messages that look like project bugs:

- **Error**: `Content Security Policy of your site blocks the use of eval in JavaScript.`
- **Warning**: `Deprecated feature used; the Shared Storage API is deprecated and will be removed in a future release.`

**These are not bugs in the project.** Investigation confirmed:

- The dev server sends no `Content-Security-Policy` header
- No meta CSP tag exists in the generated HTML
- No `eval()` or `new Function()` calls exist in the compiled JS chunks
- No `sharedStorage` references exist anywhere in the project or its dependencies

The messages come from **browser extensions** (e.g. uBlock Origin, Privacy Badger) that inject their own CSP headers or access the Shared Storage API internally. Chrome attributes these to "your site" even though the project is not the source.

**To verify:** Open `http://localhost:3000` in a Chrome Incognito window with extensions disabled — both messages will be gone.

## AVIF source images cause 404s in production

**Related upstream issue:** [Niels-IO/next-image-export-optimizer#263](https://github.com/Niels-IO/next-image-export-optimizer/issues/263)

`next-image-export-optimizer` has a bug with AVIF source files when `storePicturesInWEBP=true`. The optimizer writes `.WEBP` output to disk but `ExportedImage` generates `srcset` paths with the original `.AVIF` extension — pointing to files that do not exist, causing 404 errors in production.

**Workaround:** Do not use `.avif` as a source format for cover images or any image referenced via `ExportedImage`. Use `.jpg`, `.png`, or `.webp` instead — the optimizer converts these to WebP correctly.

AVIF is a great format in general, but this project's static-export image pipeline (`next-image-export-optimizer`) does not handle AVIF source files correctly until the upstream bug is fixed.
