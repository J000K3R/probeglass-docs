---
title: Configuration file
sidebar_label: Configuration file
description: The complete YAML reference, including declarative sensors and alert channels.
---

# Configuration file

A single YAML file holding the process settings, retention, and optionally the
sensors and alert channels themselves. If you declare them, a rebuild from zero
takes seconds instead of an evening of clicking.

```yaml
# weatherglass.yaml — mount this next to the database and it is picked up.
listen: ":8080"
data_dir: /data
base_url: https://weatherglass.lan
log_level: info
log_format: text
trust_proxy: false

retention:
  raw: 7d
  hourly: 90d

sites:
  - name: Rack A
    kind: local
    lat: 48.1372
    lon: 11.5756

sensors:
  - name: Router
    type: ping
    target: 192.168.1.1
    interval: 30s
    retries: 3
    group: Network
    site: Rack A

  - name: Nextcloud
    type: http
    target: https://cloud.example.org/status.php
    interval: 60s
    timeout: 10s
    options:
      expected_status: 200
      body_contains: '"installed":true'
    channels: [telegram]

channels:
  - name: telegram
    type: telegram
    config:
      bot_token: "123456:ABC-DEF..."
      chat_id: "-1001234567890"
```

## Precedence

Defaults, then this file, then `WEATHERGLASS_*` environment variables, then
command-line flags — later wins. The file's path is resolved in this order:
`-config PATH`, then `$WEATHERGLASS_CONFIG`, then `<data_dir>/weatherglass.yaml`
if it exists.

A file that exists and does not parse is a startup error. The process refuses to
run on defaults rather than coming up misconfigured in a way you would only
notice the next time something broke.

## Process settings

| Key | Type | Default | Meaning |
|---|---|---|---|
| `listen` | string | `:8080` | Address to serve on |
| `data_dir` | string | `/data` | Directory holding the database |
| `db_path` | string | `<data_dir>/weatherglass.db` | Path to the SQLite file |
| `base_url` | string | — | Public URL; used to build links inside alerts |
| `log_level` | string | `info` | `debug`, `info`, `warn`, `error` |
| `log_format` | string | `text` | `text` or `json` |
| `trust_proxy` | bool | `false` | Honour `X-Forwarded-*`; only behind a proxy you control |

## Retention

```yaml
retention:
  raw: 7d        # individual probe results
  hourly: 90d    # hourly rollups; daily rollups are kept forever
```

Durations accept Go syntax (`30s`, `5m`, `2h`), the day and week suffixes these
settings are naturally written in (`7d`, `90d`, `2w`), fractional days (`1.5d`),
or a bare number of seconds.

## Declarative sensors and channels

Anything under `sensors:` and `channels:` is re-applied on every start. The rules
are simple and worth reading twice:

- **The file wins.** A sensor or channel that comes from the file is marked
  **managed** in the UI: its edit, pause, reorder, and delete buttons are
  disabled. Changing it in the browser would only be undone at the next restart,
  so the UI does not offer.
- **Sensors and channels are matched by name.** Renaming one in the file creates a
  new object and leaves the old one behind, with its history. Rename
  deliberately.
- **Declaring is additive.** The file is not a full description of the install,
  only of the part you want under version control. Sensors and channels you
  created in the UI stay exactly where they are.
- **Removing a line does not remove the object.** It stays in the database,
  still marked managed, so it is still read-only in the UI — the file is no
  longer talking about it, but nothing has told the dashboard that. Delete it
  over the API (or with a `DELETE` straight at the SQLite file) if you really
  want it gone.
- **A sensor referring to an unknown channel is a startup error**, not a warning.
  A sensor that silently alerts nobody is the failure this tool exists to prevent.

### Sensor fields

| Key | Type | Notes |
|---|---|---|
| `name` | string | Required, and the identity used to match an existing sensor |
| `type` | string | `http`, `tcp`, `tls`, `ping`, `dns`, `docker` or `snmp` |
| `target` | string | See [Sensors](/concepts/sensors) for the shape each type expects |
| `interval` | duration | Seconds between probes; also accepts `60s`, `5m` |
| `timeout` | duration | Seconds before the probe is abandoned |
| `retries` | int | Consecutive failures before an incident opens |
| `enabled` | bool | Default true |
| `group` | string | Free-text label |
| `site` | string | The **name** of a site, grouping the dashboard by place |
| `tags` | list of strings | |
| `reminder_every` | duration | Repeat alerts while down; 0 disables |
| `options` | map | Type-specific, see below |
| `channels` | list of strings | Channel **names**, matching the `name` of a channel |

A YAML file has no notion of "5 seconds or 300", so `interval: 1` is a plain
number of seconds. If you would rather be explicit, `60s` and `5m` work and read
better.

### Sites

