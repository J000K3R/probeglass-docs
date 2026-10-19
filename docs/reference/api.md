---
title: HTTP API
sidebar_label: HTTP API
description: Every endpoint, how to authenticate, partial updates, and the Server-Sent Events stream.
---

# HTTP API

The dashboard is a client of the same API you can script against. There is no
separate internal API and no private endpoints: everything the browser does, curl
can do.

## Authentication

Three ways, in order of usefulness for a script:

```bash
# API key in a header
curl -H "X-API-Key: $PG_KEY" http://localhost:8080/api/summary

# …or as a bearer token, for clients that want OAuth-shaped syntax
curl -H "Authorization: Bearer $PG_KEY" http://localhost:8080/api/summary

# …or a session cookie, which is what the dashboard uses
curl -c /tmp/jar -X POST -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:8080' \
  -d '{"username":"jane","password":"…"}' http://localhost:8080/api/login
curl -b /tmp/jar http://localhost:8080/api/summary
```

Generate the key under **Settings → Access → API key**. Rotating it invalidates the old one
immediately; deleting it signs every script out at once.

:::warning The key is an administrator
A request carrying the API key is treated as an administrator with **no account
behind it**. It can do everything an administrator can. It is not tied to an
account either, so disabling one has no effect on it. Keep it in a secret store
and rotate it when anyone who had it leaves.
:::

An account with a second factor answers the first step differently:

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"username":"jane","password":"…"}' http://localhost:8080/api/login
# {"totp_required":true,"challenge":"…"}

curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"challenge":"…","code":"123456"}' http://localhost:8080/api/login/totp
# {"ok":true}
```

The challenge is a short-lived signed token, good for two minutes, and it is not a
session: it can only be spent on `/api/login/totp`. The `code` field also accepts
one of the account's recovery codes. A code from a time step the account has
already used is refused.

Cookie-authenticated **writes** are additionally checked against `Origin`
(falling back to `Referer`). Requests with no `Origin` header at all — curl,
scripts, cron — pass, because they carry no ambient cookie and are already covered
by the API key. A browser on another site cannot drive the API even with a valid
cookie.

Every request re-reads the account row, so a role change, a disabled account or a
deleted account takes effect on the next request rather than on the next sign-in.
What each role may do is in [Security](/concepts/security#roles).

Errors are `{"error": "…"}` with a 4xx or 5xx status. The message is written for a
human and is shown verbatim in the UI, so it is worth reading rather than
pattern-matching on the status code.

## Endpoints

### Public

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/healthz` | Liveness. `{"status":"ok","version":…,"uptime":…}`. No auth |
| `GET` | `/api/version` | `version`, `build`, `commit`, `build_date` |
| `GET` | `/api/session` | Whether setup is needed, whether you are signed in, your `user` (`id`, `username`, `role`, `totp_enabled`, `recovery_codes_left`) and your UI settings |
| `POST` | `/api/login` | `{"username":"…","password":"…"}` → `{"ok":true}` or a TOTP challenge |
| `POST` | `/api/login/totp` | `{"challenge":"…","code":"…"}` → `{"ok":true}` |
| `POST` | `/api/logout` | Clears the cookie |
| `POST` | `/api/setup` | First-run only; refuses once an account exists. `{"username":"…","password":"…","mode":"simple"\|"advanced"}` |

### Sensors

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/sensors` | All sensors with their current status and sparkline | viewer |
| `POST` | `/api/sensors` | Create | admin |
| `GET` | `/api/sensors/{id}` | One sensor | viewer |
| `PUT` | `/api/sensors/{id}` | Update — **partial**, see below | admin |
| `PATCH` | `/api/sensors/{id}` | `{"enabled":false}` and nothing else | operator |
| `DELETE` | `/api/sensors/{id}` | Delete, cascading to results and incidents | admin |
| `POST` | `/api/sensors/validate` | Validate a draft without saving; add `"probe": true` to run it once | operator |
| `POST` | `/api/sensors/{id}/probe` | Run now: store a result, no incident, no alert | operator |
| `POST` | `/api/sensors/{id}/ack` | Acknowledge, suppressing reminders until it recovers | operator |
| `PUT` | `/api/sensor-order` | `{"ids":[3,1,2]}` — dashboard order | admin |

`PUT` and `PATCH` are separate on purpose. `PUT` takes a whole sensor and is an
administrator's edit; `PATCH` accepts exactly one field and is what lets an
operator pause a sensor without being able to rename it. A `PATCH` body carrying
anything else is a `403`, not a silent partial update.

### History

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/sensors/{id}/results?limit=40` | Recent raw samples |
| `GET` | `/api/sensors/{id}/series?range=24h` | Downsampled points for a chart |
| `GET` | `/api/sensors/{id}/uptime?range=30d` | Uptime, latency statistics, incident count and downtime |
| `GET` | `/api/sensors/{id}/incidents` | That sensor's outages |
| `GET` | `/api/incidents` | Every outage, newest first — filterable, see below |
| `POST` | `/api/incidents/{id}/ack` | Acknowledge one outage |
| `DELETE` | `/api/incidents/{id}/ack` | Take the acknowledgement back |

