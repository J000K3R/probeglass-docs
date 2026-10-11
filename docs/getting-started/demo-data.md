---
title: Try it with demo data
sidebar_label: Demo data
description: Fill a throwaway database with invented sensors and a synthetic week of history to evaluate the dashboard without configuring anything.
---

# Try it with demo data

The fastest way to decide whether Weatherglass is for you is to look at the
dashboard with a week of data in it. One command produces that, in a volume you
can delete afterwards.

## 👀 Look at one right now {#look-at-one-right-now}

Before installing anything, this is the whole dashboard running in your browser
on invented data — click a sensor, follow a chart across the week, acknowledge
the outage. It is the same interface the container serves, with no server behind
it and nothing stored.

<iframe
  src="https://j000k3r.github.io/weatherglass-website/demo/"
  title="The Weatherglass dashboard, running on demo data"
  loading="lazy"
  style={{width: '100%', height: '640px', border: '1px solid var(--ifm-color-emphasis-300)', borderRadius: '8px'}}
></iframe>

:::tip It will not fit on a phone
The dashboard is a wall-display interface; below about 900px of width it is
cramped. If the frame above is too narrow, [open the demo in its own
tab](https://j000k3r.github.io/weatherglass-website/demo/) instead.
:::

## 🌱 Or grow a real one locally {#or-grow-a-real-one-locally}

The demo above is a recording and not an installation: the interface, the map and
the charts are the real ones, answering from a set of replies taken from a real
installation seeded with the data below. Nothing it offers writes anywhere, so a
setting you change there lasts as long as the tab. To get an actual week in a
database you can poke at, in a volume you can throw away:

```bash
docker volume create weatherglass-demo

docker run --rm -v weatherglass-demo:/data \
  ghcr.io/j000k3r/weatherglass:dev seed --demo --days 7

docker run -d --name weatherglass-demo -p 8080:8080 \
  -v weatherglass-demo:/data --cap-add NET_RAW \
  ghcr.io/j000k3r/weatherglass:dev
```

Open [http://localhost:8080](http://localhost:8080) and create the administrator
account — the seeded database deliberately has none, so the first-run setup path
is exercised too.

## What the demo set contains

Thirteen sensors covering all six types, in three groups and at two sites:

| Sensor | Type | What it exercises |
|---|---|---|
| Example website | `http` | `expected_status` as a range, certificate warning |
| Public resolver | `dns` | A record lookup by hostname |
| Internet ping | `ping` | Three echo requests per probe |
| Resolver port | `tcp` | A plain connection to `host:port` |
| Example website TLS | `tls` | Handshake with a `server_name` override |
| Package mirror | `http` | A second public HTTP target, a mirror that redirects |
| DNS over TLS | `tls` | Certificate expiry read out of the reply |
| Router: ping | `ping` | Paused — the homelab's own gateway |
| NAS: SSH | `tcp` | Paused — a NAS, by port |
| NAS: web interface | `http` | Paused — the same NAS, over HTTP |
| Printer: ink level | `snmp` | Paused — an SNMP walk |
| Rented server: SSH | `tcp` | Paused — a machine somewhere else |
| Rented server: web | `http` | Paused — the same machine, over HTTPS |

Seven of them are **enabled**, and every enabled target is a public service.
These are real sensors that the scheduler really probes: the history above them
is a week of green, and a sensor that started failing a minute after it was
seeded would contradict it.

The other six are the homelab's own addresses, and they arrive **paused**.
`192.168.1.10` does not answer on anybody else's network, so they place pins on
the map and fill the wall without claiming anything about a network this
installation cannot see. Turning one on is a click.

The two places, **Homelab** and **Rented server**, carry coordinates. That is what
gives the map its markers; without them the map tab has nothing to draw. They are also
an ocean apart, so the map opens with the world on it and the coastlines showing — which
two places in one country would not give.

The synthetic week is written at five-minute spacing: plausible latencies with a
slow hourly drift, so the min/max band on the charts is not a flat line, and
eleven outages between 3 and 60 minutes long — enough that the uptime percentages
differ between the 24-hour, 7-day, and 30-day columns, and enough that the
Incidents tab has a real history rather than one row.

The generator is **deterministic** — it seeds itself from the sensor ID — so the
same command produces the same dashboard. That makes it usable for screenshots
and for eyeballing a UI change against a known picture.

:::note
The demo set creates no alert channels. A seeded install will therefore never
send you anything, which is the right default for something you are only
looking at. If you want to see what an alert looks like, add a channel under
**Alerts** and use its **Test** button.
:::

## Re-running it

`seed` matches sensors by name, so running it again adds no duplicate sensors. It
does write another week of probe history, offset by however much time has passed
since — so for a clean picture, seed once and then leave it alone.

`seed` refuses to run without `--demo`. It will not guess what to insert into a
database it did not create.

| Flag | Default | Meaning |
|---|---|---|
| `--demo` | required | Create the demo sensors with synthetic history |
| `--days N` | `7` | How many days to synthesise; 1 to 365 |
| `--data DIR` | `/data` | Directory holding the database |
| `--config PATH` | — | YAML configuration file |

## From source

The same thing without Docker:

```bash
make seed     # builds, then fills ./data with the demo set
make run
```

## Clean up

```bash
docker rm -f weatherglass-demo
docker volume rm weatherglass-demo
```

The whole state is the single SQLite file in that volume, so removing it removes
everything.

## Starting over for real

If you seeded into a volume you actually want to keep, the demo sensors are now
in it — and the four that setup created are beside them. Both are marked as **sample
data**, so a single button under **Settings → Monitoring → Example data** removes the whole lot:

<img
  src="/img/example-data.png"
  alt="The Example data panel: a sentence saying the sensors the dashboard started with are examples, a row of counts for example sensors, stored probes and incidents, and a red Remove all example data button."
  width="1492"
/>

Their history goes with them, and the button asks before it does anything. Sensors
you created yourself are never touched, whatever they are called — only the ones
that came from the setup or from `seed --demo` are marked. See
[Sample data](/configuration/dashboard#sample-data).
