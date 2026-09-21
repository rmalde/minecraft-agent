# Astra and JEV Minecraft agent

This project uses GPT-6 Astra or GPT-5.6 Sol to plan and JEV to select player actions in Minecraft Java 1.16.5. It uses the official vanilla server and Mineflayer. A read-only Java sensor can report the exact dragon head position. It does not change game rules or entity state. Each selected action is sent to the game through the normal player protocol.

## Latest verified result

The latest run, `nether-final-08`, completed in **8 minutes 43.300 seconds**. The previous video took 14 minutes 31.800 seconds. The new run was 40% shorter. The End combat stage took 152 seconds instead of 332 seconds. Dragon flight and landing times can vary between runs.

The agent started with an empty inventory in a fresh Survival/Peaceful world. Astra planned and JEV selected the actions. It used the Nether for travel, killed the dragon with six bed explosions on the first landing, and reached the exit with full health and no deaths. There was no restart, source change, or operator repair during the run.

The run used 131 JEV decisions and 35 Astra calls. All 17 run checks, eight route/camera/screen checks, and 29 local tests passed. The full earlier video and action log were reviewed before the local tests and new recording.

Camera control uses continuous turns, with a limit of 240 degrees per second on each axis and acceleration of 960 degrees per second squared. A hidden native Minecraft client renders the game without desktop input. The capture includes health, hunger, hotbar, held items, inventory, crafting, and native animations.

The video is 960 × 540 at 20 frames per second, without audio. A translucent full-width top banner uses Menlo and shows the model names, elapsed time in milliseconds, XYZ coordinates, planner objective, and selected action. These labels use recorded responses and game events.

**Recordings and generated evidence remain local and are excluded from Git.** The local video is `runs/nether-final-08/full-playthrough-banner.mp4`. Its verification, timing comparison, and action log are in the same run directory. This repository contains the code, tests, build scripts, and route data. It does not include Minecraft binaries, downloaded runtimes, saved worlds, or credentials.

## Setup and credentials

Start with [SETUP.md](SETUP.md) for the portable, local-only installation, runtime
selection, verified downloads, explicit model credentials, and optional recording.
Run `npm ci --ignore-scripts`, then `npm run prepare:local` and `npm run configure`.
The project requires Node 22+, Python 3.9+, and a JDK 17+. Native rendering is
macOS-only; headless play does not need the native renderer.

Credentials are explicitly configured with `MC_OPENROUTER_KEY_FILE`,
`MC_OPENROUTER_API_KEY`, or `MC_GOOGLE_PROJECT`/`MC_GOOGLE_SECRET`.
No original deployment project or personal runtime path is used. The optional
local relay requires authentication and applies request limits. Use a dedicated
provider-side monetary cap as well. See SETUP.md before starting any paid run.

## Game settings

- Seed: `8398967436125155523`
- Mode: Survival
- Difficulty: Peaceful for this recording
- Verified active End portal center: `-1130, 34, 856`
- Main server: `127.0.0.1:25576`
- Native display: hidden read-only Minecraft client
- Status: `http://127.0.0.1:3078`

The selected seed has a village, three supply chests with 21 obsidian, and a naturally active End portal. The route uses the Nether as a travel shortcut and requires entry and exit before combat. It does not need blaze rods. This is a useful speedrun seed, not proof of the easiest possible seed. The route was surveyed in a separate test world. Final-run placements and movement use normal player interactions.

## Model roles

The planner sets the current objective, item targets, and a travel waypoint. JEV selects one available action from current game observations. Actions include travel, mining one block, collecting a drop, crafting, opening a chest, eating, sleeping, and combat interactions. Mineflayer handles the movement path and game protocol. This is structured-state control, not control from screenshots or individual key presses. The models can see blocks in loaded chunks. Known seed coordinates are supplied.

Model IDs:

- `openai/gpt-6-astra` (default) or `openai/gpt-5.6-sol` (`PLANNER_MODEL`), through `/api/v1/chat/completions`
- `typesafe/jev-1.13`, through `/api/alpha/decisions`

The explicitly configured key is loaded into process memory. The general `OPENROUTER_API_KEY` environment variable is ignored to prevent use of an unrelated key. The key is not written to run logs.

## Files and evidence

`runs/<run>/events.jsonl` stores the requests, model responses, selected actions, game results, and completion events. `status.json` stores current progress. A `victory.json` file requires dragon-death evidence and the exit-portal event. Death evidence is either the kill advancement or server-supplied zero health with the dragon dying phase. The Java 1.16.5 exit event uses numeric reason 4. Final review must also check the world DragonFight state and the video. Bed kills can omit the kill advancement.

New recordings use the official Minecraft Java 1.16.5 client. A read-only local protocol mirror sends the game state to this client. The video includes native entity models, textures, movement, digging and hand animations, the hotbar, held item, health, hunger, air, and dragon health. Capture is 960 × 540 at 20 frames per second, without audio. The window is hidden; focus and cursor control are disabled. Capture reads the game frame buffer, not the desktop. The older `recorded-06` video used Prismarine Viewer and a custom HUD.

The `combat-lab` directory is a separate test server. It can use prepared items and positions to test combat code. A combat-lab result does not qualify as a full Survival run.

## Start a run

Complete [SETUP.md](SETUP.md) first, including verified server setup and explicit EULA acceptance. Use `./start-server.sh` so the patched logging classpath is applied; do not launch the old server JAR directly.

Use `./start-server.sh` to start the main server with its read-only sensor. For a fresh recording, first choose an unused world name in `server/server.properties`. Use a new log directory with the same name. Start the agent from this directory:

