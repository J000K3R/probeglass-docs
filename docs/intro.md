---
slug: /
title: Weatherglass
sidebar_label: Introduction
sidebar_position: 1
description: A small, self-hosted watchdog for your homelab — one binary, one SQLite file, a few megabytes of RAM.
---

# Weatherglass

**Weatherglass** is a single-container monitoring daemon: it probes your
services on a schedule, keeps their history, draws the graphs, and tells you
when something breaks. It is built to stay out of the way — one binary, one
SQLite file, a few megabytes of RAM — while still answering the questions you
actually ask during an outage: *what is down, since when, and how often has it
happened?*

<img
  src="/img/dashboard.png"
  alt="The Weatherglass dashboard: a summary strip with a status donut and uptime, latency and probe counts, then sensor cards grouped by category, each with a status dot, the last result, and a response-time sparkline."
  width="1600"
/>

*The dashboard after a week of data. Every card is one sensor; a failing sensor
sorts to the top of its group.*

```bash
docker run -d --name weatherglass --restart unless-stopped \
  -p 8080:8080 -v weatherglass-data:/data --cap-add NET_RAW \
  ghcr.io/j000k3r/weatherglass:dev
```

Open [http://localhost:8080](http://localhost:8080), create the administrator
account, then choose whether you want the simple or the advanced interface. Four
example sensors are created for you — with a week of invented history behind them, so
the sparklines, the uptime bars and the 24h/7d/30d columns are populated, and a red
stretch in the chart shows what an outage looks like — and a guided tour offers to walk
you through them.

<img
  src="/img/tour.png"
  alt="The guided tour on the dashboard: a card reading 4 / 18, Status and name, explaining that the coloured dot is the state from the last probe, with a highlight ring around one sensor card's name."
  width="1600"
/>

*The tour names the parts of one sensor and says plainly that the data is
invented. When you are done with it, **Settings → Monitoring → Example data** removes the whole
invented set in one click.*

:::tip Try it before you install it
There is a [clickable demo](https://j000k3r.github.io/weatherglass-website/demo/)
of the whole dashboard running in your browser on invented data — no container,
no account, nothing stored. It is not a copy of the interface: it is the same
files this container serves, answering from a set of recorded replies, which is
why the map, the widgets and the guided tour are all there.
:::

:::warning A hobby project, vibe coded, and nobody is liable for anything
Weatherglass is written by one person in their spare time, who is not a professional
software developer — built for their own homelab and shared on the chance that somebody
else is looking for something similar — in dialogue with an AI coding agent. It is MIT
licensed and comes "as is", without warranty of any kind — including for the case it
exists to catch, a service that was down while the dashboard said it was fine. Do not
make it your only line of defence. **[How it came about, and how it is written today
→](/about)**
:::

## ⚖️ Why another monitor? {#why-another-monitor}

There are other monitoring tools, and this is not an argument against any of
them. There is also no shortage of them. It is simply that most of them are a lot
bigger than a homelab needs, in memory and in moving parts. Weatherglass makes
the opposite bet:

| | Weatherglass | Typical container-based monitor |
|---|---|---|
| Memory at idle | ~3 MB | 200–400 MB |
| Runtime dependencies | none (static binary) | Node.js, a JVM, or a full stack |
| Frontend build | none — plain ES modules, embedded in the binary | npm, a bundler, a CDN |
| Dependencies | pure Go, including SQLite (no CGO) | native modules |
| Cross-compiles to | linux/amd64, arm64, armv7, darwin, windows, freebsd | usually amd64 only |
| Data | one SQLite file you can copy | a database server, or a volume full of JSON |

The whole program is a Go binary with the dashboard baked in via `embed.FS`.
There is no build step between editing a `.js` file and reloading the page, and
building the image needs nothing but the Go toolchain.

## 🧭 What it does {#what-it-does}

- **[Sensors](/concepts/sensors)** — HTTP(S), TCP (with optional TLS and
  send/expect), TLS certificate expiry, ICMP ping, DNS, Docker containers, and
  single-OID SNMP. Configured in the web UI or declared in YAML.
- **[Dashboard](/getting-started/first-sensor)** — live status as cards, a dense
  list, a foldable **tree** by site and group, a **wall** of tiles with the recent
  checks on each one, or on a **map** of your sites. Per-sensor response-time
  charts, uptime bars, an incident timeline. Updates over Server-Sent Events, so
  there is no polling and no page reload.
- **[Sites](/configuration/dashboard#sites)** — the places your sensors are: the
  rack in the cellar, the VPS at a hoster. They group the dashboard and, with
  coordinates, they are drawn on the map. Optional throughout: a sensor without a
  site works exactly as it always did.
- **[History](/concepts/history)** — raw samples for 7 days, hourly rollups for
  90 days, daily rollups forever. Uptime percentages stay correct at every zoom
  level.
- **[Incidents](/concepts/incidents)** — a sensor that starts failing opens an
  incident, a recovery closes it. You see what is broken *now* and what broke
  last Tuesday.
- **[Alerts](/concepts/alerts)** — Telegram, Discord, Matrix, ntfy, Slack, and
  generic webhooks with an HMAC signature. Per-sensor channel selection, per-sensor
  reminder intervals, custom message templates.
- **[Auth](/concepts/security)** — first-run setup with a username and a password,
  bcrypt hashing, session cookies, **accounts with three roles**, an optional
  **second factor** with one-time recovery codes, and an API key for scripts and
  Home Assistant.
- **Config as code** — sensors, sites and channels can be declared in a YAML file,
  so a rebuild from zero takes seconds.

## 🚀 Where to go next {#where-to-go-next}

- New here? Start with **[Installation](/getting-started/install)**.
- Want to see it with data in it before deciding? **[Demo data](/getting-started/demo-data)**
  fills a database with a synthetic week in one command.
- Running it already and something looks wrong? **[Troubleshooting](/operations/troubleshooting)**.
- Writing a script against it? **[HTTP API](/reference/api)**.

## 📌 Project status {#project-status}

Version 0.1.0 — the foundation is in place and works; the feature set is still
growing. The dashboard ships in English. The UI is built on a message catalogue,
so an additional language is a dictionary file and one picker entry, and
translated documentation is a locale directory in this repository.
[German is the first planned addition](/development/roadmap).

Weatherglass is MIT licensed. Source:
[https://github.com/j000k3r/weatherglass](https://github.com/j000k3r/weatherglass).
