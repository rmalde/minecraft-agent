# Portable, local-only setup

This is a Minecraft **Java 1.16.5** research harness, not an arbitrary-world agent.
The default route needs its documented seed and Peaceful difficulty. Use a fresh
world; never open a newer Minecraft save with this old server.

The bot/server can run headlessly. The optional native renderer supports macOS
Apple Silicon and Intel library selection; other native-renderer platforms are
not implemented. The scripts need Python 3.9+, Node 22+, a JDK 17+ (including
`javac` and `jar`), and `ffmpeg` for recording. Java 21 was used for the local build
and pre-EULA server smoke check; full gameplay and Intel rendering still need
live validation.

## 1. Install deliberately

```sh
npm ci --ignore-scripts
npm run prepare:local
npm run configure
npm test
npm run test:setup
```

`npm ci` uses exact versions and integrity from the committed lockfile. Install
hooks are not implicit: `prepare:local` applies the reviewed pathfinder/viewer
patches and makes the legacy browser viewer listen on loopback. Do not start it
without that step. The patcher fails when the expected dependency source changes.

Native `canvas` is only needed for browser-viewer/video-overlay tools. Its build
hook was skipped above; if you need those tools, review its installation script
and run `npm rebuild canvas`. This may download/build native code and need local
compiler/system libraries. Headless bot tests and Java framebuffer recording do
not need canvas.

The `uuid` override pins 11.1.1 to address GHSA-w5hq-g745-h8pq in the
authentication dependency tree; it retains CommonJS and the existing v4 calls.

The npm dependencies and downloaded code still run with your OS user privileges.
A private virtual machine with no personal folders or credentials mounted is a
sensible first-run environment. This project is not a sandbox.

## 2. Choose runtimes

`MC_JAVA_HOME`, then `JAVA_HOME`, then `PATH` selects Java tools. Point either home
variable at a JDK directory containing `bin/java`, `bin/javac`, and `bin/jar`.
Paths with spaces are supported. `FFMPEG` optionally selects the native recorder's
ffmpeg executable; otherwise it is resolved from `PATH`.

```sh
export JAVA_HOME="/path/to/your/jdk"
# Optional, when ffmpeg is not on PATH:
export FFMPEG="/path/to/ffmpeg"
```

No Java runtime is downloaded automatically. The installer does not read or
modify your normal Minecraft settings, saves, authentication files or asset cache.

## 3. Prepare an isolated server

```sh
python3 scripts/setup-server.py
./build-observer.sh
```