```sh
node optimization/nether/freeze-run.mjs NEW_RUN
PLANNER_MODEL=openai/gpt-6-astra RUN_ID=NEW_RUN \
NATIVE_VIEW=1 WAIT_NATIVE=1 NATIVE_RECORD=1 \
DRAGON_SENSOR_URL=http://127.0.0.1:3093 node nether-agent.mjs
```

When the local mirror is listening on port 25578, start `python3 native-client/launch.py`. The agent waits for the hidden client and recorder before the first action. The native client uses an isolated game directory. It does not change the user's Minecraft settings. The recorder stops after the exit portal event. To stop a test at an action boundary, create `runs/NEW_RUN/stop`. Wait for `full-playthrough.mp4.finished.json` before closing the native client.

The native client dependencies are installed with `python3 native-client/install.py`; build the display and capture adapter with `./native-client/build.sh`. Java tools are selected through `MC_JAVA_HOME`, `JAVA_HOME`, or `PATH`. Model access requires available OpenRouter credit.

A new log directory alone does not reset the world. Stop the server, choose a new unused `level-name`, and start it again with the same seed. Keep the old world as evidence.

Run `npm test` and `npm run test:setup` to check completion events, native packets, action policy, and pathfinder cancellation. Live server tests remain necessary for movement, crafting, combat, and recording.

## Sources

- [Official TypeSafe introduction and Doom demo](https://typesafe.ai/blog/introducing-system-one-models-and-jev): structured game state, typed decisions, and a real-time action loop.
- [JEV Minecraft demo](https://www.reddit.com/r/accelerate/comments/1whk9oy/new_typesafe_ai_jev_model_playing_minecraft_wip/): the author describes JEV choices through Mineflayer.
- [Minecraft demo source](https://github.com/ellistev/typesafe-minecraft-demo): both bounded direct actions and earlier batch actions are documented.
- [Mario example](https://github.com/fhshaik/typesafe-mario): structured observations and a small legal action set.
- [StarCraft example](https://github.com/phyous/tsai-sc): bounded actions, recorded model probabilities, and explicit victory checks.
- [StarCraft Twitter post](https://x.com/literallydenis/status/2100622868878868603): found through the public JEV project index; direct retrieval was blocked by Twitter.
- [TypeSafe launch Twitter post](https://x.com/CompleteSkeptic/status/2099925682726002904): direct retrieval was blocked.
- [New seed human speedrun](https://www.speedrun.com/mc/runs/yoex3d0z).
- [Previous seed report](https://www.reddit.com/r/minecraftseeds/comments/m6vjbd/): Java 1.16 seed and portal coordinates.
- [One-cycle guide](https://mcsr.info/speedrunning/one-cycle): bed support, cover, and timing.
- [Mineflayer](https://github.com/PrismarineJS/mineflayer), [Pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder), and [Prismarine Viewer](https://github.com/PrismarineJS/prismarine-viewer).
- [Official Astra model documentation](https://developers.openai.com/api/docs/models/gpt-6-astra).

## Combat implementation

`end-combat.mjs` offers one bounded bed attack. JEV chooses the action. The action places one bed, aims at it, and waits for the observed head to enter the attack window before one use command. It aborts if the player loses cover or breath enters cover. The local test improved from 11 to 46 damage per bed after aiming first and tightening the window. A later prepared test used seven beds to kill the dragon and ended with 13 health, without damage protection. Its evidence is `combat-lab/eight-bed-test-03.jsonl`. This test used a local test driver, prepared items, and a prepared dragon approach. The first full sequence with Sol and JEV succeeded in `practice-02`.

`observer/DragonObserver.java` adds a read-only observation call to the server dragon tick. Its HTTP endpoint is local only. Build it with `./build-observer.sh`. No part of this sensor grants items, moves the player, changes health, or changes the dragon AI.

`combat-probe.mjs` is a local test driver hardcoded to port 25577. It does not call either model and must never be presented as a model-controlled run. The `combat-lab` files include prepared positions, items, and other test changes.

The bed timing research also used [AltoClef's bed-combat source](https://github.com/gaucho-matrero/altoclef/blob/main/src/main/java/adris/altoclef/tasks/speedrun/KillEnderDragonWithBedsTask.java). The action implementation in this project is separate.

## Recording and control limits

The final route is fixed in `optimization/nether/config.json`. Astra receives game state and route observations; JEV selects bounded actions. Mineflayer performs pathfinding and timed block interactions. This is not screenshot-only or individual-key control. The native view mirrors the bot state. Its camera uses small turns, and its inventory screens show the current item and cursor state. The final run used no live operator guidance or repairs.

A recording can contain several capture files if the agent needs a code update. Preserve all active gameplay. Mark each update pause in the combined video. Report deaths and pauses; do not describe such a recording as a deathless or uninterrupted run.

The new native video is one continuous capture. Add the information strip with `node overlay.mjs nether-final-02`. Check it with `node verify-run.mjs nether-final-02 nether-final-02 full-playthrough-overlay.mp4`. To rebuild the older viewer video, run `node assemble-video.mjs recorded-06`; check it with `node verify-run.mjs recorded-06`. The raw capture files, action log, video manifest, and world are preserved. The older viewer manifest records its development pauses; those do not apply to the new continuous recording. The overlay marks the exit event as complete. The current code prevents another game action after victory.

A test in the separate lab showed that a long fall into an End portal can carry fall damage into the End. That proposed action was rejected. The recorded player used short, checked downward mining steps instead.
