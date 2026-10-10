---
title: Try it with demo data
sidebar_label: Demo data
description: Fill a throwaway database with five sensors and a synthetic week of history to evaluate the dashboard without configuring anything.
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
  src="https://j000k3r.github.io/weatherglass-website/demo.html"
  title="The Weatherglass dashboard, running on demo data"
  loading="lazy"
  style={{width: '100%', height: '640px', border: '1px solid var(--ifm-color-emphasis-300)', borderRadius: '8px'}}
></iframe>

:::tip It will not fit on a phone
The dashboard is a wall-display interface; below about 900px of width it is
cramped. If the frame above is too narrow, [open the demo in its own
tab](https://j000k3r.github.io/weatherglass-website/demo.html) instead.
:::

## 🌱 Or grow a real one locally {#or-grow-a-real-one-locally}

The demo above has no history of its own — it is drawn from a fixed set of
numbers. To get an actual week in a database you can poke at, in a volume you
can throw away:

```bash
docker volume create weatherglass-demo

docker run --rm -v weatherglass-demo:/data \
  j000k3r/weatherglass:latest seed --demo --days 7

docker run -d --name weatherglass-demo -p 8080:8080 \
  -v weatherglass-demo:/data --cap-add NET_RAW \
  j000k3r/weatherglass:latest
```

Open [http://localhost:8080](http://localhost:8080) and create the administrator
account — the seeded database deliberately has none, so the first-run setup path
is exercised too.

## What the demo set contains

Five sensors that between them cover all four types:

| Sensor | Type | What it exercises |
|---|---|---|
| Example website | `http` | `expected_status` as a range, certificate warning |
| Public resolver | `dns` | A record lookup by hostname |
| Gateway ping | `ping` | Three echo requests per probe |
| Resolver port | `tcp` | A plain connection to `host:port` |
| Example website TLS | `tcp` | TLS handshake with a `server_name` override |

They are spread over two groups — Internet and Network — and carry tags, so the
grouping and the search box have something to work with.

The synthetic week is written at five-minute spacing: plausible latencies with a
slow hourly drift, so the min/max band on the charts is not a flat line, and six
outages between 3 and 26 minutes long — enough that the uptime percentages differ
between the 24-hour, 7-day, and 30-day columns, and enough that the Incidents tab
has a real history rather than one row.

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
  alt="The Example data panel: a sentence saying the sensors the dashboard started with are examples, a line reading five example sensors, 10080 stored probes and 7 incidents, and a red Remove all example data button."
  width="1600"
/>

Their history goes with them, and the button asks before it does anything. Sensors
you created yourself are never touched, whatever they are called — only the ones
that came from the setup or from `seed --demo` are marked. See
[Sample data](/configuration/dashboard#sample-data).
