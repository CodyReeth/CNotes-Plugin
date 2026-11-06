"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CNotes
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/editor/note-mode.ts
var import_obsidian = require("obsidian");
var import_commands = require("@codemirror/commands");

// src/model/blocks.ts
var specialFences = /* @__PURE__ */ new Set([
  "mermaid",
  "dataview",
  "dataviewjs",
  "tasks",
  "query",
  "math",
  "ad-note",
  "excalidraw"
]);
function parsePlacement(text) {
  const match = /^<!-- cnotes (.+) -->$/.exec(text.trim());
  if (!match) return;
  try {
    const p = JSON.parse(match[1]);
    if (p.v !== 1 || typeof p.id !== "string" || !/^[a-zA-Z0-9_-]{6,80}$/.test(p.id))
      return;
    if (Object.keys(p).some((k) => !["v", "id", "x", "y", "w", "h"].includes(k)))
      return;
    if (![p.x, p.y, p.w, p.h].every(
      (n) => typeof n === "number" && Number.isFinite(n)
    ))
      return;
    if (p.x < 0 || p.x > 1 || Math.abs(p.y) > 1e5 || p.w < 96 || p.w > 4e3 || p.h < 64 || p.h > 4e3)
      return;
    return p;
  } catch {
    return;
  }
}
function marker(p) {
  return `<!-- cnotes ${JSON.stringify({ v: 1, id: p.id, x: round(p.x, 4), y: round(p.y, 1), w: round(p.w, 1), h: round(p.h, 1) })} -->`;
}
function round(n, decimals) {
  return Number(n.toFixed(decimals));
}
function parseBlocks(source) {
  const lines = [];
  let offset = 0;
  for (const line of source.split("\n")) {
    const text = line.endsWith("\r") ? line.slice(0, -1) : line;
    lines.push({
      text,
      from: offset,
      to: offset + text.length,
      end: Math.min(source.length, offset + line.length + 1)
    });
    offset += line.length + 1;
  }
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (i === 0 && l.text === "---") {
      while (++i < lines.length && lines[i].text !== "---") {
      }
      continue;
    }
    if (l.text.trimStart().startsWith("<!--") && !l.text.includes("-->")) {
      while (++i < lines.length && !lines[i].text.includes("-->")) {
      }
      continue;
    }
    const fence = /^ {0,3}(`{3,}|~{3,})([^`]*)$/.exec(l.text);
    let block;
    if (fence) {
      let j = i + 1;
      const close = new RegExp(
        `^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`
      );
      while (j < lines.length && !close.test(lines[j].text)) j++;
      if (j === lines.length) break;
      const language = fence[2].trim().split(/\s+/)[0].toLowerCase();
      if (!l.text.startsWith(" ") && !specialFences.has(language) && !language.startsWith("ad-")) {
        const bodyFrom = l.end, bodyTo = lines[j].from;
        block = {
          kind: "code",
          from: l.from,
          to: lines[j].to,
          bodyFrom,
          bodyTo,
          language,
          source: source.slice(l.from, lines[j].to)
        };
      }
      if (block) attach(block, i);
      i = j;
      continue;
    }
    const wiki = /^!\[\[([^\]\n]+)\]\]\s*$/.exec(l.text);
    const md = /^!\[[^\]\n]*\]\((<[^>\n]+>|(?:\\.|[^\s])+)\s*(?:"[^"\n]*")?\)\s*$/.exec(
      l.text
    );
    const target = wiki?.[1].split("|")[0] ?? md?.[1].replace(/^<|>$/g, "").replace(/\\([()])/g, "$1");
    if (target) {
      const path = target.split("#")[0].split("?")[0];
      if (/\.(?:png|jpe?g|gif|webp|svg|bmp|avif|excalidraw(?:\.md)?)$/i.test(path)) {
        block = {
          kind: "image",
          from: l.from,
          to: l.to,
          bodyFrom: l.from,
          bodyTo: l.to,
          language: "",
          source: l.text,
          target
        };
        attach(block, i);
      }
    }
  }
  function attach(block, lineIndex) {
    const previous = lines[lineIndex - 1];
    if (previous?.text.trimStart().startsWith("<!-- cnotes ")) {
      block.markerFrom = previous.from;
      block.markerTo = previous.end;
      block.placement = parsePlacement(previous.text);
      block.blockedMarker = !block.placement;
    }
    blocks.push(block);
  }
  const counts = /* @__PURE__ */ new Map();
  for (const b of blocks)
    if (b.placement)
      counts.set(b.placement.id, (counts.get(b.placement.id) ?? 0) + 1);
  for (const b of blocks)
    if (b.placement && (counts.get(b.placement.id) ?? 0) > 1) {
      b.placement = void 0;
      b.blockedMarker = true;
    }
  return blocks;
}
function bodyText(source, block) {
  const body = source.slice(block.bodyFrom, block.bodyTo);
  return body.replace(/\r?\n$/, "");
}
function codeReplacement(source, block, body) {
  const opening = source.slice(block.from, block.bodyFrom).replace(/\r?\n$/, "");
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(opening);
  if (!match) throw new Error("Code block no longer has a valid fence");
  const char = match[2][0];
  const lengths = Array.from(
    body.matchAll(new RegExp(`^ {0,3}(${char}{3,})\\s*$`, "gm")),
    (m) => m[1].length
  );
  const fence = char.repeat(
    Math.max(match[2].length, ...lengths.map((n) => n + 1))
  );
  const newline = source.slice(block.from, block.bodyFrom).endsWith("\r\n") ? "\r\n" : "\n";
  return `${match[1]}${fence}${match[3]}${newline}${body}${newline}${match[1]}${fence}`;
}