Valid `range` values: `1h`, `24h`, `7d`, `30d`, `90d`, `1y`, `all`.

`GET /api/incidents` answers with the list the **Incidents** tab draws, and takes
the same four filters that page puts on screen:

| Parameter | Values | Effect |
|---|---|---|
| `state` | `all` (default), `open`, `resolved` | which of the two readings to show |
| `open` | `1` | the older spelling of `state=open`, and still accepted |
| `sensor` | a sensor id | one sensor's outages |
| `range` | a `range` value as above | outages that **started** inside the window |
| `since` | an RFC 3339 timestamp | the same thing named as a moment. Ignored when `range` is given |
| `q` | free text | matches the cause, the sensor's name and the acknowledgement note |
| `limit` | 1–1000, default 50 | how many rows come back |

Two spellings of the window exist because two callers want them: the dashboard's
filter row has buttons and sends `range=7d`, and a script wants to name the moment
an outage happened. Refusing either would mean the API could not express what the
page can.

```bash
# Everything still running on one sensor, in the last week.
curl -H "X-API-Key: $PG_KEY" \
  'localhost:8080/api/incidents?state=open&sensor=3&range=7d'
```

The free text is matched with `instr`, like the search: `%` and `_` are characters,
not wildcards.

An acknowledgement records **who** did it: an incident acknowledged from the
dashboard carries that account's username, and one acknowledged with the API key
carries `"api"`.

### Search

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/search?q=…` | Everything the dashboard's search box looks through |

One query, six kinds of answer. `q` is compared **literally** and must be at least
two characters and at most sixty-four. A query shorter than the minimum is not an
error — it is answered with an empty list, because somebody typing one letter at a
time has done nothing wrong and does not deserve a red toast for it.

```bash
curl -s -H "X-API-Key: $PG_KEY" 'localhost:8080/api/search?q=router' | jq
```

```json
{
  "hits": [
    {"kind":"sensor","ref":"3","title":"Router","sub":"192.168.1.1 · Network","state":"up","at":"2026-10-09T21:00:00Z"},
    {"kind":"incident","ref":"18","title":"Router","sub":"no answer in 1s","state":"resolved","at":"2026-10-08T03:14:00Z"}
  ],
  "truncated": false
}
```

| `kind` | `ref` is | what was matched |
|---|---|---|
| `sensor` | the sensor id | name, target, group, tags, type and site |
| `site` | the site name | name and kind |
| `channel` | the channel id | name and type |
| `incident` | the incident id | cause, sensor name, acknowledgement note |
| `result` | the sensor id | the message of a raw probe result inside the retention window |
| `user` | the username | username and role — **administrators only** |

`truncated` means at least one kind had more to give than the twenty rows it is
allowed. Narrow the query; there is no cursor to page with.

Two things are deliberately **not** searched, and it is the same rule the rest of
the API follows. A sensor's `options` and a channel's `config` hold credentials —
`bearer_token`, `basic_auth_pass`, `community`, bot tokens, webhook URLs — and a
search box that answers with somebody's bot token is worse than no search box. So
is a channel's masked value: `__stored__` would be a hit that tells you nothing.
Account password hashes, TOTP secrets and recovery-code hashes are not touched
either, and `user` hits are left out entirely for anyone below administrator —
that check sits in the handler, not in the interface.

Matching is `instr(lower(column), lower(?))` rather than `LIKE`, so `%`, `_` and
`\` in a query stand for themselves. A search that reads a typed `%` as a wildcard
turns one keystroke into a full scan of the history, and finds the wrong thing on
the way.

### Alerts

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/channels` | All channels, with secrets replaced by a marker | viewer |
| `POST` | `/api/channels` | Create | admin |
| `PUT` | `/api/channels/{id}` | Update | admin |
| `DELETE` | `/api/channels/{id}` | Delete | admin |
| `GET` | `/api/channel-types` | Per channel type: its label, its field descriptions, and a numbered `setup` recipe for getting the credentials — this is what drives the editor dialog, and what the documentation's [per-type recipes](/concepts/alerts#getting-the-credentials) are written from | viewer |
| `POST` | `/api/channels/test` | Send a test through a channel that is not saved yet | admin |
| `POST` | `/api/channels/{id}/test` | Send a test through a stored channel | admin |

