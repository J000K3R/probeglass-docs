---
title: Troubleshooting
sidebar_label: Troubleshooting
description: What to look at when the container will not stay up, the dashboard will not load, sensors never turn green, alerts do not arrive, or the database is locked.
---

# Troubleshooting

Start here: what the process is doing, and what it thinks is wrong.

```bash
docker exec weatherglass weatherglass doctor
```

That is the fastest answer, and inside a container it is the only one — the image
is distroless, so there is no shell and no `curl` to fall back on. `doctor` reports
what is wrong with the installation and changes nothing, which is why it is safe
to run against a database you are worried about. See
[Command line](/reference/cli#doctor) for what each line means.

When you want the raw log instead:

```bash
docker logs weatherglass --tail 50
curl -s http://localhost:8080/healthz
```

At `info` level a healthy start looks like this:

```
level=INFO msg="starting weatherglass" version=0.1.0 listen=:8080 data_dir=/data config=""
level=INFO msg="dashboard listening" url=http://localhost:8080
```

For the detail behind a single request — which endpoint, how long it took — run
with debug logging:

```bash
docker run -d --name weatherglass -e WEATHERGLASS_LOG_LEVEL=debug ...
```

**Settings → Help and maintenance → About** shows the version, the base URL, the data directory, the
configuration file actually loaded, and the log level. That panel answers "is it
running the file I think it is running?" in one look.

## 🛑 The container starts and stops again {#the-container-starts-and-stops-again}

`docker ps -a` shows it as `Exited (1)`, and with `--restart unless-stopped` it
comes back every few seconds. First, because it is the natural next move and it
will not work here: `doctor` needs a running container to exec into. There is
nothing to look at in the dashboard either — the process never got as far as
listening. The log is the whole story:

```bash
docker logs weatherglass --tail 20
```

The line that matters is the one without a timestamp, because it goes straight to
stderr rather than through the logger:

```
weatherglass: ping database /data/weatherglass.db: unable to open database file (14)
```

That is SQLite failing to open its own file. `14` is `SQLITE_CANTOPEN`, and SQLite
reports the same number whether the directory is missing, the file is read-only,
the disk is full, or the directory belongs to somebody else. Current versions
append which of those it actually is:

```
weatherglass: ping database /data/weatherglass.db: unable to open database file (14); /data is
not writable by uid 65532, the user this process runs as. A bind mount keeps the ownership of the
host folder rather than taking the image's, so hand that folder to it once and start again:
chown -R 65532:65532 <host folder>
```

If your line carries no such hint, the cause is one of the others — check the free
space on the volume, and see [Backup](/operations/backup) for what else the
container expects to be able to write.

### The bind mount kept the host's ownership

This is the cause almost every time, and it catches people who did nothing wrong.

The image runs as uid **65532** (see [the image](/getting-started/install#the-image)).
A **named volume** is created by Docker from the image's own `/data`, so it
inherits 65532 and simply works — that is what the install instructions and the
compose example use. A **bind mount** (`-v /host/path:/data`) does not: the host
folder keeps whatever owner it already had, and if that owner is root, uid 65532
cannot create a database inside it. Docker starts the container anyway, which is
why the failure arrives one line later rather than at startup.

Find out what the container is actually mounting, rather than trusting the
compose file to say what you think it says:

```bash
docker inspect -f '{{range .Mounts}}{{.Type}} {{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' weatherglass
```

Then look at the owner of that `Source` path **on the host**:

```bash
ls -ln /path/from/above
```

The third column is the numeric uid. If it is not `65532`, that is the problem:

```bash
sudo chown -R 65532:65532 /path/from/above
docker restart weatherglass
```

The same applies to the directories above it: a path has to be walkable, so every
parent needs its execute bit. A folder that is `700` and owned by root is
unreadable at any depth, no matter who owns the last component.

### When that does not hold

- **A network share that squashes root** (NFS `root_squash`, some SMB exports)
  silently discards the `chown`. The export has to permit the ownership change,
  or the data directory has to live on a local disk.
- **Unraid** serves `/mnt/user/appdata/...` through a FUSE layer over
  `/mnt/cache/appdata/...`. Changing ownership through the `/mnt/user` view can be
  slow, or appear to do nothing. Address the disk the data actually lives on.
- **A read-only mount** (`:ro` in the volume spec) fails in exactly this way.
  Worth a look at the volume line.
- **The disk is full.** Check with `df -h` on the host at that path. With no space
  left, SQLite cannot even create its journal file and reports it as a failure to
  open the database — the same line as everything else.

### A named volume is the short way out

If the folder is not doing anything else for you, drop the bind mount and let
Docker own the volume:

```bash
docker run -d --name weatherglass \
  -p 8080:8080 \
  -v weatherglass-data:/data \
  --cap-add NET_RAW \
  --restart unless-stopped \
  ghcr.io/j000k3r/weatherglass:dev
```

Nothing inside the container needs a particular host path — the whole state is one
SQLite file and its write-ahead log. A named volume is created with the right owner
from the start, and `docker volume inspect weatherglass-data` still tells you where
it lives when you want to copy it out. The one thing to know is that a bind mount
is what you want if you already have a backup routine pointed at an appdata
folder; in that case keep the bind mount and fix the ownership.

## 🚪 The dashboard will not load {#the-dashboard-will-not-load}

Start here, because it splits the problem in half in one look. Run the daemon
with its log visible and reload the page. If you see these three lines, the
dashboard is not hanging — it is working, and something is wrong with what the
browser does with the answer:

```
level=INFO msg="http request" method=GET path=/             status=200
level=INFO msg="http request" method=GET path=/api/session  status=200
level=INFO msg="http request" method=GET path=/api/summary  status=200
```

`/api/summary` is only ever requested by the shell, after the session is known.
If it is in the log, the JavaScript ran, the session is valid and the data
arrived: whatever you are looking at is a rendering or styling problem, not a
connection one. If it is *not* in the log, the JavaScript never ran, and the
list further down applies.

A request that failed on the server looks different — same fields, at `ERROR`,
under a different message, with the reason attached:

```
level=ERROR msg="http request failed" method=GET path=/api/summary status=500 duration_ms=4
      message="could not load summary" error="sql: database is closed"
```

`message` is what the browser was told; `error` is what actually went wrong, and
it never reaches the browser. There is exactly one request line per request —
either this one or the `info` one above, never both — so a 500 is never silent.

This distinction matters because the two failures look identical on screen and
have nothing to do with each other. A full-height spinner that stays put over a
dashboard that is loading fine behind it is the classic case, and it is a
styling bug — it has happened.

### The panel appears

The page shows a spinner, then — after twelve seconds — a panel saying the
dashboard did not load, with a Reload button. That panel is the boot watchdog,
and it exists because the spinner used to be a dead end.

Click **Reload** first; a single dropped request is the most common cause. If it
comes back, the panel's detail text is the thing to report.

### The spinner never becomes that panel

Then the browser never ran the dashboard's JavaScript at all. In order of
likelihood:

1. **You are looking at a cached copy of an older dashboard.** The shell is sent
   with `Cache-Control: no-store` and everything under `/assets/` with
   `no-cache`, so this takes a belligerent cache, but a hard reload
   (`Ctrl`/`Cmd`+`Shift`+`R`) settles it.
2. **A proxy is serving a stale copy of its own.** Check the proxy's cache
   configuration; the headers are on the response, and a proxy that ignores them
   will happily serve last week's JavaScript against this week's HTML.
3. **The browser blocked the module.** Open the console. A Content Security
   Policy violation or a failed `/assets/*.js` request is explicit there. In
   Chrome, Firefox and Edge the console is `F12`; in Safari it is *Settings →
   Advanced → "Show features for web developers"*, then *Develop → Show
   JavaScript Console*.
4. **The request never reached the server.** If there is no `/` line in the log
   at all, nothing arrived, and the problem is the port mapping, the proxy, or a
   firewall.

If the panel *does* appear, the message it carries is the server's own, and the
detail below it is the JavaScript error. That is the fastest path to a bug report
anyone can act on.

### Nothing is listening on the port

A second copy of the daemon cannot start, and the message says so:

```
weatherglass: cannot listen on :8080 — is another copy of Weatherglass already
running? (listen tcp :8080: bind: address already in use)
```

Find it with `lsof -nP -iTCP:8080 -sTCP:LISTEN` (macOS, Linux) or
`netstat -ano | findstr :8080` (Windows), then stop it. The stale copy is the
one answering your browser, so the dashboard you are looking at is the old
version's.

## 🔑 The password is accepted, but nothing happens {#the-password-is-accepted-but-nothing-happens}

This is the symptom of a session cookie the browser did not keep. The dashboard
now checks for it explicitly and says so, rather than leaving you on the login
screen with no explanation.

The usual causes:

- **Cookies are blocked for the site.** Some privacy settings block
  first-party cookies. The dashboard needs exactly one.
- **The clock is wrong.** The cookie value is `<expiry>.<hmac>`; if the browser's
  clock is far enough ahead, it treats the cookie as already expired.
- **A proxy is rewriting `Set-Cookie`.** Look for `Path=/` or a domain rewrite in
  the proxy configuration.
- **The origin is not stable.** `Origin` must match the host the request arrived
  at. Reaching the dashboard by IP one minute and hostname the next will fail the
  cross-site check; pick one and use it, and set `base_url` to it.

A fresh session works around all of these for one request:

```bash
curl -s -c /tmp/jar -X POST -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:8080' \
  -d '{"username":"jane","password":"your-password"}' http://localhost:8080/api/login
curl -s -b /tmp/jar http://localhost:8080/api/session
```

If that returns `"authenticated":true`, the server is fine and the problem is in
the browser or the proxy in front of it.

### The setup form comes back after you created the account

If the form reappears rather than reporting an error, the account was never
stored. Hashing a password takes about a quarter of a second — deliberately, it
is what makes a stolen hash expensive to attack — and a page that is reloaded
inside that window used to cancel the write and lose the choice. That is fixed,
so on a current version this means something else stopped the write. The
server log names it:

```
level=ERROR msg="http request failed" method=POST path=/api/setup status=500
      message="could not create the account" error="…"
```

A failed write on a database that is otherwise fine usually means the data
directory is not writable. See
[Backup](/operations/backup) for what the container expects to be able to write,
and check the volume's permissions.

## 🟡 A sensor never turns green {#a-sensor-never-turns-green}

Look at the sensor's own message — the dashboard shows the probe's last words, and
they are specific rather than generic.

| Message | Cause |
|---|---|
| `permission denied` on a ping sensor | Neither an unprivileged ICMP socket nor a raw one could be opened. Add `--cap-add NET_RAW`; on a host, sensor `net.ipv4.ping_group_range` |
| `dial tcp: i/o timeout` | The target is unreachable from the container. Sensor DNS and routing *inside* the container, not from your laptop |
| `no such host` | Name resolution failed. If the name is internal, the container may need your LAN's DNS server |
| `x509: certificate signed by unknown authority` | A self-signed certificate. Use `insecure_skip_verify: true` **on that sensor** if that is acceptable, or install the CA |
| `HTTP 503` on a sensor you expected to pass | Working as intended: the sensor is asserting on the status |
| `body does not contain …` | The service answered, but not with what you expect |

A sensor that has failed once but not reached its `retries` threshold shows as
**Unknown**, not Down. That is deliberate — the honest answer at that moment is
"we do not know yet" — and it means a single failed probe is not a problem to
investigate.

**Run now** executes the sensor immediately and shows the result, without waiting
for the next tick, without opening an incident, and without sending an alert.
It is the fastest way to tell "the sensor is broken" from "the service is broken".

## 🔕 Alerts do not arrive {#alerts-do-not-arrive}

Work through it in this order, because each step is cheap and eliminates half the
possibilities:

1. **Test the channel.** The **Test** button under **Alerts** sends a real message
   through the real sender. If it fails, the error is the sender's own.
2. **Is the channel attached to the sensor?** A channel that exists but is attached
   to nothing is a channel that never fires. The sensor editor has the list.
3. **Has the sensor reached its retry threshold?** With `retries: 3` and
   `interval: 60`, the first alert comes at least two minutes after the first
   failure.
4. **Is the channel enabled?** A disabled channel is skipped.
5. **Is the sensor managed and `enabled: false` in the configuration file?** The
   file wins.
6. **Is `reminder_every` set to 0?** That disables repeat alerts; you get one
   "down" and one "up", and nothing in between.

A channel that keeps failing has its error recorded and shown in the UI, and it
does not suppress any other channel — delivery fans out in parallel.

For a webhook receiver, verify the signature against the **raw body**, not a
parsed and re-serialised version of it; re-encoding changes the bytes and the HMAC
will not match. The header is `X-Weatherglass-Signature`, of the form
`sha256=<hex>`.

## 🔒 The database is locked, or a request hangs {#the-database-is-locked-or-a-request-hangs}

Weatherglass opens SQLite with a single connection on purpose: the writes are
tiny, and correctness is worth more than concurrency on a homelab workload. The
practical consequence is that a request which holds that connection blocks every
other request — so a hang is a symptom with one cause.

A request that takes more than ten seconds logs a warning that says so:

```
level=WARN msg="slow request" method=GET path=/api/summary status=200 duration_ms=14203 hint="the database may be locked or on a stalled disk"
```

If you see that line, look for:

- **A second process on the same database file.** Two containers mounting the same
  volume, or a leftover `weatherglass serve` from a previous experiment still
  holding a port. `docker ps` and `lsof -iTCP:8080` will tell you.
- **A stalled disk.** NFS, a sleeping USB drive, or a failing SSD. `dmesg` and the
  disk's own health sensor are where to look.
- **A long-running query on a huge database.** Retention settings that keep far
  more raw data than intended. See [History and uptime](/concepts/history) for the
  sizing, and lower `retention.raw`.

The database itself uses WAL, a five-second busy timeout, and `synchronous=NORMAL`.
A crash cannot corrupt it, and a copy taken while it is running is fine as long as
you take the `-wal` file too — see [Backup](/operations/backup).

## 🚧 Port already in use {#port-already-in-use}

```
weatherglass: listen tcp :8080: bind: address already in use
```

Something else has the port. On a host with a previous experiment still running:

```bash
lsof -iTCP:8080 -sTCP:LISTEN
```

Or map a different port on the host — `-p 8081:8080` — and leave the container
listening where it expects to.

## 🟢 The sensors are all green but nothing is monitored {#the-sensors-are-all-green-but-nothing-is-monitored}

Sensor that the sensors exist and are enabled. A sensor created in the UI and then
disabled shows as **Paused**, which is grey rather than green, and is easy to
miss on a busy dashboard.

```bash
curl -s -H "X-API-Key: $WG_KEY" localhost:8080/api/sensors | jq '.[] | {name, enabled, interval}'
```

If a sensor is missing entirely, it may have been declared in a configuration file
that is no longer being loaded — **Settings → Help and maintenance → About** names the file actually in
use, or says *None*.

## 🐛 Reporting a problem {#reporting-a-problem}

Include the version and build from `weatherglass version`, the deployment method,
the last fifty log lines, and what you expected to happen. If it is a dashboard
problem, the browser console output is worth more than a screenshot.

Security problems: please do not open a public issue. See
[SECURITY.md](https://github.com/j000k3r/weatherglass/blob/main/SECURITY.md).