Setup verifies the official 1.16.5 server download against the checked-in version
manifest, installs pinned logging libraries, and creates conservative defaults
only when files do not already exist. It preserves existing worlds/configuration.
Read the [Minecraft EULA](https://aka.ms/MinecraftEULA), then explicitly change
`server/eula.txt` to `eula=true` if you agree. Setup does not accept it for you.

```sh
./start-server.sh
```

The launcher requires `server-ip=127.0.0.1` and disables RCON/query. Offline mode
is for the local bot only: do not expose this server, proxy it, or forward its
port. It uses port 25576 and the documented seed. The observer uses port 3093.
For another run, stop the server and choose a new `level-name`; a new `RUN_ID`
does not reset a world.

Both renderer and server load pinned Log4j 2.26.1 instead of the original 2.8.1.
The server puts the replacement jars before the vanilla jar on its classpath.
Do not bypass this with `java -jar server.jar`. Legacy Mojang logging plugin
warnings can appear; the pre-EULA bootstrap was tested, not a full survival run.
`scripts/artifacts.json` records SHA-256 digests for all Maven overrides, including
LWJGL/JNA native libraries and Javassist. Existing cached downloads are verified,
and replacements are downloaded atomically. Mojang artifacts use their manifest
SHA-1 digests. Updates require reviewing and changing the pinned manifest/digests.

## 4. Configure model access

Choose **one** explicit credential source, in precedence order:

- `MC_OPENROUTER_KEY_FILE`: a private, one-line key file (permissions `0600`).
- `MC_OPENROUTER_API_KEY`: a project-specific environment variable.
- `MC_GOOGLE_PROJECT` and optional `MC_GOOGLE_SECRET` (default
  `OPENROUTER_API_KEY`): uses your normal `gcloud secrets versions access`
  identity, with least-privilege access to that secret. ADC is no longer a
  separate relay credential path.

The generic `OPENROUTER_API_KEY` remains ignored. No author's project is queried.
Do not commit credentials. Configure a dedicated provider-side monetary cap;
process request limits are **not** dollar limits. Model IDs/endpoints require
provider access and credit; setup/doctor/tests do not establish availability or
make paid calls.

Direct mode:

```sh
export MC_OPENROUTER_KEY_FILE="/private/path/minecraft-openrouter-key"
export MC_MAX_MODEL_CALLS=250
```

Optional relay mode: `npm run configure` creates a random `0600` token in
`.local/token`, without printing it. `MC_LOCAL_TOKEN_FILE` can choose a different
private token file (at least 32 characters). Start the relay in a credentialed
terminal:

```sh
node model-relay.mjs
```

In the agent terminal, use the same local token file and set:

```sh
export MODEL_RELAY=http://127.0.0.1:3099
```

The relay needs the provider credential; the agent does not. An attacker running
as the same OS user may still read the token. For stronger separation put the
relay in a separate account/container and use controlled IPC/network access.
`MODEL_RELAY` accepts only an HTTP `127.0.0.1` root URL and does not follow redirects.
The server rejects browser origins, wrong Host/token, non-JSON/non-POST requests,
and models other than the configured planner and JEV. Defaults: 2 MB request,
2 concurrent calls, 250 calls/process, 2,500 planner output tokens. Configure
`MC_RELAY_CONCURRENCY` (1–8), `MC_MAX_MODEL_CALLS`, `MC_MAX_OUTPUT_TOKENS` (up to
16,384), `MODEL_RELAY_PORT`, and `PLANNER_MODEL` consistently in both processes.
Requests are never automatically retried or hedged; a lost response may already
have cost money. Restarting a process resets its call count.

Inspector-based credential rescue/transport patches have been retired. The old
relay entry point now starts the same authenticated server and requires current
credential access. It no longer injects code into a process on port 9229.

## 5. Run with or without recording

From the repository root, with the server running:

```sh
npm run doctor
RUN_ID=my-first-run DRAGON_SENSOR_URL=http://127.0.0.1:3093 node nether-agent.mjs
```

Doctor makes no API calls. It reports optional ffmpeg as missing when absent;
that does not prevent a headless run. Interrupt with Ctrl-C, or create
`runs/my-first-run/stop` to stop at an action boundary. Watch spending and logs.

For native recording on macOS, additionally run:

```sh
python3 native-client/install.py
./native-client/build.sh
node optimization/nether/freeze-run.mjs my-recorded-run
RUN_ID=my-recorded-run NATIVE_VIEW=1 WAIT_NATIVE=1 NATIVE_RECORD=1 \
  DRAGON_SENSOR_URL=http://127.0.0.1:3093 node nether-agent.mjs
```

In another terminal, when the mirror is listening on 25578:

```sh
python3 native-client/launch.py
```

Wait for the video's `.finished.json` before closing the native client.
`--libraries-only` on the installer is for compilation checks, not rendering.
Video overlay fonts can be selected with `MC_VIDEO_FONT`; otherwise the macOS
font is used when available, with the platform canvas fallback elsewhere.

The older `agent.mjs` browser recording mode is optional. Set `RECORD=1` and open
`http://127.0.0.1:3077/?run=RUN_ID#token=LOCAL_TOKEN_VALUE` (substitute your run and
the private local token; never share the URL). The fragment is removed from
browser history after loading and is not sent to the viewer HTTP server. For a
custom status port add `&statusPort=PORT`; set `VIEWER_PORT`/`STATUS_PORT` on the
agent. Uploads require the token and expected origin, one active capture,
8 MiB/chunk and 512 MiB/run maximum; failed uploads do not mark completion.

## Validation scope

`npm test` runs only `*.test.mjs` unit tests. Historical `setup-*-test.mjs` scripts
operate on live worlds and are deliberately excluded. `npm run test:setup` checks
authentication, request/recording limits, private files and verified downloads.
CI runs unit tests and builds both Java agents. It does not supply paid credentials,
accept the EULA, prove model availability, or validate a complete gameplay run.