### Settings and your own account

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/settings` | `ui`, `api_key` (administrators only), `runtime` (version, paths, retention, uptime, log level) and `stats` (counts, oldest and newest sample, database size) | viewer |
| `PUT` | `/api/settings` | `{"ui":{"theme":"dark"}}` — any subset of the UI keys, written to **your** account | viewer |
| `POST` | `/api/onboarding/tour` | `{"version":2}` — how far you got in the guided tour | viewer |
| `POST` | `/api/api-key` | Rotate; returns the new key | admin |
| `DELETE` | `/api/api-key` | Remove | admin |
| `PUT` | `/api/password` | `{"current_password":"…","new_password":"…"}` | viewer |
| `POST` | `/api/me/totp/start` | `{"secret":"…","uri":"otpauth://…"}` — stores it as unconfirmed | viewer |
| `GET` | `/api/me/totp/qr` | The same secret as an `image/png` QR code, `Cache-Control: no-store` | viewer |
| `POST` | `/api/me/totp/confirm` | `{"code":"…"}` → `{"recovery_codes":[…]}` **once** | viewer |
| `POST` | `/api/me/totp/disable` | `{"password":"…"}` — clears the secret and the recovery codes | viewer |
| `POST` | `/api/me/totp/recovery` | `{"password":"…"}` → a fresh set; the old one stops working | viewer |
| `POST` | `/api/doctor` | Run the self-check | operator |

:::note
`GET /api/settings` returns the API key **in clear text** to an administrator —
the Settings screen has to be able to show it. It is left out for everyone below
that. Unlike channel credentials, it is not masked. Treat an administrator's
session cookie as being worth an API key, because it is.
:::

Changing your own password signs out **your other sessions** and nobody else's: it
bumps your account's token epoch, and every session of that account carries the
epoch it was issued with. The browser that made the change gets a fresh cookie and
stays signed in. An administrator resetting somebody else's password does the same
to that person.

Because these settings live on the account, a request carrying the **API key** has
no account to write them to: reads answer with the defaults and writes go nowhere.
Use a session for preferences.

### Accounts

Administrators only.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/users` | `{"users":[…],"roles":["admin","operator","viewer"]}`, each with role, second-factor state, last sign-in and remaining recovery codes |
| `POST` | `/api/users` | `{"username":"…","password":"…","role":"viewer"}` |
| `PUT` | `/api/users/{id}` | `{"role":"operator","disabled":false}` |
| `DELETE` | `/api/users/{id}` | Delete the account and its recovery codes |
| `POST` | `/api/users/{id}/password` | `{"new_password":"…"}` — reset without the old password, signing that person out everywhere |

Two rules are enforced here rather than in the interface: the last active
administrator cannot be deleted, demoted or disabled, and nobody can delete or
disable themselves. Both answer `409`.

### Backup and restore

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/backup?scope=config\|history&days=7\|30\|90\|all` | Write the installation out as one JSON document | admin |
| `POST` | `/api/restore` | Read one back in. The file **is** the request body | admin |

`scope=config` (the default) writes the settings, the sites, the sensors, the
channels and the accounts. `scope=history` writes all of that **plus** the
incidents and the hourly and daily rollups of the last `days` days — or of
everything, with `days=all`. `days` means nothing for the config scope, and is
absent from such a file rather than present as a zero.

```bash
curl -fsS -H "X-API-Key: $PG_KEY" \
  "localhost:8080/api/backup?scope=history&days=30" -o backup.json