// src/model/note-mode.ts
function frontmatter(source) {
  const opening = /^\uFEFF?---[ \t]*\r?\n/.exec(source);
  if (!opening) return null;
  const closing = /^(?:---|\.\.\.)[ \t]*(?:\r?$)/gm;
  closing.lastIndex = opening[0].length;
  const end = closing.exec(source);
  if (!end)
    throw new Error(
      "Finish the note's YAML properties before enabling automatic CNotes."
    );
  return {
    from: opening[0].length,
    to: end.index,
    yaml: source.slice(opening[0].length, end.index)
  };
}
function properties(yaml, parse) {
  const data = parse(yaml);
  if (data == null) return {};
  if (typeof data !== "object" || Array.isArray(data))
    throw new Error("The note's YAML properties must be a mapping.");
  return data;
}
function notePreference(source, parse) {
  try {
    const fm = frontmatter(source);
    const data = fm ? properties(fm.yaml, parse) : {};
    if (Object.hasOwn(data, "cnotes")) {
      if (data.cnotes === true) return "on";
      if (data.cnotes === false) return "off";
      return "invalid";
    }
    return parseBlocks(source).some((b) => b.placement) ? "legacy" : "plain";
  } catch {
    return "invalid";
  }
}
function noteModeChange(source, enabled, codec) {
  const fm = frontmatter(source);
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  if (!fm) {
    const from = source.startsWith("\uFEFF") ? 1 : 0;
    return {
      from,
      to: from,
      insert: `---${newline}cnotes: ${enabled}${newline}---${newline}`
    };
  }
  const data = properties(fm.yaml, codec.parse);
  if (data.cnotes === enabled) return null;
  const scalar = /^(cnotes|"cnotes"|'cnotes')([ \t]*:[ \t]*)(true|false|null|~|"[^"\r\n]*"|'[^'\r\n]*'|[^\s#{}\[\]&*!|>]+)?([ \t]*(?:#[^\r\n]*)?)\r?$/gm;
  const match = scalar.exec(fm.yaml);
  if (match && typeof data.cnotes !== "object" && Object.hasOwn(data, "cnotes")) {
    const change = {
      from: fm.from + match.index,
      to: fm.from + match.index + match[0].replace(/\r$/, "").length,
      insert: `${match[1]}${match[2]}${enabled}${match[4]}`
    };
    const candidate = fm.yaml.slice(0, change.from - fm.from) + change.insert + fm.yaml.slice(change.to - fm.from);
    try {
      if (properties(candidate, codec.parse).cnotes === enabled) return change;
    } catch {
    }
  }
  if (!Object.hasOwn(data, "cnotes") && !fm.yaml.trimStart().startsWith("{")) {
    const insert = `cnotes: ${enabled}${newline}`;
    try {
      if (properties(fm.yaml + insert, codec.parse).cnotes === enabled)
        return { from: fm.to, to: fm.to, insert };
    } catch {
    }
  }
  return {
    from: fm.from,
    to: fm.to,
    insert: codec.stringify({ ...data, cnotes: enabled }).replace(/\r?\n/g, newline).replace(/(?:\r?\n)*$/, newline)
  };
}

// src/editor/state.ts
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var setMode = import_state.StateEffect.define();
var refreshObjects = import_state.StateEffect.define();
var modeField = import_state.StateField.define({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setMode)) value = e.value;
    return value;
  }
});
var blocksField = import_state.StateField.define({
  create: (state) => parseBlocks(state.doc.toString()),
  update(value, tr) {
    return tr.docChanged ? parseBlocks(tr.state.doc.toString()) : value;
  }
});
var Anchor = class extends import_view.WidgetType {
  constructor(id) {
    super();
    this.id = id;
  }
  id;
  eq(other) {
    return this.id === other.id;
  }
  get estimatedHeight() {
    return 8;
  }
  toDOM(view) {
    const el = view.dom.ownerDocument.createElement("div");
    el.className = "cnotes-anchor";
    el.dataset.cnotesAnchor = this.id;
    el.setAttribute("aria-hidden", "true");
    return el;
  }
};
var objectsField = import_state.StateField.define({
  create: () => import_view.Decoration.none,
  update(value, tr) {
    if (!tr.state.field(modeField)) return import_view.Decoration.none;
    if (!tr.docChanged && !tr.effects.some((e) => e.is(setMode))) return value;
    return import_view.Decoration.set(
      tr.state.field(blocksField).filter((b) => b.placement).map(
        (b) => import_view.Decoration.replace({
          block: true,
          widget: new Anchor(b.placement.id),
          inclusive: false
        }).range(b.markerFrom ?? b.from, b.to)
      ),
      true
    );
  },
  provide: (f) => [
    import_state.Prec.highest(import_view.EditorView.decorations.from(f)),
    import_view.EditorView.atomicRanges.of((view) => view.state.field(f))
  ]
});

