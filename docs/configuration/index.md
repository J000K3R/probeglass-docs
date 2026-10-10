---
slug: /configuration/
title: Configuration
sidebar_label: Overview
description: Where Weatherglass reads its settings from, and the order of precedence.
---

# Configuration

Weatherglass reads its process configuration from four places. **Later sources
win:**

1. Built-in defaults
2. A YAML file
3. `WEATHERGLASS_*` environment variables
4. Command-line flags

The dashboard's own settings — theme, accent colour, density, layout, language,
the accounts, the API key — are not in this list. They live in the database and
are edited in the UI, because they are per-install or per-account state rather than
deployment configuration.

## Which file is read

If you do not pass `-config`, Weatherglass looks in two more places before giving
up:

```
-config PATH
  → $WEATHERGLASS_CONFIG
  → <data_dir>/weatherglass.yaml   (only if that file exists)
  → no file at all
```

The third entry is what makes the container image work without arguments: mount a
`weatherglass.yaml` next to the database and it is picked up. A missing file is
not an error; a file that exists but does not parse is, and the process refuses to
start rather than silently running on defaults.

## Process settings

| Key | Default | Meaning |
|---|---|---|
| `listen` | `:8080` | Address the dashboard listens on |
| `data_dir` | `/data` | Directory holding the database |
| `db_path` | `<data_dir>/weatherglass.db` | Path to the SQLite file, if you want it elsewhere |
| `base_url` | — | Public URL, used in links inside alerts |
| `log_level` | `info` | `debug`, `info`, `warn`, or `error` |
| `log_format` | `text` | `text` or `json` |
| `trust_proxy` | `false` | Honour `X-Forwarded-*` headers from a reverse proxy |

`WEATHERGLASS_ADMIN_PASSWORD` is the one setting with no file equivalent:
putting a password in a file that gets committed is how it ends up in a
repository. It is read only when the database has no password yet.

```yaml
listen: ":8080"
data_dir: /data
base_url: https://weatherglass.lan
log_level: info
log_format: text
trust_proxy: false

retention:
  raw: 7d
  hourly: 90d
```

:::caution
Only set `trust_proxy: true` when Weatherglass is actually behind a proxy that
sets `X-Forwarded-For`. Otherwise any client can forge its own address, and the
login rate limiter becomes trivial to sidestep.
:::

`base_url` is used to build the link inside an alert message. Without it, alerts
carry no link — which is survivable, but a link that goes straight to the
dashboard turns "something is wrong" into a two-second check.

## Retention

| Key | Default | Meaning |
|---|---|---|
| `retention.raw` | `7d` | How long individual probe results are kept |
| `retention.hourly` | `90d` | How long hourly rollups are kept; daily rollups are kept forever |

Durations accept Go syntax (`30s`, `5m`, `2h`) plus the day and week suffixes
these settings are naturally written in (`7d`, `90d`, `2w`), or a bare number of
seconds. `1.5d` works too.

These are the two settings that decide how much disk the database uses. Roughly:
a week of raw samples for forty sensors at one-minute intervals is about 400 000
rows and a few tens of MB, and the daily rollups that outlive them are a rounding
error. See [History and uptime](/concepts/history).

## Where to go next

- [Configuration file](/configuration/file) — the full YAML reference,
  including declarative sensors and alert channels
- [Environment variables](/configuration/environment) — the complete list
- [Dashboard settings](/configuration/dashboard) — theme, accent, density,
  layout, language