```

It arrives as `application/json` with
`Content-Disposition: attachment; filename="probeglass-backup-2026-10-09.json"`
and `Cache-Control: no-store`. The filename is built on the server from a constant
and the date; no part of the request reaches it.

:::warning The file carries secrets in clear text
Password hashes, TOTP secrets, recovery-code hashes, the API key and every alert
channel's credentials — the one place in the product where a stored secret is
written out unmasked. That is what makes it restorable, and it is the reason the
file deserves the same care as the database itself. See [The backup file carries
secrets in the clear](/concepts/security#backup-secrets).
:::

A restore takes the document as the request body. There is no multipart form
anywhere in the product and this does not introduce the first one; the body is
capped at 64 MiB and read as a stream.

```bash
curl -X POST -H "X-API-Key: $PG_KEY" -H 'Content-Type: application/json' \
  --data-binary @backup.json localhost:8080/api/restore
```

```json
{
  "counts": {"sensors": 12, "channels": 2, "users": 1},
  "safety_copy": "probeglass-pre-restore-20261009T211500Z.db",
  "token_epoch_notice": false
}
```

A document whose `format` is not `probeglass-backup`, or whose format or schema
version is newer than this build understands, is a `400` and nothing is written. A
byte-exact `VACUUM INTO` safety copy is taken before anything is replaced, and a
restore whose safety copy fails does not go ahead. A table the file does not
mention is left exactly as it is, so a config restore never wipes history — while
inside a table rows are replaced rather than merged. Sensors, sites and channels
are matched **by name**, because a name is what a sensor is in this program, and
the running scheduler is reconciled afterwards so probes resume against the
restored sensors instead of the ones that were there before. `token_epoch_notice`
is true when the restored accounts carry session epochs that re-validate sign-ins.

The whole procedure, both directions, and what the two scopes are for, is in
[Backup and restore](/operations/backup).

### Sample data

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/examples` | `{"sensors":n,"results":n,"incidents":n,"sites":n}` — what the setup and `seed --demo` left behind | viewer |
| `POST` | `/api/examples` | Load the sample data back, with an invented week of history. Answer is the `GET` shape | admin |
| `DELETE` | `/api/examples` | Remove exactly those sensors, and their history with them | admin |

The response to the `DELETE` is the same shape as the `GET`: how much went. It is
the one destructive bulk operation in the product, and a number is easier to trust
than "done".

Only sensors marked as sample data are touched. A sensor you created is never
removed, whatever it is called. The invented places go too, but only the ones the
removal leaves empty — a place that has since been given a sensor of your own is in
use and stays, and the `sites` count says how many would go before anything is
deleted.

The `POST` is the way back from the `DELETE`, and it deliberately loads the
**richer** dataset — more sensors than the setup writes, in their groups, with a
week of invented history — rather than the four sensors a fresh installation starts
with, which carry a shorter but real history of their own. Somebody who has just
deleted everything and asked for it back wants to see what the dashboard looks like
with a whole homelab on it, curves and all. The answer is the table's new totals
rather than what this call created, because "example sensors" is what the panel is
about.

Running it twice is harmless. A name already in the table is left alone, so the
second call creates nothing and invents nothing — the uniqueness constraint on a
sensor name is a `409` waiting to happen, and this is where it does not happen.

It answers `409` on an installation configured from a file, for the same reason
the setup route does: the file is the source of truth for sensors, and writing
rows it does not declare is how two sources of truth begin to disagree.

### Sites

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/sites` | `{"sites":[…],"kinds":["local","external"]}` — each site with its kind, coordinates and **`sensor_count`** | viewer |
| `POST` | `/api/sites` | `{"name":"…","kind":"local","lat":48.1372,"lon":11.5756}` | admin |
| `PUT` | `/api/sites/{name}` | Rename or move one. A rename is carried into every sensor pointing at it | admin |
| `DELETE` | `/api/sites/{name}` | Delete. **`409`** while sensors are still on it — add `?unassign=1` to delete it and leave those sensors without a site | admin |
| `PUT` | `/api/map` | `{"tile_url":"…","attribution":"…","borders":"on"}` — the installation-wide tile source and whether the map draws its borders and names; empty `tile_url` means "fetch nothing" | admin |

```bash
curl -X POST -H "X-API-Key: $PG_KEY" -H 'Content-Type: application/json' \
  -d '{"name":"Rack A","kind":"local","lat":48.1372,"lon":11.5756}' \
  localhost:8080/api/sites
