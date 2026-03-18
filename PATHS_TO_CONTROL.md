# PATHS_TO_CONTROL — Hypercontroller Window Control

> **Status:** Design specification — implementation in progress.

## Overview

Hypercontroller lets you drag a "bullseye" target from the CLUI overlay onto any visible macOS window to give Claude control of that application. Once attached, Claude can read application state, drive UI actions, and remember effective interaction patterns using a local heuristics database.

---

## Interaction Model

```
┌─────────────────────────────────────────────────────────┐
│  CLUI Mini Player                                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │  [C] New Tab          [⊙] ← drag this bullseye  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
           │
           │  user drags bullseye icon over target window
           ▼
┌─────────────────────────────────────┐
│  Target App (e.g. Cursor, Safari)   │
│  ← drop bullseye here to attach     │
└─────────────────────────────────────┘
           │
           ▼
  CLUI attaches → AX inspector active → Claude can drive it
```

### UX Flow

1. **Drag Initiation** — User drags the `⊙` bullseye icon from the CLUI title bar / mini player action row.
2. **Window Targeting** — While dragging, CLUI highlights the window under the cursor (calls `setIgnoreMouseEvents(false)`, inspects `NSWindow` under cursor via Accessibility API).
3. **Drop + Attach** — On drop, CLUI captures the target window's PID, bundle ID, and AXUIElement root.
4. **Confirmation Badge** — The bullseye in CLUI turns orange/active with the target app icon and name.
5. **Detach** — Click the active badge, or drag a new window target. Pressing Escape detaches.

---

## Architecture

### Component Map

```
src/
  main/
    hypercontroller/
      index.ts           ← HyperController class (main-process singleton)
      ax-inspector.ts    ← macOS Accessibility API wrapper (Swift native addon OR node-mac-accessibility)
      app-finder.ts      ← enumerate running apps, get window list + PIDs
      heuristics-db.ts   ← local vector/KV store for interaction memory
      action-executor.ts ← translate Claude tool calls → AX actions
  renderer/
    components/
      BullseyeDragger.tsx  ← drag handle UI + drop zone overlay
      HyperControlBadge.tsx ← active-session indicator in title bar
  shared/
    hypercontroller-types.ts  ← shared IPC types
```

### IPC Channels (new)

| Channel | Direction | Purpose |
|---|---|---|
| `clui:hc-attach` | renderer → main | Attach to window by `windowId` |
| `clui:hc-detach` | renderer → main | Detach current session |
| `clui:hc-query` | renderer → main | Inspect AX tree, read element values |
| `clui:hc-action` | renderer → main | Execute AX action (click, type, scroll) |
| `clui:hc-screenshot` | renderer → main | Screenshot of controlled window only |
| `clui:hc-windows` | renderer → main | Enumerate visible windows for targeting |
| `clui:hc-status` | main → renderer | Broadcast attach/detach/error status |

---

## macOS Accessibility API

### Native Addon vs Pure JS

Two options:

**Option A — Swift/ObjC native addon** (`better-sqlite3`-style build)
```
src/native/ax-inspector/
  ax-inspector.mm   ← Objective-C++: AXUIElement wrappers
  binding.gyp
```
Pros: Full AX API access, synchronous, handles complex hierarchies.
Cons: Requires build toolchain, codesign entitlements.

**Option B — AppleScript + `osascript` bridge** (no native addon)
```typescript
// Quick & dirty: use osascript for basic actions
execSync(`osascript -e 'tell application "Cursor" to activate'`)
```
Pros: Zero native build, works immediately.
Cons: Limited to apps with AppleScript dictionaries, slow, no AX tree.

**Recommended path:** Start with Option B for prototyping, migrate hot paths to Option A.

### Required Entitlements (macOS)

```xml
<!-- entitlements.plist -->
<key>com.apple.security.automation.apple-events</key>
<true/>
```

Also requires user granting **Accessibility** permission in **System Preferences → Privacy & Security → Accessibility**.

### Requesting Permission

```typescript
// ax-inspector.ts
import { systemPreferences } from 'electron'

export function checkAccessibilityPermission(): boolean {
  if (process.platform !== 'darwin') return true
  return systemPreferences.isTrustedAccessibilityClient(false)
}

export function requestAccessibilityPermission(): void {
  systemPreferences.isTrustedAccessibilityClient(true)
  // Shows system dialog first time; user must grant manually
}
```

