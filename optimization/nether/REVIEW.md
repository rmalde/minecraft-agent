# Nether route, camera turns, and inventory display

## Route

The new seed is `8398967436125155523`, Java 1.16.5. A [verified human run](https://www.speedrun.com/mc/runs/yoex3d0z) uses this seed, two Nether portal crossings, and a 2m54.545s completion time. This is evidence for a useful set-seed route, not a speed claim for this agent.

The local survey confirmed three supply chests with a total of 21 obsidian, an iron pickaxe, iron, and flint. It also confirmed eight nearby village beds and an active End portal at (-1130,34,856). The agent uses the Nether as a travel shortcut. It does not collect blaze rods or fill the End frame. The full run uses Survival/Peaceful, as in the previous video.

The entry frame is shifted one block along Z. Three essential obsidian blocks already exist, and seven must be placed. This avoids mining crying obsidian. The exit uses ten obsidian blocks and four ordinary corner supports. At least one obsidian remains for the dragon-fight support. All final-run placements use normal player interactions.

Survey files are local observations from a separate server. Prepared test commands never run in a final recording world. The Nether and stronghold path was then traversed by Astra and JEV in `nether-practice-01`.

## Camera

All requested look turns pass through a controller that uses 9-degree combined yaw/pitch steps at 50 ms intervals. This is below the requested 45-degree limit. The turn follows the shortest yaw direction. Forced look requests cannot skip these steps. Walking waits until the player faces within 20 degrees of the path. The native display also limits camera updates, including server position corrections.

The test covers yaw wrap, a half turn, and combined yaw/pitch limits. The prepared native screen test measured a maximum turn of about 9 degrees. Final-run proof must check both control and display turn events.

## Inventory and crafting

The missing personal crafting screen had no corresponding server screen-open packet. The hidden native client now opens its actual Minecraft inventory screen for personal crafting. It does not use desktop input. Chest screens already had packets, but closed as soon as transfers finished.

The first display test used long pauses. The user then asked to restore fast operation. The current version uses normal recipe click speed, a 100 ms result pause, a 100 ms final crafting pause, a 400 ms inventory review, and 100 ms pauses at chest open and close. These brief pauses allow capture frames without the earlier reading delay. The mirror sends the current item and cursor states because many accepted item moves are applied locally by Mineflayer and are not repeated by the server.

`runs/nether-ui-scenario-04/full-playthrough.mp4` is the fast prepared display test. It has 111 frames at 20 fps (5.55 seconds), compared with 16.45 seconds for the previous test. Inspected frames in `ui-test-04-qa.png` show ingredients, the completed flint-and-steel recipe, final inventory, and a chest. Crafting took 1.187 seconds including native screen acknowledgement. This is not a full Survival run.

The practice run also exposed a carried-item correction that Mineflayer ignored: Java 1.16 sends cursor updates with window ID -1 and slot -1. A cursor synchronizer now handles that packet. After a failed transfer, the agent waits for correction and returns any carried item to inventory. Tool recovery remains available if a pickaxe is actually missing.

## Practice failures and fixes

`nether-practice-01` included code-restart pauses and one death. It is not the final recording.

- Long village approaches timed out. The agent now uses shorter approach segments.
- A carried pickaxe was absent from the inventory list during a failed transfer. Server checks and the cursor fix distinguish that state from a broken tool.
- The pathfinder stopped above the End portal. A short observed entry action now centers the complete player collision box over the opening and removes a blocking floor only if the portal is the first landing below it.
- The new route harness initially offered idle observation alongside useful combat work. The useful-action filter from the previous successful harness is now applied.
- The player died while returning through an older breath cloud. The old check tested the destination only. Paths now exclude cloud areas, and a tick check stops path movement before a new cloud is reached. Escape starts with a larger margin.

The separate combat tests use a fresh world of the same seed, a prepared spawn platform, supplied beds and tools, and a test-only starting position. The first fixture started before the platform chunk loaded and the server kicked the floating player. A second attempt stopped on missing distant chunks. The local-terrain check now permits play when the current terrain is loaded. These fixture failures do not count as agent wins.

The clean prepared combat test `nether-combat-scenario-05` defeated the dragon with six bed blasts and entered the exit portal. It had no death. It used supplied gear and a central-island starting position, so it proves the combat component only. Earlier fixture attempts 03 and 04 failed after a narrow-platform escape and a saved void fall.

Practice 02 exposed bed collection through house walls: a five-second pickup timeout expired before the player reached the item. The harness now approaches a bed closely before breaking it, allows 15 seconds for pickup, and prioritizes loose beds over other preparation before they expire. Practice 02 includes development restarts and one direct diagnostic walk to a dropped bed; it is not a final recorded run.

Practice 02 later died on a magma block at the entry build position. `ground-safety.mjs` now excludes magma from paths and holds sneak while the player touches magma. The prepared ten-second game test kept health at 20 even while actions cleared controls.

The first recorded candidate collected its kit, then repeated a long entry-path search. That candidate was stopped. Entry approaches now use short segments. Practice 03 resumes that candidate as a development run; it is not a fresh, uninterrupted result. It traversed the Nether and stronghold safely.

The combat transcript showed repeated breath attacks near the fountain and one perch facing away from the fixed east-facing bed. Inspection of the local Java 1.16.5 server classes `bbx` and `bbz`, using the official mappings in `research/server-mappings.txt`, confirmed that player distance affects strafe selection and player direction affects the landing approach. The new test waits east of the fountain, then returns when landing begins. The test passed: the eastern waiting point produced a usable landing window, six bed blasts killed the dragon, and the player entered the exit portal at full health. `runs/nether-practice-03/world-proof.json` confirms Survival/Peaceful, commands disabled, the saved dragon-killed flag, and the exit event. Practice 03 includes development restarts; it is not the final video.

## Final recording

`nether-final-02` passed. The final annotated video is 557.35 seconds (9m17.35s), 960 × 660 at 20 fps, without audio. The raw native game image is 960 × 540. Both files decode without errors.

- Fresh Survival/Peaceful world, empty starting inventory, no deaths, final health 20.
- 92.001 seconds in the Nether before the End fight.
- Six bed blasts; saved dragon-killed flag and exit event both confirmed.
- 122 JEV decisions and seven Astra calls. API totals were 23.7 seconds for JEV and 26.3 seconds for Astra.
- One continuous recording; fixed source hashes; no runtime repair or operator intervention.
- All 17 run checks and eight route/camera/screen checks passed.
- Maximum control turn 9.081 degrees over 6,917 samples; maximum display turn 9 degrees over 10,858 samples.
- Fast crafting screen event 0.412 seconds; full-kit inventory event 0.602 seconds. Native frames show ingredients, result, inventory, and chest screens.
- 43 automated checks passed. Prepared and development runs remain separate evidence.

The information strip reports actual model responses and game events. It does not show inferred thoughts. `final-video-qa.png` and `final-craft-qa.png` contain inspected frames. Evidence is in `runs/nether-final-02/verification.json`, `nether-camera-proof.json`, `world-proof.json`, and `efficiency.json`.