```

`kind` is `local` (the homelab) or `external` (a hoster or a cloud) and defaults to
`local` if it is left out or is an empty string. **`lat` and `lon` travel together
or not at all** — one of them alone is a `400`, and a site with `null` coordinates
is not broken: it groups the tree and the wall like any other and is simply not
drawn on the map. `0` is a real coordinate, so it is never read as "unknown".

The **name is the identity**. Sensors point at a site by its name rather than by an
id, which is what lets a configuration file — which can only name things, never
know a database id — describe a site with [one line](/configuration/file#sites).
The cost is that renaming is a change of identity: the `PUT` moves every sensor
with it, and a site declared in the configuration file cannot be renamed or deleted
through the API at all, because the next apply would put the old name back.

Deleting a site that is still in use is refused rather than cascading:

```bash
curl -X DELETE -H "X-API-Key: $PG_KEY" localhost:8080/api/sites/Rack%20A
# 409 {"error":"site \"Rack A\" still has 3 sensor(s): move them to another site,
#       or delete it with unassign=1 to leave them without one"}

curl -X DELETE -H "X-API-Key: $PG_KEY" 'localhost:8080/api/sites/Rack%20A?unassign=1'
# 200 {"deleted":"Rack A","unassigned":true}
```

`tile_url` must be `http` or `https` and must contain `{z}`, `{x}` and `{y}`;
`{s}` is optional and cycles through `a`, `b` and `c`. **An empty `tile_url` is
accepted and is not validated**, because it is the way to turn tile fetching off:
the map then draws the coastlines bundled with the binary and the browser requests
nothing. There is no default tile URL to fall back to. `PUT /api/map` is
**installation-wide and administrator-only**, unlike `PUT /api/settings`, which
writes the calling account's own preferences. Saving a tile URL takes effect
without a restart — the origin is folded into the content security policy at once,
which is what lets the browser actually fetch the tiles; clearing the field takes it
back out. See [Security](/concepts/security#map-tiles).

`borders` is `"on"` (the default) or `"off"` and decides whether the map draws the
country and province borders and their names, or only the coastlines. Anything else
is a `400`. It is a **pointer**, which is the one asymmetry in this payload: leaving
the field out keeps the stored value instead of clearing it, so a script that only
wants to set a tile address — or a client written before this field existed, since
unknown fields are refused — cannot switch the layer off by saying nothing about it.
With `"off"` the two data files that carry the borders and the names are not sent to
the browser at all, so the setting saves bytes as well as strokes. It is read back
as `borders` from `GET /api/settings`, and the small map widget on the dashboard
follows it too.

Sensors carry a **`site`** field like any other: a string on `POST /api/sensors`
and `PUT /api/sensors/{id}`, empty to clear it. A name that does not exist is a
`400`, not a `500`, so a typo in a setup script fails loudly. `GET /api/summary`
returns the sites alongside the sensors, so a client can fold and draw the
dashboard from the one request it already makes.

### Groups and tags

Groups and tags are words on a sensor, not rows a sensor points at: `group` is one
string and `tags` is a list of them on the sensor itself. These routes carry only
what a word cannot say — a symbol, a colour and a place in the order — and a word
that no sensor carries yet can have settings too.

| Method | Path | Purpose | Role |
|---|---|---|---|
| `GET` | `/api/groups` | `{"groups":[…],"accents":[…]}` — every group with `icon`, `colour`, `sort_order` and **`sensor_count`** | viewer |
| `PUT` | `/api/groups/{name}` | `{"icon":"builtin:router","colour":"amber","sort_order":2}` — creates the settings row if this is the first | admin |
| `DELETE` | `/api/groups/{name}` | Forget the settings; the sensors keep the word | admin |
| `GET` | `/api/tags` | The same shape for tags | viewer |
| `PUT` | `/api/tags/{name}` | The same body; a tag name may not contain a comma | admin |
| `DELETE` | `/api/tags/{name}` | Forget the settings; the sensors keep the word | admin |

`colour` is one of the six accent names or empty; `icon` is a `builtin:` drawing, an
`upload:` id or empty; `sort_order` is the position, lower first. Every field is
optional on the `PUT` and an omitted one keeps what is stored. `DELETE` answers
`{"forgotten":"…","sensors":N}` where `N` is how many sensors still carry the word —
the word itself is a sensor field and is not removed.

### Live

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/events` | Server-Sent Events stream |

Whether a dashboard opens this stream at all is the per-account preference
**`live`**, `"on"` (the default) or `"off"`, written through `PUT /api/settings`
like any other UI key and reported by `GET /api/session`. Off means exactly that:
the browser does not subscribe, and nothing arrives. The minute-by-minute refetch
that runs regardless is the safety net underneath it, not a substitute for it.