### AX Tree Query (via node-mac-accessibility or native)

```typescript
// Pseudocode for AX inspection
interface AXNode {
  role: string           // AXButton, AXTextField, AXWebArea, etc.
  title: string | null
  value: string | null
  position: { x: number; y: number }
  size: { width: number; height: number }
  children: AXNode[]
  actions: string[]      // AXPress, AXSetValue, etc.
}

// Get root element of target window
const root = AXUIElementCreateApplication(pid)
const window = getFirstWindowElement(root)
const tree = buildAXTree(window, depth = 4)  // limit depth for perf
```

---

## Heuristics Database

### Purpose

Store a local memory of "what works" for each app — effective click paths, element selectors, common workflows — so Claude doesn't need to re-explore the AX tree from scratch every session.

### Schema

```typescript
interface HeuristicEntry {
  id: string              // hash of (bundleId + intentSlug)
  bundleId: string        // com.todesktop.230313mzl4w4u92 (Cursor)
  appVersion?: string
  intentSlug: string      // e.g. "open-file", "run-command", "search"
  description: string     // human-readable summary
  steps: HeuristicStep[]
  successCount: number
  failureCount: number
  lastUsed: number        // unix ms
  embedding?: number[]    // vector embedding for semantic search
}

interface HeuristicStep {
  type: 'ax_action' | 'keyboard' | 'applescript' | 'delay'
  target?: string         // AX selector path
  action?: string         // AXPress, AXSetValue
  value?: string
  key?: string            // for keyboard steps
  ms?: number             // for delay steps
}
```

### Storage Options

#### Option A — `better-sqlite3` (recommended for structured data)

```typescript
// heuristics-db.ts
import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

const DB_PATH = join(app.getPath('userData'), 'hypercontroller', 'heuristics.db')

export class HeuristicsDB {
  private db: Database.Database

  constructor() {
    this.db = new Database(DB_PATH)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS heuristics (
        id TEXT PRIMARY KEY,
        bundle_id TEXT NOT NULL,
        app_version TEXT,
        intent_slug TEXT NOT NULL,
        description TEXT NOT NULL,
        steps TEXT NOT NULL,  -- JSON
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 1,
        last_used INTEGER NOT NULL,
        embedding BLOB  -- stored as Float32Array binary
      );
      CREATE INDEX IF NOT EXISTS idx_bundle ON heuristics(bundle_id);
    `)
  }

  upsert(entry: HeuristicEntry): void { ... }
  query(bundleId: string, intentSlug: string): HeuristicEntry | null { ... }
  search(bundleId: string, queryEmbedding: number[], topK = 5): HeuristicEntry[] { ... }
  recordOutcome(id: string, success: boolean): void { ... }
}
```

#### Option B — `ruvector` (for semantic/embedding-first retrieval)

[ruvector](https://github.com/dimfeld/ruvector) is a local Rust-backed vector store. Use when semantic similarity search over natural-language intent descriptions is the primary access pattern.

```typescript
// heuristics-db.ts (ruvector variant)
import { VectorStore } from 'ruvector'

const store = new VectorStore({
  path: join(app.getPath('userData'), 'hypercontroller', 'vectors'),
  dimensions: 1536,  // match embedding model output
})

// Index a heuristic
await store.add(entry.id, entry.embedding!, {
  bundleId: entry.bundleId,
  intentSlug: entry.intentSlug,
  stepsJson: JSON.stringify(entry.steps),
})

