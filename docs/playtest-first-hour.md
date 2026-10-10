# First-hour playtest (new-player bot)

Tool: `python3 tools/playtest.py <outdir> [max_game_minutes=60] [max_directives=40]`.
The bot clicks only visible `[data-act=...]` elements, follows the Board Directive strip, picks the top row of
Mission Control the way a newcomer would, and uses `AT.E.simulate(15)` only to fast-forward. It writes
`timeline.txt`, `issues.txt` and screenshots to the output dir. Each run takes about 10 minutes of wall time.
Game state is randomised per run (starter targets differ), so figures below come from several runs. Screenshot
names refer to runs kept in `/tmp/claude-0/pt_before` and `/tmp/claude-0/pt_after` (not committed).

## Ranked friction points

1. **The first target a new player sees can be a 26-40% risk M-type.** Mission Control sorts by $/min, and the
   unsurveyed M-type wins that sort. Nothing is pre-selected and nothing says "pick the surveyed one". Evidence: the
   first launch at 00m03s was 37%, 26% and 32% risk across three runs (`02_issue_highrisk_*`). In the first run the
   starter ship was lost on its second launch (65% risk) and the bot sat at $2K with no ship at 06m52s
   (`10_issue_stuck_6.png`). Losing the only ship and pilot is a harsh opening.
2. **Directives name research or hulls whose prerequisites are hidden.** "Research Flight Director" is LOCKED until
   Orbital Mechanics, "Take the company public" needs Sales Daemon, and "Commission an Excavator" needs a 3-node
   chain. The bot stalled on each: 05m00s stuck at D9 (`12_issue_stuck_9.png`), 05m13s at D14
   (`32_issue_stuck_14.png`), 05m15s at D15 with $91K unspent (`36_issue_stuck_15.png`). A locked node is a grey
   box (`11_issue_locked_flight dir.png`) and does not say what to click first.
3. **Hull wear is invisible until it is lethal.** Failed or partial missions strip 25-60% hull, and risk is
   multiplied by `1 + 2*(1-hull)`. Ships were seen flying at "hull 0%" with 52-63% risk (`36_issue_stuck_15.png`)
   and one bot run lost 15 ships in an hour. No message or highlight pointed at Repair in Fleet.
4. **Directive 10 (client contract) fights directive 3 (Sell All).** Delivery contracts need ore in stock, and the
   player has just been taught to sell everything. The bot needed 22 minutes for this directive in one run
   (`24_issue_stuck_10.png`).
5. **Research is a long dry wait at directive 9.** One scientist makes about 0.25 RP/s, and Flight Director plus
   its prerequisite costs 144 RP, so about 10 minutes with only "keep flying" to do. Before: D9 took 09m48s
   (06m07s to 15m55s).
6. **One pad and one ship make "Complete 5 missions" a 3-5 minute wait** (D6 stuck 05m04s, `10_issue_stuck_6.png`).
   The second pad only comes with D7. Left as is (see below).
7. Minor layout: ticker lines truncate with an ellipsis ("Contact lost with ATS Sunk Cos...",
   "EXPEDITION AVAILABLE: Derelict...", `08_issue_noship_60s.png`), and the pilot line in the mission card's ship
   row clips on narrow rows (`29_issue_hull_locked_excavator.png`). Full text is in the Mission Log. Left alone.
8. Mission Control keeps ranking by $/min as ships wear, so with 1-2 ships the top row is often a 50-85% risk
   target (the bot counted the top row at >=35% risk on 100-174 picks per run). Left alone; it needs a design
   decision on the default sort, not a local fix.

## Fixes made

| # | Change | Where |
|---|--------|-------|
| 1 | New game opens with the surveyed starter target pre-selected, so the card shows a LAUNCH button at about 10% risk. Directive 2 now reads "Launch a mission at the surveyed target. Unsurveyed rocks carry extra risk." | `src/engine.js` `startingAssets`, `src/data.js` |
| 2 | Directives 9, 14 and 15 name the prerequisite: "(after Orbital Mechanics)", "Go public: research Incorporation (after Sales Daemon)", "Commission an Excavator (research Heavy Hulls first)". | `src/data.js` |
| 3 | A ship that returns under 60% hull logs a warning pointing at the Fleet console, and the Fleet tab pulses while an idle ship is under 60% hull (until Field Repair Kits unlocks auto-repair). | `src/engine.js`, `src/ui.js` `renderTabs` |
| 4 | Directive 10: "Deliver a client contract in Market. Hold back the ore it asks for." | `src/data.js` |
| 5 | Directive 8 (hire a scientist) now pays an RP grant (`rp: 240`, at least 120 RP), so Flight Director is reachable soon after. | `src/data.js` |

## Before / after

| Metric | Before | After |
|---|---|---|
| First launch risk (bot) | 34% (top row, M-type) | 10% (pre-selected surveyed S-type) |
| Directive 9 "Research Flight Director" | 09m48s (done at 15m55s) | about 1m46s (done at 07m28s) |
| Directive 14 "Go public" done at | 30m08s | 24m48s (D13) then 25m25s |
| Console errors | none | none |

The playtest's own run-to-run noise is large (ship losses ranged 4 to 15 per hour in both versions), so only the
first-launch risk and the directive 9 wait are claimed as improvements.

Sim bot (`node tools/sim.js 40`) is itself noisy run to run. Baseline code, 7 runs: first Kuiper Jump 40m, 47m,
1h02m, 1h05m, 1h11m, 2h08m, 2h27m; ENDING 1d 7h to 1d 14h. After the changes, 7 runs: first Kuiper Jump 49m,
1h01m, 1h04m, 1h06m, 1h13m, 1h20m, 1h26m; ENDING 1d 10h to 1d 14h. Engine rules were not changed, only a
start-of-run selection and one log line, so milestones stay inside the band within noise. `tools/shot.py` still
prints "no console errors".

## Deliberately left alone

- Default $/min sort, and the one-pad opening (changing either changes pacing or system design).
- Ticker truncation and narrow ship-row clipping (cosmetic, full text is in the log).
- Contract delivery vs Sell All (no engine change; the directive text now warns instead).
- Hull wear numbers and incident frequency.
