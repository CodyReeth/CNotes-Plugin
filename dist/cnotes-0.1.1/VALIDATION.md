# CNotes validation

## Automatic opening — version 0.1.1, November 6, 2026

Validated in the same isolated Obsidian 1.14.4 profile. `node scripts/host-test.mjs --auto-open` passed with no host exceptions:

- Ten YAML forms, including CRLF, quoted keys, flow mappings, nested values, multiline scalars, and preservation of body text. Malformed properties are not overwritten; repeated enablement is idempotent.
- Enabling CNotes adds the checkbox while preserving existing ordinary property formatting and values.
- Marked notes reopen in CNotes after file navigation and an application-window reload, including notes opened from Reading mode. Automatic opening does not rewrite the file.
- Existing layout-only notes open automatically; explicit `cnotes: false` takes precedence over layout markers.
- Clicking the actual Obsidian Properties checkbox changes mode; undo restores the previous property and mode.
- Commands update an existing property even while Obsidian protects its region from normal text edits.
- Temporary Markdown mode survives ordinary edits and tab switching, resets when the file is reopened, and is independent in two panes.
- Floating code adds the property and resolves the correct source range after the frontmatter insertion.
- Unmarked notes remain ordinary Markdown; mode does not leak to another file opened in the same pane.

The main host regression suite also passed for 0.1.1: prose/code wrapping, editable code and shared undo, dragging/resizing, LaTeX Suite, Excalidraw, and reload. The updated edge suite passed with both panes automatically opening in CNotes, one pane temporarily toggled off independently, 138 cursor samples with zero mismatches, long-note scrolling, and clean plugin unload. All seven logic tests and the production build passed.

## Initial release — version 0.1.0

Validated on November 2, 2026 in an isolated development vault and application profile. No personal vault was used.

## Environment

| Component | Version |
| --- | --- |
| Obsidian desktop | 1.14.4 |
| LaTeX Suite | 1.14.1 |
| Excalidraw | 2.29.1 |
| Theme | Obsidian default, light |
| Platform | macOS |

## Automated logic checks

`npm test`: 7 tests passed. They cover metadata validation and round trips, CRLF/source ranges, repeated embeds, incomplete and special fences, duplicate IDs, nested list content, safe code-fence extension, and stateful Python tokenization.

`npm run build`: TypeScript checking and production bundling passed. `npm run package` produced `dist/cnotes` with `main.js`, `manifest.json`, `styles.css`, and installation documentation.

## Tests in the real Obsidian editor

The Playwright harness attaches to the isolated Obsidian instance through its local debugging port. It checks the vault path before modifying fixture notes. These tests use the actual Obsidian Markdown editor and installed compatibility plugins.

| Case | Result |
| --- | --- |
| Toggle CNotes and mount image/code cards | Passed |
| Exact Markdown preservation when toggling | Passed |
| Prose wraps around centrally placed cards | Passed; measured character bounds show no overlap |
| Editable floating Python code writes through to Markdown | Passed |
| Shared code undo restores the exact original note | Passed; normal time-based history grouping |
| Pointer drag changes only layout metadata | Passed |
| Escape cancels a drag without changing the note | Passed |
| Resize persists; drag and resize each undo in one step | Passed |
| LaTeX Suite `sq` expansion in the normal typing area | Passed |
| Excalidraw SVG renders in a floating card | Passed |
| Code flows on both sides of an overlapping Excalidraw preview | Passed; no measured code characters under the image |
| Nearly page-wide card moves prose below it | Passed; no measured prose characters under the card |
| Layout and source survive mode toggling and window reload | Passed |
| Click on the drawing preview opens the Excalidraw view | Passed |
| Cursor hit testing around the wrapped content | Passed: 138 sampled positions, zero mismatches |
| Long note with 100 extra sections, scroll to end and back | Passed; exact source preserved |
| Two panes showing the same note | Passed; toggling one leaves the other unchanged |
| Narrow panes | Exercised at 276 CSS pixels of content width |
| Plugin unload | Passed; cards and wrapping decorations removed; both note buffers preserved |
| Host exceptions during the tested interactions | None |

Run the main suite with `npm run test:host`. Run the additional checks with `node scripts/host-test.mjs --edge-cases`. Screenshots and diagnostic outputs are written to `test-results/`.

## Boundaries of this evidence

This establishes the initial native-editor approach for the tested cases. It does not establish universal plugin compatibility. Other themes, popout windows, IME input, arbitrary plugin-generated widgets, extremely large numbers of cards, actual operating-system clipboard behavior, and multi-device sync conflicts have not been exhaustively tested.

Tables, rendered block math, and third-party widgets do not yet participate in the text-run exclusion algorithm. Keep floating objects clear of those widgets. Ordinary math rendering and the tested LaTeX Suite snippet expansion remain in the native editor.

Reading mode and exported notes retain ordinary Markdown source order. Python highlighting is intentionally lexical; f-string expressions are not independently parsed, and there is no LSP or code execution.
