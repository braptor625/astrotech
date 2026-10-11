# UI redesign spec

Goal: a UI that is easier to navigate and nicer to look at, organized around what the player actually does. In order, that's:
1. decide what to do next
2. act in a console
3. watch it happen

Every panel has to justify the space it takes **right now**. If it has nothing to say, it collapses, hides, or turns into a one-line empty state.

The pixel-art identity stays: Silkscreen and VT323, notched bevelled panels, and the palette tokens in `style.css`. The text-size tokens (`--fs-*`, `--fb-*`), high contrast, reduce motion, and keyboard focus rings all stay working.

## Decisions (and why)

| Question | Answer |
|---|---|
| Why is there a status log when nothing is flying? | **There shouldn't be.** The permanent lower panel (Flights / Mission Log) goes away. Flights become an adaptive **Flight Deck** under the viewport that exists only while ships are in the air. The log becomes an **Activity drawer** you open on demand, with an unread badge. |
| Where does the Board directive go? | Into the **top bar** as a compact "Board order" pill: number, text, and a progress pip. It's always visible and close to the money, and clicking it opens Archive → Directives. The strip under the viewport is removed. |
| Ten tabs that wrap into 2–3 rows? | A **grouped nav rail** on the left, with an icon, a label and a badge for each console, in four groups. It never wraps. There are also keyboard shortcuts. |
| Which gets the space, console or viewport? | **The console is primary** (it's where you work); the viewport is a **monitor** you glance at. Columns: nav rail · console (flexible, gets the most width) · monitor (viewport plus contextual panels). |
| The ticker? | It becomes a one-line overlay along the bottom edge of the viewport for notable lines (story, losses, prestige), and fades out. Routine lines only go to Activity. |
| Toasts? | Top-right, under the top bar. At most two, and they auto-dismiss. They must never cover the console's primary actions or the Flight Deck. |
| Badges? | Each badge says what needs you: idle ships (Missions), worn hulls (Fleet), candidates or a strike (Crew), cargo in the hold or a deliverable contract (Market), affordable research (Research), affordable projects (Projects), prestige ready (Expansion). Numbers where they help, a dot otherwise. They replace the old blinking "new" dots, and an unseen new console also shows a dot. |
| Empty sections? | Hidden if the system isn't unlocked. Collapsed to a one-line empty state if it's unlocked but empty ("No contracts on the board. Clients call every few minutes."). Never a big empty box. |

## Layout (desktop, at least 1280 wide)

```
┌─────────────────────────────── TOP BAR ───────────────────────────────────────────┐
│ ASTROTECH │ $cash +rate │ equity │ RP │ rep │ layer currencies │ ▸ BOARD ORDER 7/40: … ▮▮▯ │ ⚑ Activity(3) │ ♪ │ ⚙ │
├──────────┬──────────────────────────────────────────┬────────────────────────────────┤
│ NAV RAIL │ CONSOLE                                  │ MONITOR                        │
│ OPERATIONS│ ┌ header: title · one-line purpose ·    │ ┌ viewport 16:9 ───────────┐   │
│ ▣ Missions 2│   primary action (right) ┐             │ │ [MAP|LAUNCH|CLOSE-UP] ⟨reg⟩│   │
│ ▣ Fleet  !  │ sections (cards), dense rows,         │ │ decision cards overlay     │   │
│ ▣ Crew      │ master–detail where it helps          │ │ ticker overlay (1 line)    │   │
│ ▣ Outposts  │                                       │ └───────────────────────────┘   │
│ ECONOMY     │                                       │ FLIGHT DECK (only if flying)    │
│ ▣ Market  • │                                       │  ship → target  phase  ETA ▮▮▯  │
│ ▣ Company   │                                       │  +N more · 3 idle [DISPATCH]    │
│ ▣ Projects  │                                       │ (when nothing flies: an ops     │
│ SCIENCE     │                                       │  summary card: pads free, idle  │
│ ▣ Research 3│                                       │  ships, best target → LAUNCH)   │
│ PROGRESS    │                                       │                                 │
│ ▣ Expansion │                                       │                                 │
│ ▣ Archive   │                                       │                                 │
└──────────┴──────────────────────────────────────────┴────────────────────────────────┘
```

- **Widths.** The rail is about 168px with labels at 1440+ wide. Below that it's a narrow rail of about 76px with the icon above a short label. The console is `minmax(520px, 1fr)` and the monitor `clamp(420px, 38vw, 760px)`. The viewport keeps its integer-scale canvas logic. `scene.js` sizes from its parent width, so check it still picks scale 3 at 1920 and 2 at 1366.
- **Rail groups.** OPERATIONS (Missions, Fleet, Crew, Outposts), ECONOMY (Market, Company, Projects), SCIENCE (Research) and PROGRESS (Expansion, Archive). Hidden consoles stay hidden until they're revealed. A group header only shows once one of its consoles is revealed.
- **Keyboard.** `1`–`0` open consoles in rail order. `[` and `]` cycle viewport views. `A` toggles Activity. `Esc` closes the drawer or modal. Nothing fires while focus is in a text field.
- **Activity drawer.** It slides over the monitor column, with filter chips: All · Missions · Money · Story · Alerts. It contains the same entries as the old Mission Log, and its unread count resets when it's opened.
- **Narrow screens (below 900).** One column in this order: top bar (with the directive pill wrapped to a second line), console, monitor. The rail becomes a bottom tab bar of icons. This needn't be perfect, but it must not overflow.

## Console conventions (for every `PANELS.*`)

- **Header:** `.con-head` has an `h2` title and a dim one-line purpose on the left, and the console's single **primary action** on the right. Examples:
  - Missions: DISPATCH IDLE
  - Market: SELL EVERYTHING
  - Research: no action, show the RP rate instead
  - Expansion: the prestige button when ready
- **Sections:** `.sect`, with a small caps heading, an optional count, and an optional right-side control. Sections may collapse; remember that state in `S.settings.collapsed[console+section]`.
- **Lists:** dense `.row`s on a consistent grid, with numbers right-aligned in `tabular-nums` and at most one gold button per row. Selection is shown with a gold edge, not a full fill.
- **Master–detail:** used where a list drives a detail view (Missions targets → target detail; Crew pilots → pilot; Outposts). At console widths of 900px or more, the list and the detail sit side by side. Below that, the detail sits above the list.
- **Hierarchy:**
  - One primary gold button per region.
  - Secondary buttons are blue.
  - Destructive actions are red and need a confirm.
  - Disabled buttons explain why in their tooltip.
- **Spacing:** 4/8/12/16px steps. Use fewer nested bevels: rows inside a section are flat with hairline separators, and only sections get the panel bevel.
- **Empty states:** one line, dim, with a hint of what unlocks it.

## Compatibility contract (don't break these)

- Keep every existing `data-act` name and `data-arg` value. Nav items keep `data-act="tab" data-arg="<id>"`, view buttons keep `data-act="view"`, and so on. `guide.js` (the tutorial coach marks), `tools/playtest.py`, `tools/shot*.py` and the dispatcher depend on them. If an element moves, update guide.js's anchors and the test scripts in the same change.
- Keep the `sig()/build()/update()` panel pattern and the `data-k` value binding.
- `#cardbox` (incident cards), `#modal`, `#tooltip`, `#toasts` and the tutorial overlay and briefing card must still position correctly in the new layout.
- The demo build (`node tools/build.mjs --demo`) and its end screen still work.
- Tests: `node tools/build.mjs` and `--demo`; `python3 tools/shot.py <dir> [W] [text] [H]` at 1366×800, 1920×1080 and 1280×720 at large and xl; `python3 tools/shot_demo.py`; `python3 tools/shot_tutorial.py <dir>`; `python3 tools/playtest.py <dir>`. Everything prints no console errors, and there's no horizontal overflow.