// src/layout/flow.ts
var import_state2 = require("@codemirror/state");
var import_view2 = require("@codemirror/view");
var resetFlow = import_state2.StateEffect.define();
var setGaps = import_state2.StateEffect.define();
function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
var Gap = class extends import_view2.WidgetType {
  constructor(width) {
    super();
    this.width = width;
  }
  width;
  eq(other) {
    return this.width === other.width;
  }
  toDOM(view) {
    const el = view.dom.ownerDocument.createElement("span");
    el.className = "cnotes-gap";
    el.setAttribute("aria-hidden", "true");
    el.style.width = `${this.width}px`;
    return el;
  }
  ignoreEvent() {
    return true;
  }
};
var VerticalGap = class extends import_view2.WidgetType {
  constructor(height) {
    super();
    this.height = height;
  }
  height;
  eq(other) {
    return this.height === other.height;
  }
  get estimatedHeight() {
    return this.height;
  }
  toDOM(view) {
    const el = view.dom.ownerDocument.createElement("div");
    el.className = "cnotes-gap";
    el.style.cssText = `display:block;height:${this.height}px`;
    el.setAttribute("aria-hidden", "true");
    return el;
  }
  ignoreEvent() {
    return true;
  }
};
var gapField = import_state2.StateField.define({
  create: () => import_view2.Decoration.none,
  update(value, tr) {
    if (tr.docChanged) value = import_view2.Decoration.none;
    for (const e of tr.effects)
      if (e.is(resetFlow))
        value = e.value === null ? import_view2.Decoration.none : value.update({ filter: (from) => from < e.value });
    for (const e of tr.effects)
      if (e.is(setGaps))
        value = import_view2.Decoration.set(
          e.value.map(
            (g) => import_view2.Decoration.widget({
              widget: g.height ? new VerticalGap(g.height) : new Gap(g.width),
              block: !!g.height,
              side: -1
            }).range(g.pos)
          ),
          true
        );
    return value;
  },
  provide: (f) => import_view2.EditorView.decorations.from(f)
});
function flowExtension(rectangles, onLimit) {
  return [
    gapField,
    import_view2.ViewPlugin.fromClass(
      class {
        constructor(view) {
          this.view = view;
          this.measure();
        }
        view;
        values = [];
        pending = false;
        destroyed = false;
        generation = 0;
        steps = 0;
        width = 0;
        update(update) {
          if (update.docChanged) {
            this.values = [];
            this.steps = 0;
            this.generation++;
          }
          for (const tr of update.transactions)
            for (const e of tr.effects)
              if (e.is(resetFlow)) {
                this.values = e.value === null ? [] : this.values.filter((g) => g.pos < e.value);
                this.steps = 0;
                this.generation++;
              }
          this.measure();
        }
        measure() {
          if (this.destroyed) return;
          this.view.requestMeasure({
            key: this,
            read: (view) => {
              if (this.pending || view.composing) return null;
              const content = view.contentDOM.getBoundingClientRect();
              if (this.width && Math.abs(content.width - this.width) > 1)
                return { reset: true, width: content.width };
              this.width = content.width;
              const rects = rectangles(view).filter(
                (r) => r.right > content.left && r.left < content.right && r.bottom > content.top && r.top < content.bottom
              );
              if (!rects.length || this.steps >= 400) return null;
              const doc = view.dom.ownerDocument;
              const walker = doc.createTreeWalker(view.contentDOM, 4);
              const range = doc.createRange();
              let node;
              while (node = walker.nextNode()) {
                const blocked = node.parentElement?.closest(
                  '.cnotes-gap,.cm-widgetBuffer,[contenteditable="false"]'
                );
                if (blocked && view.contentDOM.contains(blocked)) continue;
                const length = node.textContent?.length ?? 0;
                range.selectNodeContents(node);
                if (!rects.some(
                  (r) => intersects(range.getBoundingClientRect(), r)
                ))
                  continue;
                for (let i = 0; i < length; i++) {
                  range.setStart(node, i);
                  range.setEnd(node, i + 1);
                  const r = Array.from(range.getClientRects()).find(
                    (r2) => r2.width > 0.5 && r2.height > 1
                  );
                  if (!r) continue;
                  const hits = rects.filter((rect) => intersects(r, rect));
                  if (!hits.length) continue;
                  let pos = view.posAtDOM(node, i), x = r.left;
                  const full = hits.filter(
                    (b) => b.left - content.left < 64 && content.right - b.right < 64
                  );
                  if (full.length) {
                    const line = view.state.doc.lineAt(pos), old2 = this.values.find(
                      (g) => g.pos === line.from && g.height
                    );
                    const top = view.coordsAtPos(line.from, 1)?.top ?? r.top;
                    return {
                      gap: {
                        pos: line.from,
                        width: 0,
                        height: (old2?.height ?? 0) + Math.max(
                          1,
                          Math.max(...full.map((b) => b.bottom)) - top + 2
                        )
                      },
                      clearTo: line.to
                    };
                  }
                  const prefix = view.state.sliceDoc(
                    view.state.doc.lineAt(pos).from,
                    pos
                  );
                  const start = pos - (prefix.match(/\S+$/)?.[0].length ?? 0);
                  const before = view.coordsAtPos(start, 1);
                  if (before && Math.abs(before.top - r.top) < 8 && !this.values.some((g) => g.pos >= start && g.pos <= pos)) {
                    pos = start;
                    x = before.left;
                  }
                  const right = Math.min(
                    content.right - 1,
                    Math.max(...hits.map((rect) => rect.right))
                  );
                  const old = this.values.find((g) => g.pos === pos);
                  const width = Math.min(
                    content.width - 1,
                    (old?.width ?? 0) + Math.max(1, right - x + 1)
                  );
                  if (old && Math.abs(old.width - width) < 0.5)
                    return { limit: true };
                  return { gap: { pos, width } };
                }
              }
              return null;
            },
            write: (result) => {
              if (!result || this.pending || this.destroyed) return;
              if ("limit" in result) {
                this.steps = 400;
                onLimit?.();
                return;
              }
              if ("reset" in result) {
                this.width = result.width;
                this.dispatch(
                  () => this.view.dispatch({ effects: resetFlow.of(null) })
                );
                return;
              }
              const gap = result.gap;
              const next = this.values.filter(
                (g) => "clearTo" in result ? g.pos < gap.pos || g.pos > result.clearTo : g.pos !== gap.pos
              ).concat(gap).sort((a, b) => a.pos - b.pos);
              this.steps++;
              this.dispatch(() => {
                this.values = next;
                this.view.dispatch({ effects: setGaps.of(next) });
              });
              if (this.steps >= 400) onLimit?.();
            }
          });
        }
        dispatch(action) {
          this.pending = true;
          const generation = this.generation;
          queueMicrotask(() => {
            if (!this.destroyed && generation === this.generation) action();
            this.pending = false;
            this.measure();
          });
        }
        destroy() {
          this.destroyed = true;
          this.generation++;
        }
      }
    )
  ];
}