## Partial updates

`PUT /api/sensors/{id}` changes **only the fields you send**. Every field in the
body is optional; an absent field keeps its stored value, and an explicit empty
string or empty list clears it.

```bash
# Change the target and nothing else.
curl -X PUT -H "X-API-Key: $PG_KEY" -H 'Content-Type: application/json' \
  -d '{"target":"nas2.local:445"}' \
  localhost:8080/api/sensors/3

# Clear the group and the tags, and leave everything else alone.
curl -X PUT -H "X-API-Key: $PG_KEY" -H 'Content-Type: application/json' \
  -d '{"group":"","tags":[]}' \
  localhost:8080/api/sensors/3
```

The alternative — treating an absent field as an empty one — quietly blanks the
name, clears the group, and resets the interval to its default. That is a bug that
takes a while to notice and a while to explain afterwards.

## Secrets

Channel credentials are never returned. Every field the channel type marks as
secret comes back as a marker string, and sending that marker back **preserves
the stored value** rather than overwriting it with the literal text:

```bash
curl -H "X-API-Key: $PG_KEY" localhost:8080/api/channels | jq '.[0].config.bot_token'
# "__stored__"   — the marker, not the token

# Round-trip it safely: read the channel, change one field, send it back.
curl -s -H "X-API-Key: $PG_KEY" localhost:8080/api/channels/1 | jq '.config.chat_id = "-100999"' \
  | curl -X PUT -H "X-API-Key: $PG_KEY" -H 'Content-Type: application/json' -d @- \
      localhost:8080/api/channels/1
```

The token is never in an HTTP response, so it is never in a browser cache, a
proxy log, or a screenshot.

## Server-Sent Events

`GET /api/events` streams newline-delimited SSE frames. Each has an `event:` name
and a JSON `data:` payload:

| `event:` | Payload |
|---|---|
| `result` | One probe result, for patching a single card without refetching |
| `status` | A sensor changed status |
| `incident` | An incident opened or closed |
| `sensor` | A sensor was created, changed, or deleted |
| `channel` | A channel changed |
| `settings` | UI settings changed |

```
event: status
data: {"sensor_id":3,"status":"down","result":{"ts":"2026-10-08T12:00:00Z","success":false,"message":"HTTP 503"}}
```

The kinds are worth reading apart rather than treating every frame as "something
changed, fetch again", which is what a dashboard used to do and what made a page
that redrew itself under the hand of whoever was looking at it. A `result` is a
number: it updates one card's figures and extends its sparkline and heartbeat in
place, with nothing else on the screen touched. `status` and `incident` carry a
state as well, so they move the status dot and the running outage too, and mark
that one card. `sensor`, `channel` and `settings` say that **a list has changed**
rather than that a value has, and those are the ones answered with a refetch —
the shape of the list is what moved, and no patch can express that.

A heartbeat comment (`: keep-alive`) is sent every 25 seconds so that proxies do
not close an idle stream. The publisher never blocks: a subscriber whose buffer is
full drops the event rather than stalling the scheduler. The dashboard is
eventually consistent by design — every client also fetches `/api/summary` when it
connects — so a dropped event costs a stale row for a moment, never a wrong
number.

Reconnect with `Last-Event-ID` is not supported; refetch `/api/summary` instead.

## Examples

### Uptime for every sensor, as a table

```bash
for id in $(curl -s -H "X-API-Key: $PG_KEY" localhost:8080/api/sensors | jq -r '.[].id'); do
  curl -s -H "X-API-Key: $PG_KEY" "localhost:8080/api/sensors/$id/uptime?range=30d" \
    | jq -r --arg id "$id" '[$id, (.uptime.percent|tostring), (.incidents.count|tostring)] | @tsv'
done
```

### Alert on anything currently down

```bash
curl -s -H "X-API-Key: $PG_KEY" localhost:8080/api/sensors \
  | jq -r '.[] | select(.status == "down") | "\(.name) — \(.message)"'
```

### Import from a shell script

```bash
curl -X POST -H "X-API-Key: $PG_KEY" -H 'Content-Type: application/json' \
  -d '{"name":"Router","type":"ping","target":"192.168.1.1","interval":30,"retries":3,"group":"Network"}' \
  localhost:8080/api/sensors
```

Creating the same sensor twice creates two sensors. There is no name uniqueness
constraint — declaring sensors in a [YAML file](/configuration/file) is the
idempotent route.
