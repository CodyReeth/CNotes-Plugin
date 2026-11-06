# CNotes

An experimental desktop Obsidian plugin for spatial Markdown notes. CNotes adds floating images, Excalidraw previews, and editable code cards to the existing Markdown editor. Text can flow on both sides of a centrally placed object; code can also flow around an overlapping image.

The first release targets **Obsidian 1.14.4**. This is an initial implementation, not a guarantee of compatibility with every theme or community plugin.

## Install

1. Build with `npm ci` and `npm run package`, or use the prepared `dist/cnotes` folder.
2. Copy that folder to `<your vault>/.obsidian/plugins/cnotes`.
3. Reload Obsidian and enable **CNotes** under **Settings → Community plugins**.
4. Assign a shortcut to **CNotes: Toggle CNotes mode** under **Settings → Hotkeys**.

Excalidraw previews require the Excalidraw plugin. LaTeX Suite is optional; CNotes does not install or configure other plugins in your vault.

## Use

- Open a Markdown note and run **Toggle CNotes mode**, or click the CNotes ribbon button. This enables Live Preview and saves `cnotes: true` in the note's Properties, so it opens in CNotes automatically next time.
- Put the cursor in a standalone image embed or a complete fenced code block. Run **Float image or code block at cursor**, or use **Float in CNotes** in the editor context menu. **Float all supported images and code blocks** is also available.
- Drag a card's header to move it freely. Image and Excalidraw previews can also be dragged directly; clicking a preview opens its source in a tab.
- Drag the corner to resize. Images preserve their current frame proportions by default; hold Shift for independent width/height resizing.
- Press Escape during a drag to cancel. A completed drag or resize is one undoable edit.
- Focus the drag handle and use arrow keys to move one pixel; hold Shift for ten pixels. Focus the resize control to change dimensions with those keys.
- Edit code directly in its card. Undo/redo uses the note's history, and copied code retains its actual indentation and newlines.
- Use the return arrow in a card header to restore the block inline.
- Toggle the mode off to see ordinary Markdown temporarily in that pane. Reopening the note or restarting Obsidian restores its saved opening preference.

Settings offer the built-in Python highlighter or plain text, space around objects, and the starting object width. Highlighting runs locally and does not execute code. It is a small lexical tokenizer: f-strings are colored as strings, and it does not provide completion, diagnostics, type inference, or an LSP connection.

## Supported source

The initial scanner accepts standalone `![[image.png]]` / `![alt](image.png)` embeds, Excalidraw targets ending in `.excalidraw` or `.excalidraw.md`, and complete top-level backtick/tilde code fences. Keep inline images and embeds inside lists or blockquotes in their normal Markdown form for now. Plugin-rendered fences such as Mermaid, Dataview, Tasks, and math are left with their owning plugins.

Normal prose remains in Obsidian's native editor. The floating code editor is dedicated to code and does not inherit every Obsidian Markdown extension. A provider registry in `src/highlighting/python.ts` allows additional highlighters to be implemented without changing the card model.

## Markdown and layout data

### Automatic opening

Enabling CNotes or floating a block adds this checkbox property to the note:

```yaml
---
cnotes: true
---
```

You can also add it in Obsidian's Properties UI or a note template. Notes with the property open in CNotes automatically, including after restarting Obsidian and when opened in another pane. Ordinary unmarked notes keep their normal Markdown behavior.

Existing notes from version 0.1.0 with valid CNotes layout markers also open automatically, without rewriting them. Set `cnotes: false` (uncheck the checkbox), or run **Stop opening this note in CNotes automatically**, to opt out even when layout markers remain. Removing the property reverts to detecting legacy layout markers. The regular toggle changes only the current pane when turning CNotes off; it does not remove the saved opening preference.

Property edits use the live editor buffer and can be undone. The note body and other property values are preserved. Ordinary YAML comments and formatting are retained; complex flow or nested forms may be normalized through Obsidian's YAML serializer. Malformed YAML is left intact, with a notice if an explicit command cannot save the preference.

### Floating object positions

Code, prose, and embed links remain in the `.md` file. A floated block gets one adjacent comment:

```text
<!-- cnotes {"v":1,"id":"unique-object-id","x":0.5,"y":40,"w":280,"h":200} -->
![[figure.png]]
```

`x` is a fraction of the horizontal space remaining after subtracting the card width; `y` is a vertical offset from the source block's anchor; `w` and `h` are CSS pixels. The width is clamped to fit a narrower pane without rewriting the stored size. Objects positioned below their source follow text reflow above them. For objects dragged above their source, the anchor is held during a wrapping pass to prevent layout feedback, then measured again when the document changes.

Dragging changes metadata only. Visual wrapping adds editor decorations, never whitespace or line breaks to the source. Without CNotes, comments stay hidden in rendered Markdown and the underlying blocks appear in their original source order. Unknown metadata versions, malformed markers, and duplicate object IDs stay inline rather than being reassigned silently. To repair a duplicate or invalid marker, remove that comment in Source mode and float the block again.

## Current boundaries

- This release is desktop only and implements a vertically scrolling note, not an infinite canvas.
- Automatic exclusion is implemented for editable text runs. Tables, rendered block math, and third-party widgets have their own layouts and need further compatibility work when directly overlapped by a card.
- The layout engine measures visible text and settles over several frames after a drag, edit, or resize. A bounded wrapping pass reports a notice if an arrangement cannot settle.
- Reading mode and exports use the ordinary Markdown layout. The spatial presentation is an editor feature.
- Extremely large numbers of floating cards, alternate themes, popout windows, IME composition, and arbitrary community-plugin combinations have not all been validated. See `VALIDATION.md` for the tested cases and versions.

## Development

```sh
npm ci
npm test
npm run build
npm run package
```

`npm run dev` watches the source. `npm run stage` copies the plugin build into the local `dev-vault` and enables CNotes there; it never targets a personal vault. The fixtures include ordinary Markdown, an SVG, and an Excalidraw drawing.

`scripts/host-test.mjs` attaches Playwright to a separately launched Obsidian instance at `http://127.0.0.1:9228`. It verifies the vault path before changing the fixture note. Set `CNOTES_TEST_VAULT` to the absolute path of a dedicated development vault if the checkout is elsewhere. The harness expects the fixtures to be present, CNotes staged, and the compatibility plugins downloaded with `node scripts/fetch-test-plugins.mjs`. The latter downloads official releases into the development vault only.

Launch a separate Obsidian process with an isolated `--user-data-dir` and `--remote-debugging-port=9228`; configure that profile to open the development vault. Do not expose its debugging port to other machines. Run `npm run test:host` once the test vault is open.

The native editor owns note history and source text. `src/editor/state.ts` supplies block replacements, `workspace.ts` manages object anchors and metadata transactions, and `src/layout/flow.ts` computes exclusions using measured text. `src/editor/note-mode.ts` manages automatic opening and temporary pane overrides. Its single `editor.cm` bridge follows Obsidian's documented example but is not part of the typed editor interface.