// Semantic search: "how do I open a file in Cursor?"
const matches = await store.search(queryEmbedding, { filter: { bundleId }, topK: 5 })
```

**Recommendation:** Use `better-sqlite3` with a Float32 BLOB column for embeddings — this gives both structured queries (by bundleId + intentSlug) and cosine-similarity search via a pure-JS implementation. Add `ruvector` if search latency becomes a bottleneck with large heuristic sets.

---

## Claude Tool Integration

Hypercontroller exposes tools that Claude can call during a session when a window is attached:

```typescript
const HYPERCONTROLLER_TOOLS = [
  {
    name: 'hc_query_ui',
    description: 'Read the accessibility tree of the controlled window. Returns elements with roles, labels, and available actions.',
    input_schema: {
      type: 'object',
      properties: {
        depth: { type: 'number', description: 'Tree depth to traverse (1-6, default 3)' },
        filter_role: { type: 'string', description: 'Only return elements with this AX role' },
      }
    }
  },
  {
    name: 'hc_click',
    description: 'Click an accessibility element in the controlled window.',
    input_schema: {
      type: 'object',
      required: ['selector'],
      properties: {
        selector: { type: 'string', description: 'AX selector path (e.g. "AXWindow > AXButton[title=\'Open\']")' },
      }
    }
  },
  {
    name: 'hc_type',
    description: 'Type text into a focused element in the controlled window.',
    input_schema: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string' },
        selector: { type: 'string', description: 'Optional: focus this element first' },
      }
    }
  },
  {
    name: 'hc_screenshot',
    description: 'Take a screenshot of the controlled window to visually confirm state.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'hc_recall',
    description: 'Search the heuristics database for known interaction patterns for this app.',
    input_schema: {
      type: 'object',
      required: ['intent'],
      properties: {
        intent: { type: 'string', description: 'What you want to accomplish (e.g. "open a file")' },
      }
    }
  },
  {
    name: 'hc_remember',
    description: 'Save a successful interaction pattern to the heuristics database for future use.',
    input_schema: {
      type: 'object',
      required: ['intent', 'steps'],
      properties: {
        intent: { type: 'string' },
        steps: { type: 'array', items: { type: 'object' } },
      }
    }
  },
]
```

These tools are injected into the Claude Code session's `--allowed-tools` list when a Hypercontroller session is active.

---

## Implementation Phases

### Phase 1 — Drag UI + Window Targeting (no AX yet)
- [ ] `BullseyeDragger.tsx`: draggable `⊙` icon in MiniPlayer title bar
- [ ] Drop highlight: on drag-over, call `hc-windows` to get window list, highlight nearest
- [ ] On drop: send `clui:hc-attach` with `{ pid, bundleId, windowTitle }`
- [ ] `HyperControlBadge.tsx`: shows attached app icon + name + detach button

### Phase 2 — Accessibility Permission + Basic AX Query
- [ ] `ax-inspector.ts`: check + request Accessibility permission
- [ ] Window enumeration via `NSWorkspace.runningApplications` (via AppleScript or native)
- [ ] Basic AX tree walker (depth-limited JSON output)
- [ ] `hc_query_ui` and `hc_screenshot` tools wired to Claude session

### Phase 3 — Action Execution
- [ ] `action-executor.ts`: `hc_click`, `hc_type` via AXUIElementPerformAction
- [ ] Keyboard injection via `CGEventPost` (Swift addon) or `osascript`
- [ ] Error recovery: element-not-found retry with re-query

### Phase 4 — Heuristics DB
- [ ] `better-sqlite3` schema creation at startup
- [ ] `hc_recall` / `hc_remember` tools implemented
- [ ] Embedding generation via local model or Claude API for semantic search
- [ ] Automatic success/failure tracking from tool call outcomes

### Phase 5 — App-Specific Profiles
- [ ] Pre-seeded heuristics for Cursor, VS Code, Zed, iTerm2, Terminal, Arc, Chrome, Safari
- [ ] Heuristic export/import (share profiles with other CLUI users)

---

## Known Constraints

| Constraint | Detail |
|---|---|
| Accessibility permission | Must be granted once by user in System Preferences; cannot be automated |
| macOS `type: 'panel'` window | CLUI is an NSPanel; dragging to other windows works but requires careful `setIgnoreMouseEvents` toggling |
| SIP (System Integrity Protection) | Limits AX access to SIP-protected processes; most apps are accessible |
| Sandboxing | App Store builds cannot use AX API; distributing outside App Store is required |
| `resizable: false` | Main window; Hypercontroller does not affect this constraint |

---

## Security Considerations

- All AX actions require explicit user attachment (no background sniffing)
- Heuristics DB stores only structural/selector data — no credentials or sensitive values
- `hc_type` tool redacts values matching common secret patterns before storing in heuristics
- Permission prompt explains exactly what access is being requested
- Detach is always one click away; Claude cannot reattach without user initiation
