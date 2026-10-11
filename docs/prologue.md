# Prologue: "Proof of Concept"

AstroTech isn't a mining company yet. It's three people, a leased hangar and a loan. The prologue is the founding story: build a rocket that can reach orbit **and come back**, prove it to the Board, and earn the mining license. The brand line "MINING CO. · EST. 2187" is what the prologue ends on.

Decisions from the owner:
- **Hybrid interaction.** About a minute of hand-building at the very start, then everything becomes timed jobs and automation.
- **Length.** 15–25 minutes for a first-time player.
- **Skippable after the first completion.**

## Why

- It gives the opening a story and a goal, instead of dropping the player straight into missions with a ship they just bought.
- It layers the game the way *Universal Paperclips* does. Each layer reveals the next system, the log escalates in the same dry tone, and the numbers start tiny and honest.
- It teaches the main game's core ideas (risk, reliability, wear, cost versus payoff, automation) in a smaller sandbox, so the coach-mark tutorial can shrink.
- It's a strong demo hook. The demo becomes prologue → inner system → first Kuiper Jump.

## Resources

| Resource | Use |
|---|---|
| Cash | The seed loan, $2,000. Comes from grants, contracts and investor rounds. Buys materials and pays staff. |
| Parts | Three types: **Airframe**, **Engine**, **Avionics**. A rocket needs 1 of each, and later tiers need more. |
| Data | Earned from tests and failures ("Failure is data"). Spent in R&D. Leftover Data becomes starting RP when mining begins. |
| Reliability | One value per subsystem (airframe, engine, avionics), from 0 to 100%. Raised by tests and R&D. Drives the odds of every test and launch. |

## Layers (each one reveals the next)

1. **Garage (hand-built).** A big pixel button: **MACHINE PART**. Each click adds progress to the current part. A part takes about 8 clicks, the first rocket needs 3 parts, and the whole step takes about a minute.
   - Log: "One lathe. One loan. One idea that the bank called 'ambitious'."
   - After the first part, **Hire a machinist** appears, and parts start fabricating automatically as **timed jobs**. Clicking still speeds up the current job, but it's never required.
2. **Test stand.**
   - **Static fire** is a timed job of about 15–20 s. It needs an engine and yields Data. It can destroy the engine, with odds based on engine reliability.
   - The viewport shows the engine firing on a test stand at the Launch Complex using the existing FX system, or exploding.
   - R&D opens and starts spending Data on reliability upgrades. Examples: *Better Welds* (airframe), *Turbopump* (engine), *Flight Computer* (avionics), *Test Engineer* (automates static fires), *Second Bay* (two jobs at once).
3. **Launch campaign.** Assemble a rocket from parts, then attempt the next tier:
   - **Hop:** 100 m and land.
   - **Suborbital:** reach the Kármán line.
   - **Orbit**
   - **Orbit and recover:** come back in one piece. Landing Legs from R&D are required.

   The success chance is the product of the subsystem reliabilities, times a tier difficulty. Each attempt plays out on the Launch Complex view.
   - **Success:** a milestone, funding and a log beat.
   - **Failure:** an explosion, the rocket is lost, lots of Data.

   Log: "The vehicle performed a rapid unscheduled disassembly. Data collected: substantial."
4. **Funding.** Contracts unlock with tiers. Examples: a university cubesat ride (needs Suborbital), a weather satellite (needs Orbit). There's also a one-off grant.
   - **Investor pitches** are story choice cards that reuse the incident card UI, with two options each in the dark-corporate tone. For example: *"Promise Mars" (more cash, Board pressure)* versus *"Promise ore" (less cash, sets up mining)*.
   - **The Board** appears here for the first time, and its first directive is the prologue's goal.
5. **Certification (transition).** After a successful Orbit and Recover, the Board grants the **MINING LICENSE**:
   - A short black-screen beat in the same style as the ending: "AstroTech Mining Co. Est. 2187."
   - Then the full shell unlocks.

## Carry-over into the main game

