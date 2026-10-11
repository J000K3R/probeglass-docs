---
title: Architecture
sidebar_label: Architecture
description: How the pieces fit together and why they were cut this way — for someone about to change the code.
---

# Architecture

Weatherglass is one process: an HTTP server, a scheduler, and a SQLite file. This
page explains how the pieces fit together and why they were cut this way. It is
written for someone about to change the code, not for an end user.

## Shape of the process

```
cmd/weatherglass        flags, wiring, graceful shutdown
  ├── internal/config   defaults → YAML → environment → flags → validate
  ├── internal/store    one *sql.DB, schema, queries, rollups, retention
  ├── internal/doctor   read-only inspection, for `weatherglass doctor`
  ├── internal/scheduler  one goroutine per enabled sensor
  │     ├── internal/sensor   http | tcp | ping | dns
  │     ├── internal/notify   telegram, discord, matrix, ntfy, slack, webhook
  │     └── internal/event   in-process pub/sub → SSE
  └── internal/api      HTTP handlers, auth, CSRF, SSE
        └── internal/web  embed.FS with index.html, app.js, i18n.js, style.css
```

Startup is deliberately linear: load configuration, open the store, apply the
declarative sensors, build the scheduler and the dispatcher, build the API server,
then serve until the signal arrives. Shutdown cancels the root context, waits for
the scheduler's goroutines, and closes the database. There is no dependency
injection framework and no service registry, because there are eight components
and their order is fixed.

## Storage

Everything is in one SQLite file, opened with `modernc.org/sqlite` — a pure-Go
translation of SQLite, so `CGO_ENABLED=0` holds and the binary cross-compiles to a
Pi without a toolchain. The connection pool is pinned to a single connection
(`SetMaxOpenConns(1)`): the writes are tiny, and correctness and freedom from lock
contention are worth more than concurrency on a homelab workload. WAL,
`busy_timeout=5000`, `foreign_keys=ON`, and `synchronous=NORMAL` are set on open.

```
sensors           one row per sensor, options as a JSON blob
channels          one row per alert channel, config as a JSON blob
sensor_channels   many-to-many, both sides ON DELETE CASCADE
results           raw probe results, indexed by (sensor_id, ts)
results_hourly    bucket = "2026-10-08T13:00:00.000000000Z"
results_daily     bucket = "2026-10-08"
incidents         started_at, resolved_at, cause
settings          key/value: password hash, API key, session secret, UI settings
```

The single-connection decision has one sharp edge worth knowing before you touch a
query: **a `*sql.Rows` that is never closed holds that one connection forever**, and
every other request in the process then blocks behind it. Every query in
`internal/store` closes its rows, most of them via `defer`, and that is not
optional style.

Two schema decisions carry weight beyond their size:

**Timestamps are fixed-width UTC strings.** They are written as
`2006-01-02T15:04:05.000000000Z`, never `RFC3339Nano`, because the latter drops
trailing zeros and `…:00.5Z` then sorts *before* `…:00Z`. Since every range query
is a lexicographic `BETWEEN` on `ts`, the format is a correctness requirement, not
a style choice. `store_test.go` pins it down, including a test that asserts the
RFC3339Nano form sorts wrong.

**Buckets are derived from the timestamp prefix.** An hourly bucket is
`substr(ts,1,13) || ':00:00.000000000Z'`, a daily one `substr(ts,1,10)`. No
boundary arithmetic, no timezone surprises, and the rollup statements can be
expressed in pure SQL.

### Three resolutions, one answer

A range query selects **exactly one** resolution — raw if the window fits in the
raw window, hourly if it fits in the hourly window, daily otherwise — and reads
only from that table. This is the property that keeps the numbers honest: if two
resolutions could contribute to one chart, samples inside the overlap would be
counted twice and uptime would quietly drift above 100%. A test
(`TestSeriesPicksOneResolution`) probes exactly this.

Rollups are idempotent. The insert is an
`ON CONFLICT DO UPDATE SET samples = excluded.samples`, so a repeated pass rewrites
the same bucket rather than accumulating it. Only *complete* hours and days are
rolled up — the boundary is the start of the current hour or day — which is why the
hour you are currently in is never summarised half-finished. Raw pruning deletes
rows below the raw window; the rollups they fed stay.

Charts therefore render a gap as a gap. A bucket with no samples is returned as
empty rather than as a zero, because "we did not probe" and "the probe failed" are
different facts and a monitoring tool that conflates them is worse than useless.

## Sensors

`internal/sensor` defines one interface:

```go
type Prober interface {
    Type() model.SensorType
    Validate(model.Sensor) error
    Run(context.Context, model.Sensor) (Outcome, error)
}
```

Adding a sensor type means writing one file with those three methods and registering
it. `Options` is a `map[string]any` with typed accessors (`Str`, `Int`, `Bool`) that
return defaults for anything missing or of the wrong type, so a sensor saved by an
older version keeps working — a `count` that arrives as a string falls back to the
default rather than becoming zero.

