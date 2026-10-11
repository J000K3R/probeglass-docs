---
title: FAQ
sidebar_label: FAQ
description: Short answers to the questions that come up most often.
---

# FAQ

## Why not just use one of the other monitoring tools?

If you already run something you are happy with, there is no reason to switch —
this is not an argument against anything else out there. Weatherglass exists for
the case where you want the monitoring to be *smaller than the thing it monitors*:
one binary, one file, about three megabytes of RAM, and a dependency tree you can
read in an afternoon. The [introduction](/#why-another-monitor) has the comparison
in a table.

## Does it need a database server?

No. It uses SQLite, through a pure-Go translation of it, so the binary is static
and cross-compiles to a Raspberry Pi with `CGO_ENABLED=0`. The database is one
file you can copy.

## Can I run it on a Raspberry Pi?

Yes. The image is published for `linux/arm64` and `linux/arm/v7`, and the Go
toolchain cross-compiles to both. The arm64 image is cross-compiled rather than
emulated, so it builds at native speed.

## Why does it not need `NET_RAW` for most things?

Only ICMP ping needs it, and only the raw-socket fallback at that. The ping sensor
tries an unprivileged datagram ICMP socket first, which works on Linux and macOS
without any capability as long as `net.ipv4.ping_group_range` permits the
container's group. If neither socket works, the sensor says exactly which one it
tried and what the kernel replied — the most confusing failure in containerised
monitoring is a ping that silently does nothing.

## How much disk does it use?

Roughly 60 bytes per raw probe result. One sensor every 60 seconds is about 86 KB a
day, 600 KB a week. After the raw retention window (7 days by default) only the
hourly and daily rollups remain, and they are far smaller.

## Can I keep history for longer than 90 days?

Daily rollups are kept forever, so a range of a year or more is already answerable
— it is read from the daily table. `retention.hourly` controls how long the
mid-resolution data survives; `retention.raw` controls the fine detail. See
[History and uptime](/concepts/history).

## Why is a failed probe shown as "Flaky" and not "Down"?

Because at that moment the honest answer is "the last probe failed, and it has not
failed often enough yet to call it down". With `retries: 3`, one failed probe is a
blip. Calling it Down would be a lie, and calling it Up would be a bigger one — it
would hide a sensor that is starting to go. It becomes Down when the failure streak
reaches the threshold, and that is when the incident opens and the alert goes out.

Flaky is a yellow pill and nothing else: no incident, no alert. **Unknown** is the
state a sensor wears before its very first probe, and it is the one that means "we
have never heard from this at all".

## An alert says "was down for 0s". Is that a bug?

It was, and it is fixed. The recovery alert now names the real outage length,
computed from the incident's start time. If you see it again, please
[open an issue](https://github.com/j000k3r/weatherglass/issues) with the
alert text.

## Can I use it for a public status page?

Not yet. A read-only public view on its own path and its own token is on the
[roadmap](/development/roadmap). Today, the dashboard is authenticated, full
stop.

## Can I scrape it from another monitoring stack?

Not directly — there is no `/metrics` endpoint yet, and it is on the roadmap. In
the meantime the JSON API is scrapeable with a small exporter, and the generic
webhook can push every event into whatever you already run.

## Multiple users?

Yes, up to a point. A fresh install creates one administrator; under **Settings →
Users** you add as many more as you like, as **operator** or **viewer**, and any of
them can enrol a second factor. What they all share is the same set of sensors,
the same history and the same incidents — Weatherglass is one homelab, and
**multi-tenancy** is explicitly [out of scope](/development/roadmap#out-of-scope).
Running two containers is the answer to wanting two.

What each role may do is in [Security](/concepts/security#roles).

## Can I import an existing monitoring configuration?

Not with a tool, no. There is no importer yet — it is on the roadmap. The
practical route today is to declare your sensors in a
[YAML file](/configuration/file), which is a better place for them anyway, and
which the file-wins rule will then keep in sync on every start.

## Where is the data, and how do I back it up?

`/data/weatherglass.db` — one SQLite file. Stop the container and copy it. See
[Backup and restore](/operations/backup).

## The dashboard shows a spinner and never loads

There is now a watchdog that replaces the spinner with a real message after
twelve seconds, and a reload button. See
[Troubleshooting](/operations/troubleshooting#the-dashboard-will-not-load).

## Something is wrong inside the container, and there is no shell

Run `docker exec weatherglass weatherglass doctor`. The image is distroless — no
shell, no `curl`, no tools — so that is the one command you have, and it reports the
configuration, the data directory, the database's size, integrity and schema, the
stored sensors and channels, and whether the daemon is answering. It opens the
database read-only and never sends an alert, so it is safe to run on a database you
are worried about. See [Command line](/reference/cli#doctor).

## How do I reset a forgotten password?

Another administrator can do it under **Settings → Access → Users**. If that one account is
the one you have lost, there is no recovery endpoint by design — a "reset the
password" route is a way in for anyone who can reach the port. Delete the rows from
the `users` table of the SQLite file and the setup screen returns on the next
request. See [Installation](/getting-started/install#first-run).

## Can I contribute a translation?

Yes, and it is a small job. The dashboard has no user-facing strings in its markup
— everything goes through a message catalogue — so a new language is one
dictionary file and one entry in the picker list. German is the first planned
addition. See [Contributing](/development/contributing).

## Is there a hosted version?

No. Weatherglass is a homelab tool: you run it, its data stays with you, and there
is nothing to sign up for.

## Who makes this? Is it a company?

No. Weatherglass is a hobby project by somebody who is not a professional software
developer — one person, spare time, written for their own homelab, and shared on the
chance that somebody else finds it useful. There is no company, no support contract
and no warranty — it is MIT licensed and comes "as is", and nobody is liable for anything
it does, including a missed alert. If you are weighing that up, read
[Who makes this, and how](/about) before you decide.
