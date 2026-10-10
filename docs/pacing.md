# Late-game pacing analysis

Method: `tools/sim.js` (the perfect-play bot) is stochastic (the seed argument is ignored), so every figure
below is an average over 8-10 full runs of 45-48 simulated hours. For the curve I sampled the run's peak equity
every 5 minutes and took its running maximum inside each region (the "envelope"). A **flat stretch** is any
window where the envelope gains less than 1 order of magnitude (OOM) per hour.
The harness was a throwaway copy of `sim.js` that printed a CSV line every 5 minutes and an hourly
`mults:`/upgrade dump. It is not committed.

## Before (8 runs)

| Milestone | Mean | Range |
|---|---|---|
| First Kuiper Jump | 1.1h | 0.7-1.4 |
| Oort Exodus | 8.7h | 7.2-10.5 |
| Stellar Ignition | 21.3h | 17.3-23.8 |
| Galactic Ascent | 26.9h | 22.9-29.0 |
| Ending | 34.9h | 32.0-38.0 |

Flat hours per era (mean / worst run): Kuiper 5.8 / 8.3, Oort 7.5 / 9.1, Stars 0.5 / 1.6, Void 2.4 / 3.3.
Longest single flat stretch: mean 4.9h, worst 6.5h.

### Where it creeps and why

* **Kuiper era, hours ~4-10, equity 1e18-1e20.** About 0.9 OOM/h. Every Cryo Core upgrade except Veteran Crews
  (`k_crews`, x2 per level for 4x cost) is capped by ~5h (seed, pads, charter, memory, resonance, orders) or
  nearly so (labs, doctrine, safety). All spending funnels into one ladder (x2 for 4x), so one OOM costs about
  20 Kuiper Jumps (~4-5h). The Oort requirement (3e20) sits just above the ~1e20 plateau, so the bot waits.
* **Oort era, hours ~15-22, equity 1e33-1e37.** The stall sits at the Stellar requirement (1e37). Comet Shard
  gain is `(eq/3e20)^0.22`, which grows slowly, and the bot waits for the gain to double before each Exodus (gaps
  of 1.5-2h between Exodus #10 and #12). `o_momentum` sits at level 5-7, one level per ~2h. The "gain x2"
  milestone is at 25 Exodus, around hour 30, so it never matters when it is needed.
* **Void era, first 1-3h, equity ~1e69-1e72.** Dark Matter gain is `(eq/1e68)^0.11`, so the first Ascents give
  1, 1, 2, 7 DM. Dark Leverage costs 1/3.5/12/43, so the bot is stuck on 1-2 upgrades for hours. Once the DM gain
  reaches ~10 the era runs at ~3 OOM/h. The "gain x2" milestone is at Ascent 10, after the problem is over.
  The last OOM before 1e94 is also slow (about 1.5h from 1e92).
* **Stars era** is not a problem (~6 OOM/h). Stellar Furnace is x8 per level for 4x cost, so it more than pays
  for itself, which makes it the one place the game ran faster than it needed to.

## Changes (all in `src/data.js`, no engine change)

1. Kuiper milestone **n:12, everything x1.3** ("Cold Chain"). It arrives about 5h into the Kuiper era, where
   `k_crews` is the only sink. Kept small: a x2 here shortens the game by ~4h and pulls Oort to ~7.5h.
2. Oort milestone **n:9, Comet Shard gains x1.6** ("Shard Exchange"). It lands inside the 15-21h creep, when the
   shard ladder is the bottleneck. It reuses the existing `gain1` effect and stacks with the x2 at n:25.
3. Galactic milestone **n:1, Dark Matter gains x3** ("Dark Ledger"). It fixes the "1, 1, 2 DM" start of the Void
   era and applies from the second Ascent.
4. `s_furnace` (Stellar Furnace) **x8 to x5 per level.** This is the compensation. Changes 1-3 are pure speed-ups
   (changes 2 and 3 alone took ~4h off the ending). The Stars era is the only era running far above 1 OOM/h, so it
   absorbs the slow-down. With x4 per level the Void era got worse again (3.0 flat hours), so x5 is the floor.

Rejected: raising any requirement (the designer's warning; a test with Oort 3e20 to 6e20 did not shorten the
Kuiper flat stretch anyway), large `all` milestones (each x2 cuts 3-9h from the ending), and new Cryo Core
upgrades (they would only be another ladder competing with `k_crews`).

## After (10 runs)

| Milestone | Before | After (mean, range) | Documented |
|---|---|---|---|
| First Kuiper Jump | 1.1h | 1.3h (1.0-2.2) | ~1h (code path untouched, so this is run-to-run noise) |
| Oort Exodus | 8.7h | 8.5h (7.5-9.8) | 8-10h |
| Stellar Ignition | 21.3h | 18.2h (17.0-19.6) | 18-24h |
| Galactic Ascent | 26.9h | 24.2h (23.6-26.0) | 24-29h |
| Ending | 34.9h | 31.0h (28.0-33.0) | 32-39h |

| Flat hours (<1 OOM/h) | Before mean (worst) | After mean (worst) |
|---|---|---|
| Kuiper | 5.8 (8.3) | 4.8 (6.0) |
| Oort | 7.5 (9.1) | 4.2 (6.2) |
| Stars | 0.5 (1.6) | 0.1 (1.1) |
| Void | 2.4 (3.3) | 2.2 (3.2) |
| Longest single stretch | 4.9 (6.5) | 3.7 (4.9) |

## Caveats

* The bot's game is about 4h faster (ending mean 31h, one run at 28h). The brief was "not a faster game". The game is
  very elastic: every x2 of `all` is worth hours. More compensation is possible by trimming `s_furnace` or the new
  milestones, but the Void era gets worse if `s_furnace` goes below x5.
* The Kuiper era still shows ~4.8 flat hours. It averages ~0.9 OOM/h instead of stalling hard, so it keeps tripping
  the "<1 OOM/h" test. This follows from the single `k_crews` ladder. A bigger fix needs a growth source that does
  not also pull Oort forward, which probably means engine work (for example a per-run bonus that scales with Jump count).
* The Void improvement is small because the `s_furnace` change gives back most of the DM-gain fix. With
  Stellar Furnace at x8 the same Void change cut flat hours from 2.4 to 1.6.
* Sample noise is large (ending +-2h between runs), so differences under ~1h are not significant at 8-10 runs.