Each engine validates itself, and the same validation runs on the draft from the UI
(`POST /api/sensors/validate`), so the form can tell you the target is not `host:port`
before you save it rather than after.

Two engine details worth knowing:

- **Ping** tries an unprivileged datagram ICMP socket first, then a raw socket, and
  reports precisely which one failed and why when neither works. Silent ping failure
  is the most confusing thing about containerised monitoring; a sensor that cannot
  ping says so.
- **DNS** builds its own queries with `golang.org/x/net/dns/dnsmessage` instead of
  leaning on the system resolver, so it can point at a specific server and inspect
  the actual records rather than whatever the resolver decided to return.

## Scheduler and incident lifecycle

One goroutine per enabled sensor, each on its own ticker with a little jitter so that
thirty sensors configured at `60s` do not fire in the same millisecond. The scheduler
does not own the sensor list: `Reconcile` diffs the stored sensors against the running
loops and starts, restarts, or stops them, and it is called after any change made
over the API. A sensor edited in the UI therefore changes behaviour without a restart.

Per sensor, the runtime state is: the current status, the consecutive-failure count,
the open incident, and the time of the last alert. On startup this is rebuilt from
the database — the running failure streak and any still-open incident included — so
a container restart neither loses an outage nor re-announces one that is already
known.

The state machine is small and lives in one function:

```
success  → fail streak resets; if an incident was open, close it and alert "up"
failure  → fail streak grows; when streak == retries, open an incident and alert "down"
           while an incident stays open, alert again every reminder_every
```

The transition and its incident row are written while the mutex is held; logging,
event fan-out, and alert delivery happen after it is released. Notifications never
run inside the lock, so a slow Telegram API call cannot stall every sensor in the
process.

Alert delivery fans out to a sensor's channels in parallel goroutines, each with up
to three attempts and a linear backoff; a `429` or a `5xx` is retried, other `4xx`
responses are not, because a bad token will not fix itself. A channel that keeps
failing has its error recorded and surfaced in the UI, and never suppresses the
others. `ProbeNow`, which backs the dashboard's "Run now" button, deliberately
bypasses all of this: a manual probe is informational and never opens an incident or
fires an alert.

## API and authentication

`net/http`'s `ServeMux` with method-and-pattern routing (`GET /api/sensors/{id}`) — no
router dependency, and Go 1.22+ handles the path variables.

`internal/api` is split by concern: `server.go` builds the routing tree,
`handlers.go` holds the endpoints, `auth.go` the session and API-key logic, `mask.go`
the secret redaction. Handlers are thin: parse and validate the body, call the store,
write JSON. Validation errors come back as `{"error": "..."}` with a 4xx status and
are shown verbatim in the UI, so the message a user sees is the one the server wrote.

Updates are partial by contract: every field of a request body is a pointer, so
"absent" is distinguishable from "empty", and the handler overlays only what the
client sent on top of the stored row. A body carrying `{"target": "..."}` changes the
target and nothing else; an explicit `""` or `[]` clears a field. The alternative —
treating an absent field as an empty one — silently blanks the name, clears the
group, and resets the interval to its default.

Authentication supports two paths:

- **Session cookie** — `weatherglass_session`, value `"<expiry>.<hmac>"` signed with
  a secret generated on first start, `HttpOnly`, `SameSite=Strict`, and deliberately
  **without** `Secure`, because homelab installs are usually plain HTTP on the LAN.
  The code comments say so; the test asserts it.
- **API key** — a generated key sent as `X-API-Key` or `Authorization: Bearer`, for
  scripts, cron jobs, and Home Assistant.

Cookie-authenticated writes are additionally checked against `Origin` (falling back
to `Referer`) plus `SameSite=Strict`, which together stop a page on another site from
driving the API. Requests with no `Origin` at all — curl, scripts — pass, because
they carry no ambient cookie and are already covered by the API key.

Passwords are bcrypt at cost 12. Login attempts are limited to five per minute in
memory. `/api/setup` runs once: a fresh database has no password, the dashboard shows
a setup screen, and after that the endpoint refuses. A password in
`WEATHERGLASS_ADMIN_PASSWORD` bootstraps the first one and is then ignored.

Secrets never leave the server. `internal/api/mask.go` replaces every field the
channel definition marks `Secret: true` with a marker on the way out, and a request
that sends the marker back keeps the stored value instead of overwriting it with the
literal marker. The Telegram sender strips the token from error messages before they
reach a log line or the UI.

## Logging and diagnostics

