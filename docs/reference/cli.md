---
title: Command line
sidebar_label: Command line
description: Every subcommand and flag, and what each one is for.
---

# Command line

```
weatherglass — a small, self-hosted watchdog for your homelab

Usage:
  weatherglass [serve] [flags]     start the daemon
  weatherglass version             print the version and exit
  weatherglass healthcheck         query the local /healthz endpoint
  weatherglass doctor              report what is wrong with this installation
  weatherglass seed --demo         create demo sensors with synthetic history
```

With no subcommand, `weatherglass` serves. That is the common case, so it is the
default: the container entrypoint needs no arguments at all.

## ▶️ `serve` {#serve}

```bash
weatherglass serve
weatherglass serve --listen :9000 --data /srv/weatherglass --log-level debug
```

| Flag | Default | Meaning |
|---|---|---|
| `-config PATH` | — | YAML configuration file. Defaults to `$WEATHERGLASS_CONFIG`, then `<data_dir>/weatherglass.yaml` |
| `-listen ADDR` | `:8080` | Address to serve the dashboard on |
| `-data DIR` | `/data` | Directory for the database |
| `-log-level LVL` | `info` | `debug`, `info`, `warn`, or `error` |
| `-log-format FMT` | `text` | `text` or `json` |

Every flag has a `WEATHERGLASS_*` environment equivalent, and the environment
wins over the configuration file. See
[Environment variables](/configuration/environment).

Flags use Go's `flag` package, so `-listen` and `--listen` are the same thing.

## `version`

```bash
$ weatherglass version
weatherglass 0.1.0 (4a1c2e7) built 2026-11-02T09:14:03Z
```

The commit and build date are stamped in by the release workflow. A local
`go build` prints the version alone.

## 💓 `healthcheck` {#healthcheck}

Queries the local `/healthz` endpoint and exits non-zero if it does not answer.
This is what the image's `HEALTHCHECK` runs, which is why `docker ps` shows the
real state of the container without needing a shell inside it — the distroless
image has neither a shell nor `curl`.

```bash
weatherglass healthcheck
weatherglass healthcheck --listen 127.0.0.1:9000 --timeout 10s
```

| Flag | Default | Meaning |
|---|---|---|
| `-listen ADDR` | from configuration | Address the daemon is listening on |
| `-timeout DUR` | `5s` | How long to wait for an answer |

When the configured listen address is `:8080` or `0.0.0.0:8080`, the sensor
substitutes `127.0.0.1` — dialling a wildcard address is not a thing, and the
difference is easy to get wrong once and then debug for an hour.

## 🌱 `seed` {#seed}

Fills a database with demo sensors and a synthetic history, so the dashboard can be
looked at without waiting a week for data to accumulate.

```bash
weatherglass seed --demo --days 7 --data /tmp/weatherglass-demo
```

| Flag | Default | Meaning |
|---|---|---|
| `--demo` | required | Create the demo sensors with synthetic history |
| `--days N` | `7` | Days of history to synthesise, 1 to 365 |
| `--data DIR` | `/data` | Directory for the database |
| `--config PATH` | — | YAML configuration file |

Without `--demo` the command refuses to run. It will not guess what to insert
into a database it did not create.

See [Try it with demo data](/getting-started/demo-data).

## 🩺 `doctor` {#doctor}

Reports what is wrong with this installation, and changes nothing.

```bash
docker exec weatherglass weatherglass doctor
weatherglass doctor --data /srv/weatherglass --listen 127.0.0.1:9000
```