A sensor's `site` is a **name**, and the daemon guarantees that the name exists: a
site a sensor mentions but the file does not describe is created — bare, at the
default kind, with no coordinates — rather than refused or silently dropped. So a
minimal file needs no `sites:` section at all:

```yaml
sensors:
  - name: Router
    type: ping
    target: 192.168.1.1
    site: Rack A          # created if it is not there yet
```

A site that is worth describing properly goes in a list of its own:

```yaml
sites:
  - name: Rack A
    kind: local          # local (default) or external
    lat: 48.1372         # optional, but both coordinates or neither
    lon: 11.5756

  - name: Hetzner Cloud
    kind: external       # no coordinates: it groups, but is not on the map
```

| Key | Type | Notes |
|---|---|---|
| `name` | string | Required; the identity, and what a sensor's `site` refers to |
| `kind` | string | `local` (the homelab, the default) or `external` (a hoster or cloud) |
| `lat` | float | −90 to 90 |
| `lon` | float | −180 to 180 |

A site written out in full is **managed** exactly like a sensor from the file: the
file owns its name, its kind and its coordinates, and none of them can be changed
or removed in the dashboard, because the next start would put the old definition
back and every sensor pointing at it would break.

A site that is merely *named* by a sensor is a different thing. It is created if
missing and otherwise left completely alone — including any coordinates somebody
gave it in the dashboard. A file with no opinion about where a place is must not
have the effect of erasing one.

Sites you would rather not version-control can simply be created by hand under
**Settings → Monitoring → Sites**.

See [Dashboard settings](/configuration/dashboard#sites) for what sites do.

### Type-specific options

```yaml
# http
options:
  method: GET
  expected_status: "200-299"
  headers:
    Accept: application/json
  user_agent: weatherglass/0.1
  basic_auth_user: monitor
  basic_auth_pass: secret
  bearer_token: eyJ...
  body: '{"ping":true}'
  body_contains: '"ok":true'
  body_not_contains: "Error"
  body_regex: '"version":"\\d+\\.\\d+"'
  expected_headers:
    Content-Type: application/json
  max_body_bytes: 262144
  follow_redirects: true
  insecure_skip_verify: false
  cert_warn_days: 21

# tcp
options:
  tls: true
  server_name: mail.example.org
  insecure_skip_verify: false
  send: "EHLO monitor.lan\r\n"
  expect: "250"

# ping
options:
  count: 3

# dns
options:
  record_type: A
  resolver: 192.168.1.1:53
  expected: 192.168.1.42
  expect_all: false
```

The full list with defaults and meaning is in [Sensors](/concepts/sensors).

### Channel fields

| Key | Type | Notes |
|---|---|---|
| `name` | string | Required; this is what `channels:` in a sensor refers to |
| `type` | string | `telegram`, `discord`, `matrix`, `ntfy`, `slack`, `webhook` |
| `enabled` | bool | Default true |
| `config` | map of strings | Type-specific, see below |

```yaml
channels:
  - name: telegram
    type: telegram
    config:
      bot_token: "123456:ABC-DEF..."
      chat_id: "-1001234567890"
      thread_id: "12"          # forum groups only
      silent: "true"           # deliver without a notification sound

  - name: discord
    type: discord
    config:
      webhook_url: https://discord.com/api/webhooks/...
      username: Weatherglass

  - name: matrix
    type: matrix
    config:
      homeserver_url: https://matrix.example.org
      access_token: syt_...
      room_id: "!abcdefg:homeserver.example.org"

  - name: ntfy
    type: ntfy
    config:
      server_url: https://ntfy.sh
      topic: my-homelab-alerts
      token: tk_...
      priority: high

  - name: slack
    type: slack
    config:
      webhook_url: https://hooks.slack.com/services/...
      channel: "#alerts"

  - name: homeassistant
    type: webhook
    config:
      url: https://ha.lan/api/webhook/weatherglass
      method: POST
      hmac_secret: a-long-random-string
```

Every channel type additionally accepts `title_template` and `body_template` in
its `config`. See [Message templates](/concepts/alerts#message-templates).

:::warning
A configuration file is a file. If it holds a bot token or a webhook secret, it
will end up in a git repository or a backup archive sooner or later — so either
keep it out of version control (`.gitignore` the real one and commit a
`.example`), or declare only the sensors in the file and create the channels in
the UI, where the secrets stay in the database and are never returned by the API.
:::

## Validating a file

Check it without starting anything:

```bash
weatherglass doctor --config /etc/weatherglass/weatherglass.yaml
```

The `config` line says whether the file was found and parses, and `config sensors`
says whether every sensor and channel in it would be accepted — the same validation
`serve` applies, run in the same place, so a file doctor accepts is a file serve
will start with. It also notices a declaration that has not reached the database
yet, which is the state between editing the file and restarting the daemon.

Starting the process remains a valid check too: a configuration problem is a
startup error with the offending key in the message, not a warning buried in a
running log. See [`doctor`](/reference/cli#doctor).