Every request produces exactly one log line: `info` as `msg="http request"` with the
method, path, status and duration — or, when the status is `500` or worse, `error` as
`msg="http request failed"` with the same fields plus `message` (what the client was
told) and `error` (what actually went wrong, which the client never sees). The
invariant is enforced by the response writer rather than by discipline at the call
sites: the recorder the middleware already wraps around every handler carries the
failure up from wherever it was written, so a handler added later that forgets to log
is still logged. Two things bypass it deliberately — a panic, which `net/http` recovers
into its own `ErrorLog`, and a background error that does not spoil the response (a
reconcile failing after an already-successful `201`), which is logged where it happens.
A request that took longer than ten seconds logs a separate `warn` on top, because
"slow" and "failed" are different statements.

`internal/doctor` is the other half of that: what the log says about one request, doctor
says about the whole installation. Its two rules shape the code — it changes nothing
and it sends no alert — which is why it opens the database through `store.OpenReadOnly`
with a DSN of its own. A `journal_mode` pragma is a write, so reusing `store.Open`'s DSN
would make a read-only open fail outright rather than merely refuse to write. The same
reasoning produced `config.Resolve` beside `config.Load`: a diagnostic has to keep
naming the data directory precisely when the configuration file is the thing that is
broken, and `Load`'s job is to refuse to start.

## Live updates

`internal/event` is a tiny pub/sub broker: publishers never block, and a subscriber
whose buffer is full drops the event rather than stalling the scheduler.
`/api/events` forwards the stream to the browser as SSE. The dashboard is eventually
consistent by design — every client also fetches `/api/summary` when it connects — so
a dropped event costs a stale row for a moment, never a wrong number.

## Frontend

No build step, no framework, no CDN. `internal/web/assets` holds `index.html`,
`app.js`, `charts.js`, `i18n.js`, `watchdog.js`, and `style.css` as plain ES modules,
embedded with `embed.FS`. Editing a `.js` file and reloading the page is the whole
development loop, and the image ships exactly the bytes in the repository.

`app.js` renders from state and refetches on SSE events; `charts.js` draws the
sparklines and response-time charts on `<canvas>` without a charting library. Charts
are drawn for the theme in use and redrawn when it changes, so they stay readable in
high-contrast and dark modes.

Two conventions the frontend holds to:

**No browser storage.** No `localStorage`, no `sessionStorage`. The session is a
cookie the server owns, and every other preference is state the server can describe.
That makes "which settings am I actually running?" a question with exactly one
answer — and it means a dashboard that is a pure function of `/api/summary` plus the
event stream.

**No silent hang.** Every API call carries a 15-second deadline and reports a
timeout message rather than leaving a spinner. `boot()` is wrapped so that a failure
lands on an error panel with a Reload button. And `watchdog.js` — a separate module
that imports nothing — replaces the boot spinner with an explanation if `app.js`
itself failed to load, which is the one case no code inside `app.js` could report.

`i18n.js` is a message catalogue with a language list. English is the only dictionary
so far; adding a language means adding a dictionary and one entry, with no changes
elsewhere, because the markup never contains user-facing strings.

## Packaging

`Dockerfile` is a two-stage build. The builder is pinned to
`--platform=$BUILDPLATFORM` and uses `TARGETOS`/`TARGETARCH`, so a multi-arch build
cross-compiles rather than emulating: the arm64 image for a Pi builds at native
speed. This requires BuildKit. The runtime stage is
`gcr.io/distroless/static-debian12:nonroot`, with `USER 0:0` on top of it — no shell, no
package manager. It starts as root for exactly as long as it takes to hand the data
directory to `PUID:PGID` and become that user (`internal/privdrop`), because that
directory is a bind mount whose owner only root can change; after that it is
unprivileged and cannot go back. See
[Privileges](/concepts/security#privileges). Because there is no shell, the image's
`HEALTHCHECK` runs the binary itself (`weatherglass healthcheck`), which makes a
`GET /healthz` and exits non-zero on failure.

Multi-arch publishing and the release archives are driven from
`.github/workflows/release.yml`, with the version, commit, and build date stamped
into `internal/model` via `-ldflags`, so `weatherglass version` and `/api/version`
report exactly which build is running.

## Testing

`internal/store`, `internal/config`, `internal/sensor`, `internal/notify`,
`internal/scheduler`, and `internal/api` all have tests; CI runs them with `-race`.
The sensor and notify tests exercise real sockets — a local `httptest` server, a real
TCP listener, a DNS stub built with `dnsmessage` — rather than mocking the network,
because the interesting failures are in the interaction with it. The API tests drive
a real `httptest` server with its own store and scheduler; the scheduler tests drive
the state machine a step at a time against a real store, which keeps the
incident-lifecycle assertions deterministic instead of dependent on a ticker.

The suite is not decoration. It has found, before any of them reached a user: a
template-source leak in `notify` that put raw Go template text into an alert, two
parsing gaps in `config` (integer intervals and day/week retention), a nil-context
panic in `Reconcile`, a partial update that detached every alert channel, and a
recovery alert that reported the outage length as zero because the start time was
read after the status timestamp had been overwritten.

## Next steps

- [Contributing](/development/contributing)
- [Roadmap](/development/roadmap)