// src/editor/note-mode.ts
function codeMirror(editor) {
  const cm = editor.cm;
  return cm && typeof cm.dispatch === "function" && cm.state ? cm : void 0;
}
var NoteModes = class {
  constructor(plugin) {
    this.plugin = plugin;
    const workspace = plugin.app.workspace;
    plugin.registerEvent(workspace.on("file-open", this.schedule));
    plugin.registerEvent(workspace.on("active-leaf-change", this.schedule));
    plugin.registerEvent(workspace.on("layout-change", this.schedule));
    plugin.registerEvent(workspace.on("editor-change", this.schedule));
    plugin.registerEvent(plugin.app.metadataCache.on("changed", this.schedule));
    workspace.onLayoutReady(this.schedule);
    plugin.register(() => {
      this.dead = true;
      window.clearTimeout(this.timer);
    });
  }
  plugin;
  panes = /* @__PURE__ */ new WeakMap();
  timer;
  dead = false;
  schedule = () => {
    if (this.dead) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      for (const leaf of this.plugin.app.workspace.getLeavesOfType(
        "markdown"
      )) {
        if (!leaf.isDeferred && leaf.view instanceof import_obsidian.MarkdownView)
          void this.reconcile(leaf.view).catch(
            (error) => console.error("CNotes automatic opening failed", error)
          );
      }
    }, 30);
  };
  pane(view) {
    if (!view.file) return;
    let state = this.panes.get(view);
    if (state?.file !== view.file) {
      const cm = codeMirror(view.editor);
      if (cm?.state.field(modeField, false))
        cm.dispatch({ effects: [setMode.of(false), resetFlow.of(null)] });
      state = { file: view.file, busy: false };
      this.panes.set(view, state);
    }
    return state;
  }
  current(view, state) {
    return !this.dead && view.file === state.file && this.panes.get(view) === state;
  }
  async apply(view, state, enabled) {
    if (!this.current(view, state)) return;
    let cm = codeMirror(view.editor);
    if (!enabled) {
      if (cm?.state.field(modeField, false))
        cm.dispatch({ effects: [setMode.of(false), resetFlow.of(null)] });
      if (state.previous) {
        const previous2 = state.previous;
        state.previous = void 0;
        await view.setState(
          { ...view.getState(), ...previous2 },
          { history: false }
        );
      }
      return;
    }
    if (cm?.state.field(modeField, false)) return;
    const previous = view.getState();
    state.previous ??= { mode: previous.mode, source: previous.source };
    await view.setState(
      { ...previous, mode: "source", source: false },
      { history: false }
    );
    if (!this.current(view, state)) return;
    cm = codeMirror(view.editor);
    if (cm?.state.field(modeField, false) !== void 0)
      cm.dispatch({ effects: [setMode.of(true), resetFlow.of(null)] });
  }
  async reconcile(view) {
    const state = this.pane(view);
    if (!state || state.busy) return;
    const preference = notePreference(view.getViewData(), import_obsidian.parseYaml);
    if (state.preference !== void 0 && preference !== state.preference)
      state.override = void 0;
    state.preference = preference;
    state.busy = true;
    try {
      await this.apply(
        view,
        state,
        state.override ?? (preference === "on" || preference === "legacy")
      );
    } finally {
      state.busy = false;
    }
  }
  /** Called for explicit enablement, including floating a block. */
  async enable(view) {
    const state = this.pane(view);
    if (!state || state.busy) return false;
    state.busy = true;
    state.override = true;
    try {
      await this.apply(view, state, true);
      if (!this.current(view, state)) return false;
      const cm = codeMirror(view.editor);
      if (!cm) return false;
      try {
        const change = noteModeChange(cm.state.doc.toString(), true, {
          parse: import_obsidian.parseYaml,
          stringify: import_obsidian.stringifyYaml
        });
        if (change)
          cm.dispatch({
            changes: change,
            // Obsidian protects the Properties region from ordinary typing filters.
            filter: false,
            annotations: import_commands.isolateHistory.of("full")
          });
      } catch (error) {
        new import_obsidian.Notice(
          `CNotes is on for this pane, but automatic opening could not be saved. ${error instanceof Error ? error.message : "Check YAML properties."}`
        );
      }
      state.preference = notePreference(view.getViewData(), import_obsidian.parseYaml);
      return true;
    } finally {
      state.busy = false;
      this.schedule();
    }
  }
  async toggle(view) {
    const state = this.pane(view);
    if (!state || state.busy) return;
    if (!codeMirror(view.editor)?.state.field(modeField, false)) {
      if (await this.enable(view)) new import_obsidian.Notice("CNotes on");
      return;
    }
    state.override = false;
    state.busy = true;
    try {
      await this.apply(view, state, false);
    } finally {
      state.busy = false;
    }
    new import_obsidian.Notice(
      "CNotes off for this pane. Reopening the note restores its saved preference."
    );
  }
  async disableAutomatic(view) {
    const state = this.pane(view);
    if (!state || state.busy) return;
    state.busy = true;
    state.override = false;
    try {
      await view.setState(
        { ...view.getState(), mode: "source" },
        { history: false }
      );
      if (!this.current(view, state)) return;
      const cm = codeMirror(view.editor);
      if (!cm) return;
      const change = noteModeChange(cm.state.doc.toString(), false, {
        parse: import_obsidian.parseYaml,
        stringify: import_obsidian.stringifyYaml
      });
      if (change)
        cm.dispatch({
          changes: change,
          filter: false,
          annotations: import_commands.isolateHistory.of("full")
        });
      state.preference = "off";
      await this.apply(view, state, false);
      new import_obsidian.Notice("This note will open as ordinary Markdown.");
    } catch (error) {
      new import_obsidian.Notice(`Could not update CNotes properties: ${String(error)}`);
    } finally {
      state.busy = false;
      this.schedule();
    }
  }
};

// src/main.ts
var import_commands4 = require("@codemirror/commands");

// src/editor/workspace.ts
var import_obsidian3 = require("obsidian");
var import_commands3 = require("@codemirror/commands");
var import_state5 = require("@codemirror/state");
var import_view4 = require("@codemirror/view");

// src/objects/card.ts
var import_obsidian2 = require("obsidian");
var import_state4 = require("@codemirror/state");
var import_view3 = require("@codemirror/view");
var import_commands2 = require("@codemirror/commands");

