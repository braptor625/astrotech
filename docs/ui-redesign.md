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

## Components (phase 1, for the `PANELS.*` rebuilds)

All live in `style.css`. A console renders into `#tabbody`, which is a container (`container-name: con`), so `.md` reacts to the console width, not the window.

**`.con-head`**: header. Helper: `conHead(title, purpose, actionHTML)` in `ui.js` (also `AT.ui.conHead`). Every existing console already uses it.
```html
<div class="con-head"><div class="ch-title"><h2>Market</h2><p class="purpose">Sell ore and deliver contracts.</p></div>
  <div class="ch-act"><button class="btn gold" data-act="sellall">SELL EVERYTHING</button></div></div>
```

**`.sect` / `.sect-head`**: the only bevelled box inside a console. Helper: `sect(key, title, {count, ctl}, bodyHTML)` with `key = 'console:section'`. The title is a button (`data-act="collapse"`) that toggles `S.settings.collapsed[key]`; the act clears the panel `sig`, so rebuild reads `isCollapsed(key)` (also `AT.ui.isCollapsed`).
```html
<section class="sect"><div class="sect-head"><h3><button class="sect-tog" data-act="collapse" data-arg="market:contracts" aria-expanded="true">Contracts</button></h3>
  <span class="count">3</span><div class="sect-ctl"><button class="btn tiny">REFRESH</button></div></div><div class="sect-body">...rows...</div></section>
```

**`.row`**: flat dense row, hairline separators. Set the grid with `--cols`; put numbers in `.num` (right-aligned, tabular). `.row.sel` gets the gold edge. At most one gold button per row. (The old crew staff row is `.row.slot`, which keeps its legacy layout until phase 2 replaces it.)
```html
<div class="row sel" style="--cols:28px minmax(0,1fr) 90px auto" data-act="seltarget" data-arg="12"><img class="tico" src="..."><span>2187 BP85 Ludmila <span class="dim">S-type</span></span><span class="num">$24.1K</span><button class="btn gold tiny">LAUNCH</button></div>
```

**`.md`**: master-detail. Side by side (list left, detail right, detail sticky) when the console is 900px or wider; below that the detail comes first, stacked above the list.
```html
<div class="md"><div class="md-list">...rows...</div><div class="md-detail">...detail card...</div></div>
```

**`.empty`**: a one-line dim empty state with a hint of what unlocks it.
```html
<p class="empty">No contracts on the board. Clients call every few minutes.</p>
```

**Buttons**: `.btn.gold` or `.btn.primary` (one per region), plain `.btn` (secondary, blue), `.btn.ghost` or `.quiet` (tertiary), `.btn.bad` or `.danger` (destructive, needs a confirm; see `act('scrap')` for the click-again pattern). Disabled buttons set `tip: 'txt:why'` through the binder.

**Shell hooks you can rely on**
- Rail items: `button.tab[data-act=tab][data-arg=id]` inside `#tabs`; the badge rules live in `navBadges()` in `ui.js`. Add a console by adding it to `TABS` (rail order, group) and `updateReveal()`.
- Keys: `1`-`0` consoles (rail order), `[` `]` viewport, `A` Activity, `Esc` closes modal or drawer. Don't bind these in a console.
- Toasts: `AT.ui.toast(icon, title, text)`, top-right, max 2.
- Modals: `modal(html, 'wide')`. Settings is a modal (`data-act="settings"`), no longer part of Archive.
- Flight Deck / Ops summary are rendered into `#deck` by `renderDeck()`; Activity entries come from `S.log` (kinds: info, up, down, warn, story, prestige, ach).
- Briefing card: fixed bottom-right (it sits over the Flight Deck area, clear of the toasts and the viewport decision cards). The Activity drawer slides over the monitor column.
