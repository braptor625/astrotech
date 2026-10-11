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
