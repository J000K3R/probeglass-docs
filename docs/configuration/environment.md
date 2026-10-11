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

One thing is set by the environment and has no counterpart in the file at all:
which user the container runs as. That is [`PUID`, `PGID` and `UMASK`](#puid-pgid-and-umask),
below.

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
    image: ghcr.io/j000k3r/weatherglass:dev
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

## `PUID`, `PGID` and `UMASK`

These three have no `WEATHERGLASS_` prefix and no line in the configuration file, and that
is not an oversight: they are not settings of the daemon. They say which **user** the
container should run as, and there is no equivalent in a YAML file for a decision the
kernel has to be asked for.

| Variable | Default | Meaning |
|---|---|---|
| `PUID` | `500` | the user the daemon becomes |
| `PGID` | `500` | the group it becomes |
| `UMASK` | `022` | the permission mask for files it creates |

The container starts as root, takes its data directory over and then becomes `PUID:PGID`,
before it opens the database or binds a port. That is what makes a first install work
without a `chown`: a bind mount keeps the ownership of the host folder, and the platforms
this gets installed on create that appdata folder as root — a folder that only root may
hand to somebody else. [Security](/concepts/security#privileges) explains the root moment
in full.

The practical consequences:

- **They only work when the process starts as root.** With `--user`, with `user:` in
  compose, or on a rootless runtime, the daemon is not root, cannot claim the folder and
  cannot change user, so it ignores the three and says so in one log line. A value that is
  quietly ignored is the failure these variables exist to remove.
- **Outside a container they apply to the same rule, not to the same paths.** Run the
  binary as yourself and it runs as you; run it as root — `sudo`, a systemd unit with
  `User=root` — and it takes the data directory over and drops exactly like the container
  does, so `PUID=0` is how you keep root there.
- **A value that cannot be parsed stops the start** when the process is root — the same
  treatment `WEATHERGLASS_LOG_LEVEL` gets. `PUID=abc` is an error rather than a silent fall
  back to 500.
- **`PUID=0` and `PGID=0` mean "stay root"**, for the whole run. It is supported and it is
  logged at startup, and it is not recommended: it gives up the property that everything a
  sensor or a request can reach runs unprivileged.
- **Quote `UMASK`**: `UMASK: "022"`, not `UMASK: 022`. YAML reads an unquoted `022` as the
  number 18, and 0018 is not a mask anybody typed — so the daemon refuses it instead of
  running with it. `022`, `0022` and `22` all mean the same thing when they arrive as text.

```yaml
services:
  weatherglass:
    image: ghcr.io/j000k3r/weatherglass:dev
    volumes: ["/srv/appdata/weatherglass:/data"]
    cap_add: ["NET_RAW"]
    environment:
      PUID: 1000
      PGID: 1000
      UMASK: "022"
```

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