This is the command for the container. The image is distroless — no shell, no
`curl`, no tools to fall back on — so `docker exec` into the running container and
running this is the one thing you can do when the dashboard will not load, a sensor
never turns green, or no alert ever arrives. The same report is also available
from **Settings → Help and maintenance → Diagnostics** in the dashboard, which prints this command for
you to copy; see
[Dashboard settings](/configuration/dashboard#the-self-check).

What it reports, in the order it prints it:

| Label | What it proves |
|---|---|
| `build` | Which binary produced this report |
| `config` | The YAML file was found and parses |
| `data dir` | The daemon will be able to write to it |
| `database` | The file exists, and how big it is |
| `integrity` | `PRAGMA quick_check` finds no damage |
| `schema` | The file and the binary agree on the schema version |
| `users` | There are accounts, and at least one of them is an active administrator — the thing that makes the dashboard reachable |
| `contents` | Stored sensors, channels and sites still validate, no sensor points at a deleted channel, and no sensor points at a site that is not there |
| `config sensors` | The sensors, channels and sites in the file would be accepted, and have been applied |
| `config sites` | Warns, rather than fails, when a configured sensor names a site the database does not have yet — the daemon creates it on the next start, and until then that sensor cannot be stored at all |
| `daemon` | The process is up and answering on the health endpoint |
| `icmp` | Ping sensors can open a socket — only reported when one exists |

Two rules shape it:

- **It changes nothing.** The database is opened read-only. Nothing is created,
  migrated or repaired. A diagnostic that quietly fixes what it asked to report
  would report success for a problem it had just removed.
- **It never sends an alert.** Channel configuration is validated; no message is
  delivered. Firing a real message into a chat room from a machine somebody is
  trying to debug is not a thing to do.

It does not run the sensors either. That would fire real probes, take as long as
their timeouts allow, and report a passing network blip as an installation fault.

A healthy installation:

```bash
$ docker exec -u 500:500 weatherglass weatherglass doctor
weatherglass doctor

ok    build             weatherglass 0.1.0 (4a1c2e7) built 2026-11-02T09:14:03Z
ok    config            /data/weatherglass.yaml (3 sensors, 1 channel)
ok    data dir          /data (writable by uid 500)
ok    database          /data/weatherglass.db, 1.2 MiB, 40213 probes
ok    integrity         quick_check ok
ok    schema            version 3
ok    users             3 accounts, 1 active administrator
ok    contents          3 sensors, 1 channel, 3 enabled
ok    daemon            running on 127.0.0.1:8080, version 0.1.0, up 4h12m
ok    icmp              an ICMP socket can be opened

0 warnings, 0 failures
```

Run it as the user the daemon actually runs as — `-u 500:500`, or whatever `PUID` is set
to. `docker exec` starts a new process as the image's user, which is root, and several
checks answer questions about the user running them; as root, `data dir` reports that root
can write, which says nothing about whether the daemon can. Run as root and the line says
so instead: `ok data dir /data (writable as root; the daemon runs as uid 500)`.

| Flag | Default | Meaning |
|---|---|---|
| `-config PATH` | — | YAML configuration file |
| `-data DIR` | `/data` | Directory holding the database |
| `-listen ADDR` | from configuration | Address the daemon should be answering on |
| `-timeout DUR` | `10s` | How long the whole run may take |

`-timeout` bounds the entire run, `integrity` above all: `quick_check` reads the
whole file, and a large database takes a while. If it does not finish in time that
is a warning, not a failure — a big database is not a broken one.

A fresh installation is not a failure either. It warns about `database` (not
created yet), `password` (not set yet) and `daemon` (nothing listening), and exits
`0`, because all three resolve themselves on the first start. Only `fail` means
the daemon cannot do its job.

Under `docker exec` the daemon is normally running, so `daemon` is `ok`. The
warning appears when the process inside the container has died — which is exactly
when it is worth knowing.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Anything else — with the reason on stderr, prefixed `weatherglass:` |

There is no distinction between "your flags are wrong" and "the port is taken"
in the exit code, because nothing scripts on that difference. The message is the
interface.

`doctor` is the one exception to the wording: it writes its report to stdout and
exits `1` when it found a `fail`, without a second line on stderr repeating the
summary it has already printed. Warnings alone still exit `0`, so `doctor` can be
used as a health gate in a script.