- The certified rocket becomes the player's **first Prospector**, named by the player or auto-named "ATS Proof of Concept". The prologue's test pilot becomes the **founding pilot**.
- Leftover Data converts to starting RP. The reliability reached gives the Prospector hull a small permanent bonus, so a careful prologue is rewarded.
- The original Directive 1 ("Buy your first ship") is replaced by "Launch your first mining mission".

## UI

- The prologue uses the redesigned shell (`docs/ui-redesign.md`), but the nav rail only shows the prologue consoles as they unlock: **Workshop** (parts and jobs), **Test Stand**, **R&D** and **Funding**. The mining consoles stay hidden.
- Top bar: Cash, Data, and a Board-order pill with the prologue goal.
- The monitor shows the **Launch Complex** with one pad that is still under construction. Scaffolding, the gantry and then the pad appear as the player progresses, and the rocket visibly assembles from its parts. The Flight Deck shows the active job or attempt.
- The coach-mark tutorial is reworked to teach the prologue's first steps: machine a part, hire a machinist, run a static fire. The mining-phase tutorial becomes 2 steps: launch your rocket at the surveyed target, then sell.
- Briefings are added for each prologue console. Achievements are added too, for example *Rapid Unscheduled Disassembly*, *Failure Is Data*, *Hop Skip*, *Orbit, Returned*. Add these to `steam/steamworks/achievements.md`.

## Skipping and saves

- The first completion sets `S.prologueDone` and a device flag (localStorage `astrotech.prologueDone`, plus the native bridge on Steam).
- New saves on a device with that flag offer **Skip prologue**. Skipping grants the same carry-over at baseline values.
- Prestige resets and NG+ never replay it.
- Old saves count as done.
- The demo includes the prologue.

## Engine and balance

- State lives in `S.pro`, with logic in the engine (DOM-free, runs in Node), for example `E.proTick`, `E.proJob` and `E.proAttempt`. The UI only renders and dispatches.
- Tunables go in `data.js` under `AT.PROLOGUE`: part costs and times, test odds, R&D nodes, tiers, contracts and story lines.
- `tools/sim.js` must play the prologue: the bot clicks for the first parts, then plays optimally. Targets:
  - The bot finishes the prologue in about 10–14 min. Humans should take 15–25.
  - The main-game milestones only shift by the prologue's length.
- A playtest bot pass (`tools/playtest.py`) must get through it like a new player.

## Implementation notes (engine layer)

- Data: `AT.PROLOGUE` in `src/data.js` (parts, staff, fire, rel, rd, tiers, contracts, grants, pitches, goals, carry, safety, story, lines). Logic: the "PROLOGUE" block of `src/engine.js` (`E.pro*`), state in `S.pro`, flag `S.prologueDone`, bonus `S.proBonus`.
- While `E.proActive()` the tick only runs `E.proTick`; the mining actions (`buyShip`, `launch`, `hire`, ...) return false.
- `E.newGame({ skipPrologue: true })` skips with the baseline carry-over. `E.proDevice(v)` is the device-level "already finished" flag (the UI persists it; the engine never touches storage). `E.proCanSkip()` is true on such a device.
- Hook events (all through `AT.hooks.event(kind, payload)`): `proClick`, `proJobStart`, `proJobDone`, `proStaticFire`, `proAttemptStart`, `proAttemptResult`, `proTier`, `proPitch`, `proUnlock`, `certified`, `proSkip`. Payloads are documented at the top of the block in `engine.js`.
- Tests: `node tools/prologue_test.js`. Balance bot: `node tools/sim.js <hours>` prints `[prologue]` milestones.

## Implementation notes (UI layer)

Files: `src/prologue_ui.js` (consoles, monitor, events, certification), `src/prologue_scene.js` (the Launch Complex site and the flights), plus small delegations in `ui.js`, `scene.js` and `guide.js`. CSS is the `/* === prologue === */` block of `style.css`. The prologue UI only renders and dispatches; every rule lives in the engine.

