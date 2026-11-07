# CNotes PDF export

Status: implemented in version 0.2.0 and tested in desktop Obsidian 1.14.4.

## Confirmed behavior

The dedicated **CNotes: Export CNotes to PDF** command and active-note file-menu action generate one continuous page at the current note width and theme. The entire note is included, even when its prose or object anchors are offscreen or folded. Code cards keep their exact frame and current internal scroll position; code outside that viewport is not printed. The actual generated PDF is previewed before the user chooses a destination with the native Save dialog.

Obsidian's built-in PDF command remains unchanged. Its native Markdown preview renderer does not contain CNotes' editor decorations or floating-card layer, so a print stylesheet alone cannot reproduce the spatial arrangement.

## Implemented pipeline

1. **Capture inputs.** Read the live editor buffer, content width, source path, placements, and card scroll offsets. Never write layout markers or source during export.
2. **Build a disposable native Markdown view.** Construct an independent MarkdownView using the same host and source path, with file reading/saving and fold-state persistence disabled. Do not share the original EditorState: some native math widgets reuse DOM and sharing state can disturb the live editor. Unfold the export copy and reject source-changing transactions.
3. **Materialize and settle.** A small, capability-checked CodeMirror print adapter forces the complete document and nested code editors to render. Await card previews and fonts, restore captured card scroll offsets, and wait for stable geometry/text/gap measurements. Require the main viewport to cover the complete source. The layout wait has a bounded timeout and supports cancellation.
4. **Freeze the display.** Copy computed styles and actual rendered DOM into static HTML. Inline images and the font faces used by the snapshot. Keep SVG and text; convert actual canvas widgets to image data. Preserve code clipping and scroll translation, omitting wholly clipped code lines. Keep control geometry while hiding its contents, so removing the resize/drag UI cannot steal space from a card. Include shared MathJax path definitions when referenced.
5. **Measure paper.** Use actual block and floating-card bounds, including cards below the last paragraph. Exclude CodeMirror's estimated/extra scrolling space. Convert CSS pixels to inches at 96 px/in and add a small rounding allowance. Reject dimensions above 19,000 CSS pixels rather than silently shrinking or paginating.
6. **Print and verify.** Write the self-contained HTML to a temporary directory. A hidden, sandboxed Electron BrowserWindow with Node integration disabled loads it under a restrictive content security policy. Await image decoding/fonts and compare printed line/card geometry with the native snapshot. Chromium's `printToPDF` produces the bytes with backgrounds, zero margins, and no headers/footers. Validate the PDF signature, one-page count, and dimensions using Obsidian's PDF.js loader. Destroy the print window and remove the temporary directory in `finally`.
7. **Preview and save.** Render the generated PDF with PDF.js in a scrollable modal. Bound preview-canvas memory independently of the saved PDF's quality. The native Save dialog writes the already validated bytes. Cancel, close, error, and plugin unload clean up temporary views/windows/render tasks.

## Components

- `src/export/state.ts`: export-only editor facet.
- `src/export/snapshot.ts`: native-view lifecycle, full-document rendering, stable layout.
- `src/export/document.ts`: computed-style/resource capture, clipping, page bounds.
- `src/export/desktop.ts`: guarded Electron print/save bridge and output validation.
- `src/export/service.ts`: command workflow, progress, cancellation, actual-PDF preview.
- `scripts/host-pdf.mjs`: isolated real-Obsidian integration suite.

The native MarkdownView lifecycle, CodeMirror print flag, and Electron remote bridge are host implementation dependencies. They are isolated and tested against 1.14.4; they are not a public Obsidian PDF-export customization API.

## Verified cases

The host suite checks the complete note and final sentinel, a floating Excalidraw drawing beyond the last prose, current code scroll offsets, searchable visible code and exclusion of hidden code (including clipped portions of a long wrapped line), narrow/dark layout with an SVG over code, source/selection/scroll/history/fold preservation, native view and window cleanup, cancellation during rendering/printing, command/preview/save, missing images, near-limit pages and over-limit rejection, and unload during export. Generated PDFs were also rendered with Poppler and inspected visually, including card clipping, math, the final drawing, and a page approximately 18,879 CSS pixels tall.

See `VALIDATION.md` for the environment and regression evidence.

## Current limits and follow-ups

- One continuous page only. Paginated output and uniform scaling are future explicit options.
- Missing images or interactive iframe/audio/video embeds stop export with a message. Arbitrary third-party widgets and theme pseudo-elements are not universally supported. Inspect the actual PDF preview for custom themes/widgets.
- Existing CNotes exclusion limitations for tables, rendered block math, and arbitrary widgets still apply when those blocks are overlapped by cards.
- Canvas content is rasterized; ordinary text and SVG remain vector/text where Chromium supports them. PDF reading order follows source/DOM order and is not a tagged accessible-document guarantee.
- The preview is a rendered view of the actual PDF, not an editable layout. Its raster resolution is limited to bound memory; saving preserves the original PDF.
- Standard Obsidian PDF menu interception remains optional future work. The dedicated CNotes command avoids patching that native export action.
- Additional host versions, platforms, popout windows, themes, and plugin combinations need their own validation.

## References

- Local host evidence: Obsidian 1.14.4 application archive, public TypeScript definitions, and installed CodeMirror implementation, inspected read-only.
- [Electron PDF API](https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions): custom page dimensions, backgrounds, margins, and returned PDF bytes.
- [Obsidian editor extensions](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/Editor/Editor%20extensions.md): native editor extensions versus Markdown preview processing.
