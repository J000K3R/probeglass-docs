---
title: Environment variables
sidebar_label: Environment variables
description: Every WEATHERGLASS_* variable, what it maps to, and how it interacts with the config file.
---

# Environment variables

Every setting in the [configuration file](/configuration/file) has an environment
equivalent. The environment wins over the file, and the command-line flags win
over the environment — which makes it easy to keep a base configuration in a file
and override one value per deployment in a compose file.

| Variable | Equivalent | Example |
|---|---|---|
| `WEATHERGLASS_CONFIG` | — | `/etc/weatherglass/weatherglass.yaml` |
| `WEATHERGLASS_LISTEN` | `listen` | `:8080` |
| `WEATHERGLASS_DATA_DIR` | `data_dir` | `/data` |
| `WEATHERGLASS_DB` | `db_path` | `/data/weatherglass.db` |
| `WEATHERGLASS_BASE_URL` | `base_url` | `https://weatherglass.lan` |
| `WEATHERGLASS_LOG_LEVEL` | `log_level` | `debug` |
| `WEATHERGLASS_LOG_FORMAT` | `log_format` | `json` |
| `WEATHERGLASS_TRUST_PROXY` | `trust_proxy` | `true` |
| `WEATHERGLASS_RETENTION_RAW` | `retention.raw` | `7d` |
| `WEATHERGLASS_RETENTION_HOURLY` | `retention.hourly` | `90d` |
| `WEATHERGLASS_ADMIN_PASSWORD` | — | see below |

`WEATHERGLASS_CONFIG` is special: it names the configuration file rather than
overriding a setting inside it. If it points at a file that does not exist, that
is an error — a typo in a mount path should not silently leave you running on
defaults.

:::note
`WEATHERGLASS_DB` maps to the `db_path` key, not to `db`. The variable name is
shorter than the key on purpose: it is the one that gets typed into a `docker
run` line.
:::

## `WEATHERGLASS_ADMIN_PASSWORD`

Bootstraps the dashboard password on a fresh database. It is read **only when no
password exists yet** and ignored on every later start — it does not override an
existing password, so leaving it in a compose file is not a back door.

This is the intended way to deploy Weatherglass unattended:

```yaml
services:
  weatherglass:
    image: j000k3r/weatherglass:latest
    restart: unless-stopped
    ports: ["8080:8080"]
    volumes: ["weatherglass-data:/data"]
    cap_add: ["NET_RAW"]
    environment:
      WEATHERGLASS_ADMIN_PASSWORD: ${WEATHERGLASS_ADMIN_PASSWORD:?set it in .env}
      WEATHERGLASS_BASE_URL: http://weatherglass.lan:8080
      WEATHERGLASS_LOG_FORMAT: json
      WEATHERGLASS_RETENTION_RAW: 14d
volumes:
  weatherglass-data:
```

Compose expands `${VAR:?message}` from the shell environment or a `.env` file
next to the compose file, and refuses to start if it is unset — which is the
behaviour you want for a password.

## Durations

`WEATHERGLASS_RETENTION_RAW` and `WEATHERGLASS_RETENTION_HOURLY` accept:

| Form | Example | Meaning |
|---|---|---|
| Go duration | `30s`, `5m`, `2h` | The usual |
| Day | `7d`, `1.5d` | 7 days, 36 hours |
| Week | `2w` | 14 days |
| Bare number | `3600` | Seconds |

The day and week suffixes exist because retention is the one place where `168h`
is a worse way of writing `7d`, and a monitoring tool whose retention setting is
unreadable is a monitoring tool with the wrong retention setting.

## Invalid values

An environment variable that cannot be parsed is a startup error naming the
variable — not a silent fallback to the default:

```
weatherglass: WEATHERGLASS_RETENTION_RAW: invalid duration "seven days": ...
```

The process exits. A monitor that comes up with a different retention policy than
the one you configured, and does not say so, is worse than one that does not come
up at all.

## Precedence, in one example

Given a file with `log_level: info` and:

```bash
WEATHERGLASS_LOG_LEVEL=warn weatherglass serve -log-level debug
```

the effective level is `debug`: flags beat environment, environment beats file,
file beats defaults.

## Next steps

- [Configuration file](/configuration/file)
- [Dashboard settings](/configuration/dashboard) — the ones that live in the
  database rather than the environment