- **Shell.** While `E.proActive()` ui.js asks `AT.proUI` for the rail (`tabs()`, group "Prologue", ids `pro_workshop`, `pro_stand`, `pro_rd`, `pro_launch`, `pro_funding`), badges, the pulsing hint, the Board-order pill, the job list in `#deck`, the investor card in `#cardbox`. The map and close-up views are locked (the view buttons are hidden, `[` `]` do nothing). The top bar shows Cash (with payroll) and Data. The Launch console appears as soon as one of each part exists, because the first assembly (which fires the engine's `launch` unlock) happens in it.
- **Consoles.** Workshop: the MACHINE PART button (hold to repeat), part picker, machinist, stock targets, manual fab, bays. Test Stand: static fire with the kill chance, Test Engineer and its auto toggle, record. R&D: reliability bars with the breakdown, nodes grouped available/locked/completed. Launch: the pad status, the four-tier ladder with parts chips, odds, fee/reward, ASSEMBLE and LAUNCH. Funding: investor cards, contracts, grants, the Board's pressure. Every disabled button explains itself from the engine's `*Block` reason.
- **Actions** are `data-act="pro-*"` (`pro-click`, `pro-fab`, `pro-hire`, `pro-fire`, `pro-asm`, `pro-att`, `pro-rd`, `pro-contract`, `pro-grant`, `pro-pitch`, `pro-stock`, `pro-auto`, `pro-fireauto`, `pro-skip`, `pro-begin`). `data-coach="click|hire|fire|launch"` marks the coach targets.
- **Scene.** `scene.js` drawLaunch hands over to `SC.proDraw` while the prologue runs. Everything is drawn from `S.pro`: lot and fence, hangar (lit while work runs), bench, parts on the shelf, scaffolding (first part), test stand (engine built), gantry (first assembly), finished pad (Hop cleared), tracking dish (Orbit cleared). The vehicle builds bottom-up during the assemble job. Static fires run on the stand with the FX plume/exhaust; a lost engine explodes (`proStaticFire` boom). Flights are drawn from `P.attempt` (Hop hovers and lands, Suborbital arcs off the top, Orbit climbs off the top, Recover comes back and lands on legs); failures explode where the flight was (`proAttemptResult`). A telemetry box shows time, altitude and phase.
- **Coach.** `AT.PRO_COACH` (data.js): machine a part, hire a machinist, run a static fire, open Launch and assemble. It is stateless (`guide.js proCoach()`), so a loaded save resumes in the right place; SKIP TUTORIAL sets `S.pro.coachOff`. The mining tutorial is now 5 steps: welcome, launch (pre-selected target), flight, sell, done; there is no fleet step. Prologue briefings (`when: ['pro', name]`, `['proStaff', 'machinist']`, `['proCert']`) are dropped when the prologue ends; the license briefing follows the tutorial.
- **Saves and the device flag.** `localStorage astrotech.prologueDone` (demo: `astrotech.demo.prologueDone`) and, on Steam, `astrotechNative.flag('prologueDone')` (flags.json beside the save). It is written when a game certifies, skips, or loads as already finished. Boot calls `E.proDevice(flag)` before `E.newGame()`.
  - **Skip prologue**: offered (a) as a modal on a brand-new game when the flag is set, (b) in the Wipe Save modal (WIPE AND SKIP PROLOGUE passes `{skipPrologue: true}`), (c) as a confirm-click button in the Workshop header while `E.proCanSkip()`. A first-time player never sees it.
  - **New game (with prologue)** (Settings, Save data): confirm, then `E.newGame()`: wipes everything, always plays the prologue, never asks about skipping.
  - **Replay prologue** (Settings): confirm, then a new game that keeps settings, achievements, artifacts, memorial and seen briefings; always plays the prologue.
- **Certification.** On `certified`, `#ending.cert` (black screen, same style as the ending): the license line, "AstroTech Mining Co. Est. 2187.", the summary, a name field (`E.proRename`) and BEGIN OPERATIONS. The engine has already switched to mining behind it.
- **Test tools.** `tools/pro_play.py` plays the real prologue through the DOM; `tools/shot_prologue.py` screenshots every stage and asserts the flows; `tools/playtest.py` runs it first and reports the prologue's game time. `tools/skipsave.js [tutorial]` prints a skipped-prologue save for the other shot tools (`astrotech.save.v2`, demo `astrotech.demo.save.v2`).
