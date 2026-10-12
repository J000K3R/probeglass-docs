---
title: Try it with demo data
sidebar_label: Demo data
description: Fill a throwaway database with invented sensors and a synthetic week of history to evaluate the dashboard without configuring anything.
---

# Try it with demo data

The fastest way to decide whether ProbeGlass is for you is to look at the
dashboard with a week of data in it. One command produces that, in a volume you
can delete afterwards.

## 👀 Look at one right now {#look-at-one-right-now}

Before installing anything, this is the whole dashboard running in your browser
on invented data — click a sensor, follow a chart across the week, acknowledge
the outage. It is the same interface the container serves, with no server behind
it and nothing stored.

<iframe
  src="https://j000k3r.github.io/probeglass-website/demo/"
  title="The ProbeGlass dashboard, running on demo data"
  loading="lazy"
  style={{width: '100%', height: '640px', border: '1px solid var(--ifm-color-emphasis-300)', borderRadius: '8px'}}
></iframe>

:::tip It will not fit on a phone
The dashboard is a wall-display interface; below about 900px of width it is
cramped. If the frame above is too narrow, [open the demo in its own
tab](https://j000k3r.github.io/probeglass-website/demo/) instead.
:::

## 🌱 Or grow a real one locally {#or-grow-a-real-one-locally}

The demo above is a recording and not an installation: the interface, the map and
the charts are the real ones, answering from a set of replies taken from a real
installation seeded with the data below. Nothing it offers writes anywhere, so a
setting you change there lasts as long as the tab. To get an actual week in a
database you can poke at, in a volume you can throw away:

```bash
docker volume create probeglass-demo

docker run --rm -v probeglass-demo:/data \
  ghcr.io/j000k3r/probeglass:0.1.0 seed --demo --days 7

docker run -d --name probeglass-demo -p 8080:8080 \
  -v probeglass-demo:/data --cap-add NET_RAW \
  ghcr.io/j000k3r/probeglass:0.1.0
```

Open [http://localhost:8080](http://localhost:8080) and create the administrator
account — the seeded database deliberately has none, so the first-run setup path
is exercised too.

## What the demo set contains

Thirteen sensors covering all six types, in four groups and at three places:

| Sensor | Type | Place | What it exercises |
|---|---|---|---|
| Example website | `http` | Frankfurt | `expected_status` as a range, certificate warning |
| Public resolver | `dns` | Frankfurt | A record lookup by hostname |
| Internet ping | `ping` | Frankfurt | Three echo requests per probe |
| Resolver port | `tcp` | Frankfurt | A plain connection to `host:port` |
| Example website TLS | `tls` | Frankfurt | Handshake with a `server_name` override |
| Package mirror | `http` | Frankfurt | A second public HTTP target, a mirror that redirects |
| DNS over TLS | `tls` | Frankfurt | Certificate expiry read out of the reply |
| Router: ping | `ping` | Homelab | Paused — the homelab's own gateway |
| NAS: SSH | `tcp` | Homelab | Paused — a NAS, by port |
| NAS: web interface | `http` | Homelab | Paused — the same NAS, over HTTP |
| Printer: ink level | `snmp` | Homelab | Paused — an SNMP walk |
| Rented server: SSH | `tcp` | Rented server | Paused — a machine somewhere else |
| Rented server: web | `http` | Rented server | Enabled, and failing on purpose — the red pin |

Seven of them are **enabled** and reach a public service. These are real sensors
that the scheduler really probes: the history above them is a week of green, and
a sensor that started failing a minute after it was seeded would contradict it.
They all stand on **Frankfurt**.

Four are the homelab's own addresses, and they arrive **paused**.
`192.168.1.10` does not answer on anybody else's network, so they place pins on
the map and fill the wall without claiming anything about a network this
installation cannot see. Turning one on is a click.

The thirteenth is the odd one, and it is there to show what a failure looks
like. **Rented server: web** points at `vps.example.net` — a name in the range
reserved for documentation, so it genuinely does not resolve — and its invented
history ends in a ninety-minute outage that has not finished. Restoring that
history therefore leaves the sensor **down** rather than up, and the map draws
its place red. Nothing is staged: an installation of this running on a real
network will fail that target in exactly the same way.

:::caution It is the one example that acts on its own
Because that sensor is enabled and failing, a real installation will open an
incident for it and — if you have configured an alert channel — send you a
message about it. The example data is one click from gone under
**Settings → Monitoring → Example data**; see
[Starting over for real](#starting-over-for-real) below. If you would rather it
stayed quiet, pause the sensor.
:::

The three places, **Homelab**, **Rented server** and **Frankfurt**, carry
coordinates, and the map colours each pin by the worst sensor standing on it.
That is what gives the map its markers: Frankfurt green, Homelab grey (everything
on it is paused), Rented server red. They are also far apart — Berlin, Virginia
and Frankfurt — so the map opens with the world on it and the coastlines showing,
which three places in one country would not give.

The synthetic week is written at five-minute spacing: plausible latencies with a
slow hourly drift, so the min/max band on the charts is not a flat line, and
eleven outages between 3 and 60 minutes long — enough that the uptime percentages
differ between the 24-hour, 7-day, and 30-day columns, and enough that the
Incidents tab has a real history rather than one row. One more, of ninety minutes,
is the one on Rented server: web that is still running — twelve in all.

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
docker rm -f probeglass-demo
docker volume rm probeglass-demo
```

The whole state is the single SQLite file in that volume, so removing it removes
everything.

## Starting over for real

If you seeded into a volume you actually want to keep, the demo sensors are now
in it — and the four that setup created are beside them, on two of the three
places the demo knows. Both are marked as **sample data**, so a single button under
**Settings → Monitoring → Example data** removes the whole lot, places included:

<img
  src="/img/example-data.png"
  alt="The Example data panel: a sentence saying the sensors the dashboard started with are examples, a row of counts for example sensors, stored probes, incidents and places, and a red Remove all example data button."
  width="1492"
/>

Their history goes with them, and the button asks before it does anything. Sensors
you created yourself are never touched, whatever they are called — only the ones
that came from the setup or from `seed --demo` are marked. See
[Sample data](/configuration/dashboard#sample-data).