// src/highlighting/python.ts
var keywords = new Set(
  "False None True and as assert async await break case class continue def del elif else except finally for from global if import in is lambda match nonlocal not or pass raise return try while with yield".split(
    " "
  )
);
var builtins = new Set(
  "abs all any bool bytes dict enumerate filter float int isinstance len list map max min object open print range repr reversed round set sorted str sum super tuple type zip self cls".split(
    " "
  )
);
function pythonTokens(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const start = i, rest = source.slice(i);
    if (source[i] === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      tokens.push({ from: start, to: i, kind: "comment" });
      continue;
    }
    const str = /^(?:[rRuUbBfF]{1,2})?("""|'''|"|')/.exec(rest);
    if (str) {
      const quote = str[1];
      i += str[0].length;
      while (i < source.length) {
        if (source[i] === "\\") {
          i = Math.min(source.length, i + 2);
          continue;
        }
        if (source.startsWith(quote, i)) {
          i += quote.length;
          break;
        }
        if (quote.length === 1 && source[i] === "\n") break;
        i++;
      }
      tokens.push({ from: start, to: i, kind: "string" });
      continue;
    }
    const number = /^(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)(?:[eE][+-]?\d[\d_]*)?)[jJ]?/.exec(
      rest
    );
    if (number) {
      i += number[0].length;
      tokens.push({ from: start, to: i, kind: "number" });
      continue;
    }
    const decorator = /^@[A-Za-z_]\w*(?:\.\w+)*/.exec(rest);
    if (decorator) {
      i += decorator[0].length;
      tokens.push({ from: start, to: i, kind: "decorator" });
      continue;
    }
    const identifier = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(rest);
    if (identifier) {
      i += identifier[0].length;
      const kind = keywords.has(identifier[0]) ? "keyword" : builtins.has(identifier[0]) ? "builtin" : null;
      if (kind) tokens.push({ from: start, to: i, kind });
      continue;
    }
    if (/[+\-*/%=<>!&|^~:]/.test(source[i]))
      tokens.push({ from: i, to: i + 1, kind: "operator" });
    i++;
  }
  return tokens;
}
var providers = [
  {
    id: "python-minimal",
    name: "CNotes minimal Python",
    languages: ["py", "python", "python3"],
    tokenize: pythonTokens
  },
  { id: "plain", name: "Plain text", languages: [], tokenize: () => [] }
];

// src/objects/card.ts
var Card = class {
  constructor(host, block) {
    this.host = host;
    this.block = block;
    const doc = host.view.dom.ownerDocument;
    this.el = doc.createElement("section");
    this.el.className = `cnotes-card cnotes-${block.kind}`;
    this.el.dataset.cnotesId = this.id;
    this.el.setAttribute(
      "aria-label",
      block.kind === "code" ? `${block.language || "Plain text"} code block` : "Floating image"
    );
    const header = this.el.appendChild(doc.createElement("header"));
    header.className = "cnotes-card-header";
    this.title = header.appendChild(doc.createElement("button"));
    this.title.className = "cnotes-drag-handle";
    this.title.textContent = block.kind === "code" ? `${block.language || "Plain text"} \xB7 drag` : "Image \xB7 drag";
    this.title.title = "Drag to move. Arrow keys move; Shift + arrows move 10 pixels.";
    const inline = header.appendChild(doc.createElement("button"));
    inline.className = "cnotes-inline-button";
    inline.textContent = "\u21A9";
    inline.title = "Return to inline Markdown";
    inline.setAttribute("aria-label", "Return to inline Markdown");
    inline.addEventListener("click", () => host.unfloat(this.id));
    this.content = this.el.appendChild(doc.createElement("div"));
    this.content.className = "cnotes-card-content";
    this.resize = this.el.appendChild(doc.createElement("button"));
    this.resize.className = "cnotes-resize";
    this.resize.textContent = "\u25E2";
    this.resize.title = "Drag to resize. Arrow keys resize; Shift + arrows resize by 10 pixels.";
    this.resize.setAttribute("aria-label", "Resize floating object");
    this.bindPointer(this.title, false);
    this.bindPointer(this.resize, true);
    this.bindKeyboard(this.title, false);
    this.bindKeyboard(this.resize, true);
    if (block.kind === "image") {
      this.content.tabIndex = 0;
      this.content.setAttribute("role", "button");
      this.content.setAttribute(
        "aria-label",
        "Open image or drawing; drag to move"
      );
      this.bindPointer(this.content, false, true);
      this.content.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          void this.open();
        }
      });
    }
    this.resizeObserver = new doc.defaultView.ResizeObserver(() => {
      if (!this.dead) host.geometryChanged();
    });
    this.resizeObserver.observe(this.content);
    if (block.kind === "code")
      this.content.addEventListener(
        "scroll",
        () => {
          if (!this.dead) this.resetWrapping();
        },
        { passive: true }
      );
    this.update(block);
  }
  host;
  el;
  content;
  title;
  resize;
  editor;
  component;
  highlighter = new import_state4.Compartment();
  renderedSource = "";
  renderedProvider = "";
  syncing = false;
  dead = false;
  cancelDrag;
  resizeObserver;
  block;
  get id() {
    return this.block.placement.id;
  }
  update(block) {
    this.block = block;
    this.title.textContent = block.kind === "code" ? `${block.language || "Plain text"} \xB7 drag` : /\.excalidraw(?:\.md)?(?:#|$)/i.test(block.target ?? "") ? "Excalidraw \xB7 drag" : "Image \xB7 drag";
    if (block.kind === "code") this.updateCode();
    else if (this.renderedSource !== block.source) {
      this.renderedSource = block.source;
      void this.renderImage();
    }
  }
  refreshImage() {
    if (this.block.kind === "image") void this.renderImage();
  }
  async renderImage() {
    this.component?.unload();
    this.component = new import_obsidian2.Component();
    this.component.load();
    const component = this.component;
    const target = this.content.ownerDocument.createElement("div");
    target.className = "cnotes-preview-body";
    this.content.replaceChildren(target);
    this.content.classList.add("markdown-rendered");
    try {
      await import_obsidian2.MarkdownRenderer.render(
        this.host.app,
        this.block.source,
        target,
        this.host.sourcePath,
        component
      );
      if (!this.dead && this.component === component)
        this.host.geometryChanged();
      else component.unload();
    } catch {
      if (!this.dead && this.component === component)
        target.textContent = "Preview unavailable. Click to open the source.";
    }
  }
  highlighting() {
    const language = this.block.language;
    const provider = providers.find(
      (p) => p.id === this.host.settings.highlighter && p.languages.includes(language)
    );
    return import_view3.ViewPlugin.fromClass(
      class {
        decorations;
        constructor(view) {
          this.decorations = this.build(view);
        }
        update(update) {
          if (update.docChanged) this.decorations = this.build(update.view);
        }
        build(view) {
          return import_view3.Decoration.set(
            (provider?.tokenize(view.state.doc.toString()) ?? []).map(
              (token) => import_view3.Decoration.mark({ class: `cnotes-token-${token.kind}` }).range(
                token.from,
                token.to
              )
            ),
            true
          );
        }
      },
      { decorations: (p) => p.decorations }
    );
  }
  updateCode() {
    const text = bodyText(this.host.source(), this.block);
    const providerKey = this.host.settings.highlighter + ":" + this.block.language;
    if (!this.editor) {
      this.editor = new import_view3.EditorView({
        parent: this.content,
        state: import_state4.EditorState.create({
          doc: text,
          extensions: [
            import_view3.EditorView.lineWrapping,
            import_view3.EditorView.contentAttributes.of({
              "aria-label": `${this.block.language || "Plain text"} code editor`,
              spellcheck: "false"
            }),
            this.highlighter.of(this.highlighting()),
            import_view3.keymap.of([
              { key: "Mod-z", run: () => this.history(false) },
              { key: "Mod-Shift-z", run: () => this.history(true) },
              { key: "Mod-y", run: () => this.history(true) },
              import_commands2.indentWithTab,
              ...import_commands2.defaultKeymap
            ]),
            flowExtension(() => this.host.imageRects(this.id)),
            import_view3.EditorView.updateListener.of((update) => {
              if (update.docChanged && !this.syncing)
                this.host.codeChanged(
                  this.id,
                  update.state.doc.toString(),
                  update.transactions.at(-1)?.annotation(import_state4.Transaction.userEvent) ?? "input"
                );
            })
          ]
        })
      });
    } else if (!this.syncing && this.editor.state.doc.toString() !== text) {
      const old = this.editor.state.doc.toString();
      let from = 0, endOld = old.length, endNew = text.length;
      while (from < endOld && from < endNew && old[from] === text[from]) from++;
      while (endOld > from && endNew > from && old[endOld - 1] === text[endNew - 1]) {
        endOld--;
        endNew--;
      }
      this.syncing = true;
      this.editor.dispatch({
        changes: { from, to: endOld, insert: text.slice(from, endNew) },
        annotations: import_state4.Transaction.addToHistory.of(false)
      });
      this.syncing = false;
    }
    if (this.renderedProvider !== providerKey) {
      this.renderedProvider = providerKey;
      this.editor.dispatch({
        effects: this.highlighter.reconfigure(this.highlighting())
      });
    }
  }
  resetWrapping() {
    if (this.editor && !this.dead)
      this.editor.dispatch({ effects: resetFlow.of(null) });
  }
  history(forward) {
    const scroller = this.host.view.scrollDOM, top = scroller.scrollTop;
    const handled = (forward ? import_commands2.redo : import_commands2.undo)(this.host.view);
    if (handled)
      this.host.view.dom.ownerDocument.defaultView.requestAnimationFrame(
        () => {
          if (!this.dead) {
            this.editor?.focus();
            scroller.scrollTop = top;
          }
        }
      );
    return handled;
  }
  focusCode() {
    this.editor?.focus();
  }
  async open() {
    const target = this.block.target;
    if (!target) return;
    if (/^https?:\/\//i.test(target)) {
      window.open(target, "_blank", "noopener");
      return;
    }
    await this.host.app.workspace.openLinkText(
      target,
      this.host.sourcePath,
      "tab"
    );
  }
  bindPointer(target, resizing, clickOpens = false) {
    target.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || this.cancelDrag) return;
      event.preventDefault();
      event.stopPropagation();
      target.focus({ preventScroll: true });
      const start = { ...this.block.placement };
      const startX = event.clientX, startY = event.clientY;
      const scrollStart = this.host.view.scrollDOM.scrollTop;
      const pointer = event.pointerId;
      let moved = false, current = { ...start };
      target.setPointerCapture(pointer);
      const move = (e) => {
        if (e.pointerId !== pointer) return;
        const dx = e.clientX - startX, dy = e.clientY - startY + this.host.view.scrollDOM.scrollTop - scrollStart;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        moved = true;
        this.el.classList.add("is-dragging");
        const available = this.host.availableWidth();
        if (resizing) {
          current.w = Math.max(
            96,
            Math.min(Math.max(96, available), start.w + dx)
          );
          current.h = Math.max(
            64,
            Math.min(
              2e3,
              this.block.kind === "image" && !e.shiftKey ? start.h * (current.w / start.w) : start.h + dy
            )
          );
        } else {
          current.x = Math.max(
            0,
            Math.min(1, start.x + dx / Math.max(1, available - start.w))
          );
          current.y = Math.max(-1e5, Math.min(1e5, start.y + dy));
          const scroller = this.host.view.scrollDOM, rect = scroller.getBoundingClientRect();
          if (e.clientY > rect.bottom - 32) scroller.scrollTop += 12;
          else if (e.clientY < rect.top + 32) scroller.scrollTop -= 12;
        }
        this.host.preview(this.id, current);
      };
      const finish = (cancel, e) => {
        if (e && e.pointerId !== pointer) return;
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
        target.removeEventListener("pointercancel", cancelled);
        target.removeEventListener("lostpointercapture", cancelled);
        target.ownerDocument.removeEventListener("keydown", escape, true);
        if (target.hasPointerCapture(pointer))
          target.releasePointerCapture(pointer);
        this.cancelDrag = void 0;
        this.el.classList.remove("is-dragging");
        this.host.preview(this.id, null);
        if (!cancel && moved) this.host.commit(this.id, current);
        else if (!cancel && clickOpens) void this.open();
      };
      const up = (e) => finish(false, e), cancelled = (e) => finish(true, e);
      const escape = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(true);
        }
      };
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
      target.addEventListener("pointercancel", cancelled);
      target.addEventListener("lostpointercapture", cancelled);
      target.ownerDocument.addEventListener("keydown", escape, true);
      this.cancelDrag = () => finish(true);
    });
    target.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );
  }
  bindKeyboard(target, resizing) {
    target.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
        return;
      event.preventDefault();
      event.stopPropagation();
      const p = { ...this.block.placement }, step = event.shiftKey ? 10 : 1;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0, dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
      if (resizing) {
        p.w = Math.max(96, Math.min(this.host.availableWidth(), p.w + dx));
        p.h = Math.max(64, Math.min(2e3, p.h + dy));
      } else {
        p.x = Math.max(
          0,
          Math.min(1, p.x + dx / Math.max(1, this.host.availableWidth() - p.w))
        );
        p.y = Math.max(-1e5, Math.min(1e5, p.y + dy));
      }
      this.host.commit(this.id, p);
    });
  }
  destroy() {
    this.dead = true;
    this.cancelDrag?.();
    this.resizeObserver.disconnect();
    this.editor?.destroy();
    this.component?.unload();
    this.el.remove();
  }
};

// src/editor/workspace.ts
var WorkspaceController = class {
  constructor(view, host) {
    this.view = view;
    this.host = host;
    this.layer = view.dom.ownerDocument.createElement("div");
    this.layer.className = "cnotes-layer";
    view.scrollDOM.append(this.layer);
    view.scrollDOM.addEventListener("scroll", this.scrollHandler);
    host.controllers.add(this);
    host.editorReady();
    this.sync();
    this.measure();
  }
  view;
  host;
  cards = /* @__PURE__ */ new Map();
  previews = /* @__PURE__ */ new Map();
  layer;
  anchors = /* @__PURE__ */ new Map();
  needAnchors = true;
  dead = false;
  pending = false;
  generation = 0;
  layoutKey = "";
  positions = /* @__PURE__ */ new Map();
  width = 0;
  scrollHandler = () => this.measure();
  get app() {
    return this.host.app;
  }
  get settings() {
    return this.host.settings;
  }
  get sourcePath() {
    return this.view.state.field(import_obsidian3.editorInfoField, false)?.file?.path ?? "";
  }
  source = () => this.view.state.doc.toString();
  availableWidth = () => this.width || this.view.contentDOM.clientWidth;
  get active() {
    return this.view.state.field(modeField);
  }
  update(update) {
    if (update.docChanged || update.transactions.some((t) => t.effects.some((e) => e.is(setMode)))) {
      this.needAnchors = true;
      this.generation++;
    }
    if (update.docChanged || update.transactions.some(
      (t) => t.effects.some((e) => e.is(setMode) || e.is(refreshObjects))
    ))
      this.sync();
    if (update.transactions.some(
      (t) => t.effects.some((e) => e.is(refreshObjects))
    )) {
      for (const c of this.cards.values()) c.refreshImage();
      this.layoutKey = "";
    }
    this.measure();
  }
  sync() {
    this.view.dom.classList.toggle("cnotes-active", this.active);
    const blocks = this.active ? this.view.state.field(blocksField).filter((b) => b.placement) : [];
    const ids = new Set(blocks.map((b) => b.placement.id));
    for (const [id, card] of this.cards)
      if (!ids.has(id)) {
        this.cards.delete(id);
        card.destroy();
        this.anchors.delete(id);
      }
    for (const block of blocks) {
      const id = block.placement.id;
      let card = this.cards.get(id);
      if (card && card.block.kind !== block.kind) {
        card.destroy();
        this.cards.delete(id);
        card = void 0;
      }
      if (card) card.update(block);
      else {
        card = new Card(this, block);
        this.cards.set(id, card);
        this.layer.append(card.el);
      }
    }
    this.layer.hidden = !this.active;
  }
  rects(imagesOnly = false) {
    if (!this.active) return [];
    const gap = this.settings.gap;
    return [...this.cards.values()].filter((c) => !imagesOnly || c.block.kind === "image").map((c) => {
      const r = c.el.getBoundingClientRect();
      return {
        left: r.left - gap,
        right: r.right + gap,
        top: r.top - gap,
        bottom: r.bottom + gap
      };
    });
  }
  imageRects = (_id) => this.rects(true);
  geometryChanged = () => this.measure();
  measure() {
    if (this.dead) return;
    this.view.requestMeasure({
      key: this,
      read: (view) => {
        if (!this.active || this.pending) return null;
        const content = view.contentDOM.getBoundingClientRect(), scroll = view.scrollDOM.getBoundingClientRect();
        const style = view.dom.ownerDocument.defaultView.getComputedStyle(
          view.contentDOM
        );
        const padLeft = parseFloat(style.paddingLeft) || 0, padRight = parseFloat(style.paddingRight) || 0;
        this.width = Math.max(96, content.width - padLeft - padRight);
        {
          for (const block of view.state.field(blocksField))
            if (block.placement && (this.needAnchors || (this.previews.get(block.placement.id) ?? block.placement).y >= this.settings.gap)) {
              const anchor = view.contentDOM.querySelector(
                `[data-cnotes-anchor="${block.placement.id}"]`
              );
              this.anchors.set(
                block.placement.id,
                anchor ? anchor.getBoundingClientRect().top - view.documentTop : view.lineBlockAt(block.markerFrom ?? block.from).top
              );
            }
          this.needAnchors = false;
        }
        const placements = [...this.cards.values()].map((card) => {
          const p = this.previews.get(card.id) ?? card.block.placement, w = Math.min(p.w, this.width), h = p.h;
          const x = padLeft + p.x * Math.max(0, this.width - w), y = Math.max(0, (this.anchors.get(card.id) ?? 0) + p.y);
          return {
            card,
            x,
            y,
            w,
            h,
            left: content.left - scroll.left + view.scrollDOM.scrollLeft + x,
            top: view.documentTop - scroll.top + view.scrollDOM.scrollTop + y
          };
        });
        return {
          placements,
          key: placements.map(
            (p) => `${p.card.id}:${p.x.toFixed(1)},${p.y.toFixed(1)},${p.w.toFixed(1)},${p.h.toFixed(1)}`
          ).join("|")
        };
      },
      write: (data) => {
        if (!data || this.dead) return;
        for (const p of data.placements) {
          const style = p.card.el.style;
          style.left = `${p.left}px`;
          style.top = `${p.top}px`;
          style.width = `${p.w}px`;
          style.height = `${p.h}px`;
        }
        if (data.key !== this.layoutKey) {
          this.layoutKey = data.key;
          let cutoff = this.view.state.doc.length;
          for (const p of data.placements) {
            const key = [p.x, p.y, p.w, p.h].map((n) => n.toFixed(1)).join(",");
            if (this.positions.get(p.card.id) !== key) {
              const placement = this.previews.get(p.card.id) ?? p.card.block.placement;
              cutoff = Math.min(
                cutoff,
                placement.y >= this.settings.gap ? p.card.block.markerFrom ?? p.card.block.from : 0
              );
              this.positions.set(p.card.id, key);
            }
          }
          this.later(() => {
            this.view.dispatch({ effects: resetFlow.of(cutoff) });
            for (const card of this.cards.values()) card.resetWrapping();
          });
        }
      }
    });
  }
  later(action) {
    if (this.pending) return;
    this.pending = true;
    const generation = this.generation;
    queueMicrotask(() => {
      if (!this.dead && generation === this.generation) action();
      this.pending = false;
      this.measure();
    });
  }
  preview = (id, p) => {
    if (p) this.previews.set(id, p);
    else this.previews.delete(id);
    this.measure();
  };
  commit = (id, p) => {
    const block = this.find(id);
    if (!block || block.markerFrom === void 0 || block.markerTo === void 0)
      return;
    const newline = this.source().slice(block.markerFrom, block.markerTo).endsWith("\r\n") ? "\r\n" : "\n";
    this.view.dispatch({
      changes: {
        from: block.markerFrom,
        to: block.markerTo,
        insert: marker(p) + newline
      },
      annotations: [
        import_state5.Transaction.userEvent.of("input.cnotes.layout"),
        import_commands3.isolateHistory.of("full")
      ]
    });
  };
  unfloat = (id) => {
    const block = this.find(id);
    if (!block || block.markerFrom === void 0 || block.markerTo === void 0)
      return;
    this.view.dispatch({
      changes: { from: block.markerFrom, to: block.markerTo, insert: "" },
      selection: { anchor: block.markerFrom },
      annotations: import_commands3.isolateHistory.of("full")
    });
    this.view.focus();
  };
  codeChanged = (id, value, userEvent) => {
    const block = this.find(id);
    if (!block) return;
    const source = this.source();
    if (bodyText(source, block) === value) return;
    const next = codeReplacement(source, block, value), old = source.slice(block.from, block.to);
    let from = 0, endOld = old.length, endNew = next.length;
    while (from < endOld && from < endNew && old[from] === next[from]) from++;
    while (endOld > from && endNew > from && old[endOld - 1] === next[endNew - 1]) {
      endOld--;
      endNew--;
    }
    this.view.dispatch({
      changes: {
        from: block.from + from,
        to: block.from + endOld,
        insert: next.slice(from, endNew)
      },
      annotations: import_state5.Transaction.userEvent.of(userEvent)
    });
  };
  find(id) {
    return this.view.state.field(blocksField).find((b) => b.placement?.id === id);
  }
  destroy() {
    this.dead = true;
    this.generation++;
    for (const c of this.cards.values()) c.destroy();
    this.cards.clear();
    this.layer.remove();
    this.view.dom.classList.remove("cnotes-active");
    this.view.scrollDOM.removeEventListener("scroll", this.scrollHandler);
    this.host.controllers.delete(this);
  }
};
function workspaceExtension(host) {
  const workspace = import_view4.ViewPlugin.define(
    (view) => new WorkspaceController(view, host)
  );
  let warned = false;
  return [
    modeField,
    blocksField,
    objectsField,
    workspace,
    flowExtension(
      (view) => view.plugin(workspace)?.rects() ?? [],
      () => {
        if (!warned) {
          warned = true;
          new import_obsidian3.Notice(
            "CNotes reached a wrapping limit. Move or resize overlapping objects, or toggle CNotes off to edit the original Markdown."
          );
        }
      }
    )
  ];
}

// src/settings.ts
var import_obsidian4 = require("obsidian");
var defaults = {
  highlighter: "python-minimal",
  gap: 12,
  defaultWidth: 280
};
function readSettings(data) {
  const value = data ?? {};
  return {
    highlighter: providers.some((p) => p.id === value.highlighter) ? value.highlighter : "python-minimal",
    gap: typeof value.gap === "number" && Number.isFinite(value.gap) ? Math.max(4, Math.min(40, value.gap)) : 12,
    defaultWidth: typeof value.defaultWidth === "number" && Number.isFinite(value.defaultWidth) ? Math.max(160, Math.min(800, value.defaultWidth)) : 280
  };
}
var CNotesSettingsTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, host) {
    super(app, host);
    this.host = host;
  }
  host;
  display() {
    const el = this.containerEl;
    el.empty();
    el.createEl("h2", { text: "CNotes" });
    el.createEl("p", {
      text: "Enabling CNotes saves a cnotes checkbox in the note's Properties so it opens automatically. Uncheck it to opt out. Assign \u201CToggle CNotes mode\u201D a shortcut in Obsidian \u2192 Hotkeys to switch a pane temporarily."
    });
    new import_obsidian4.Setting(el).setName("Syntax highlighter").setDesc(
      "Python coloring runs locally. Other languages remain editable as plain text."
    ).addDropdown((drop) => {
      for (const p of providers) drop.addOption(p.id, p.name);
      drop.setValue(this.host.settings.highlighter).onChange(async (value) => {
        this.host.settings.highlighter = value;
        await this.host.saveSettings();
      });
    });
    new import_obsidian4.Setting(el).setName("Space around objects").setDesc("Padding between floating objects and surrounding text.").addSlider(
      (slider) => slider.setLimits(4, 40, 2).setValue(this.host.settings.gap).setDynamicTooltip().onChange(async (value) => {
        this.host.settings.gap = value;
        await this.host.saveSettings();
      })
    );
    new import_obsidian4.Setting(el).setName("Initial object width").setDesc("Width in pixels when a block is first floated.").addSlider(
      (slider) => slider.setLimits(160, 800, 20).setValue(this.host.settings.defaultWidth).setDynamicTooltip().onChange(async (value) => {
        this.host.settings.defaultWidth = value;
        await this.host.saveSettings();
      })
    );
  }
};

// src/main.ts
var CNotes = class extends import_obsidian5.Plugin {
  settings = { ...defaults };
  controllers = /* @__PURE__ */ new Set();
  noteModes;
  editorReady = () => this.noteModes?.schedule();
  async onload() {
    this.settings = readSettings(await this.loadData());
    this.registerEditorExtension(workspaceExtension(this));
    this.noteModes = new NoteModes(this);
    this.addSettingTab(new CNotesSettingsTab(this.app, this));
    this.addCommand({
      id: "toggle",
      name: "Toggle CNotes mode",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
        if (!view) return false;
        if (!checking) void this.noteModes.toggle(view);
        return true;
      }
    });
    this.addCommand({
      id: "disable-auto-open",
      name: "Stop opening this note in CNotes automatically",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
        if (!view) return false;
        if (!checking) void this.noteModes.disableAutomatic(view);
        return true;
      }
    });
    this.addCommand({
      id: "float-block",
      name: "Float image or code block at cursor",
      editorCallback: (editor, info) => this.float(editor, info, false)
    });
    this.addCommand({
      id: "float-all",
      name: "Float all supported images and code blocks",
      editorCallback: (editor, info) => this.float(editor, info, true)
    });
    this.addCommand({
      id: "refresh",
      name: "Refresh floating previews",
      callback: () => {
        for (const c of this.controllers)
          c.view.dispatch({
            effects: [refreshObjects.of(null), resetFlow.of(null)]
          });
      }
    });
    this.addRibbonIcon("layout-dashboard", "Toggle CNotes mode", () => {
      const view = this.app.workspace.getActiveViewOfType(import_obsidian5.MarkdownView);
      if (view) void this.noteModes.toggle(view);
    });
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, info) => {
        const cm = codeMirror(editor);
        if (!cm) return;
        const block = this.blockAt(cm);
        if (!block) return;
        menu.addItem(
          (item) => item.setTitle(
            block.placement ? "Return CNotes object to inline" : "Float in CNotes"
          ).setIcon("layout-dashboard").onClick(() => {
            if (block.placement) {
              [...this.controllers].find((c) => c.view === cm)?.unfloat(block.placement.id);
            } else this.float(editor, info, false);
          })
        );
      })
    );
    let timer;
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (![...this.controllers].some(
          (c) => [...c.cards.values()].some(
            (card) => card.block.kind === "image" && card.block.target?.split("#")[0].endsWith(file.name)
          )
        ))
          return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          for (const c of this.controllers)
            c.view.dispatch({ effects: refreshObjects.of(null) });
        }, 250);
      })
    );
    this.register(() => window.clearTimeout(timer));
  }
  async saveSettings() {
    await this.saveData(this.settings);
    for (const c of this.controllers)
      c.view.dispatch({
        effects: [refreshObjects.of(null), resetFlow.of(null)]
      });
  }
  blockAt(cm) {
    const pos = cm.state.selection.main.head;
    return cm.state.field(blocksField, false)?.find((b) => (b.markerFrom ?? b.from) <= pos && b.to >= pos);
  }
  async float(editor, info, all) {
    let cm = codeMirror(editor);
    if (!cm) return;
    let blocks = all ? cm.state.field(blocksField, false) ?? [] : [this.blockAt(cm)].filter((b) => !!b);
    let eligible = blocks.filter((b) => !b.placement && !b.blockedMarker);
    if (!eligible.length) {
      new import_obsidian5.Notice(
        "Place the cursor in a standalone image embed or a complete code fence. Existing or invalid CNotes markers are left intact."
      );
      return;
    }
    if (!(info instanceof import_obsidian5.MarkdownView) || !await this.noteModes.enable(info))
      return;
    cm = codeMirror(info.editor);
    if (!cm) return;
    blocks = all ? cm.state.field(blocksField, false) ?? [] : [this.blockAt(cm)].filter((b) => !!b);
    eligible = blocks.filter((b) => !b.placement && !b.blockedMarker);
    const newline = cm.state.doc.toString().includes("\r\n") ? "\r\n" : "\n";
    const width = this.settings.defaultWidth;
    const changes = eligible.map((b) => ({
      from: b.from,
      insert: marker({
        v: 1,
        id: crypto.randomUUID(),
        x: 0.5,
        y: 24,
        w: b.kind === "code" ? Math.max(360, width) : width,
        h: b.kind === "code" ? 240 : 200
      }) + newline
    }));
    cm.dispatch({
      changes,
      effects: [setMode.of(true), resetFlow.of(null)],
      annotations: import_commands4.isolateHistory.of("full")
    });
    new import_obsidian5.Notice(
      `${eligible.length} ${eligible.length === 1 ? "block" : "blocks"} floated. Drag the header to move; use the corner to resize.`
    );
  }
};
