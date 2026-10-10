---
title: Your first sensor
sidebar_label: Your first sensor
description: Create a sensor, read the dashboard, and understand what the status colours mean.
---

# Your first sensor

A sensor is a name, a type, a target, an interval, and a handful of options that
depend on the type. That is the whole model, and it is the same whether you add
one in the web UI or declare it in YAML.

## Create one in the UI

Click **New sensor** in the top bar and fill in four fields:

<img
  src="/img/sensor-form.png"
  alt="The sensor form: name, type, URL, interval, timeout and retries, then a fold-out section of type options. A small question mark sits beside every label, and the one beside Expected status is open, showing a sentence about which status codes count as healthy and the example 200-299."
  width="1600"
/>

*Every field has a `?` beside its label. It opens one sentence about what the
field is for and one example value — no paragraph of prose sitting under the
form.*

| Field | What to put there |
|---|---|
| Name | Anything you will recognise at 3 a.m. — `Router`, `Nextcloud`, `DNS` |
| Type | `http`, `tcp`, `tls`, `ping`, `dns`, `docker`, or `snmp` |
| Target | A URL for `http`, `host:port` for `tcp`, a host or IP for `ping`/`dns` |
| Interval | Seconds between probes. 60 is a good default; 30 for things you care about |

Everything else has a working default, and in the **simple** interface mode the
rest is out of the way altogether. Two that are worth knowing about on day one:

- **Retries** — how many *consecutive* failures before an incident opens and an
  alert fires. The default tolerates a single blip; raise it for flaky targets.
- **Group** — a free-text label. Sensors in the same group are drawn together and
  can be collapsed, which is how a dashboard with forty sensors stays readable.
- **Site** — the place the sensor physically is: the rack in the cellar, the VPS
  at a hoster. Optional, and worth setting for anything that is not on your own
  network, because it is what the tree folds by and what the map draws. The list
  is managed under **Settings → Monitoring → Sites** — see
  [Dashboard settings](/configuration/dashboard#sites) — but you do not have to go
  there to use it: the picker's last entry is **New site…**, and choosing it brings
  up a name and a kind so the place is made along with the sensor. Making a sensor
  is usually the moment you first know where it stands, and leaving a half-filled
  form to go and declare the place is how the form gets abandoned.

**Run now** executes the sensor once, immediately, and shows you the result
without waiting for the next tick. It never opens an incident and never sends an
alert — a manual probe is informational.

The **Test** button in the sensor form validates the draft *and* runs it once, and
shows you the latency, the status code, and the message a real probe produced —
without saving anything. If the target is not `host:port` for a TCP sensor, or the
URL has no scheme for an HTTP sensor, you find out there rather than after saving.
Either way the answer arrives in two places at once: a message over the form and a
line in the footer beside the buttons. The line stays until the next press, and the
message takes itself away after a few seconds — a result written in only one of
them is a result that gets missed, and a refused draft that says nothing reads
exactly like a button that does not work.

## Read the dashboard

Each sensor gets a card:

```
┌──────────────────────────────────────────────────┐
│ ● Up   Nextcloud                       ↑ ↓ ⟳ ⏸ ✎ │
│   https://cloud.example.org/status.php           │
│   HTTPS 200 in 142 ms                            │
│   ▁▂▁▃▂▁▁▂▁▁▂▁▃▂▁▁▂▁▁▂▁▁▁▂▁▁▂▁▁▁▁▁▂▁▁▁             │
│   24h 100%  7d 99.98%  30d 99.94%  Ø 138 ms      │
│   probed 12 seconds ago                        │
└──────────────────────────────────────────────────┘
```

- **The status pill** says Up, Down, Unknown, or Paused. Green means the last
  probe succeeded, red means the sensor has failed its retry threshold and an
  incident is open.
- **The sparkline** is recent response time. It is drawn from raw samples, and a
  gap in it means Weatherglass did not probe — not that the probe failed.
- **The three percentages** are uptime over 24 hours, 7 days, and 30 days,
  computed from the rollups, so they stay cheap to ask even on a long history.
- **`Ø`** is the average latency over the same window.
- **The buttons** reorder the sensor, run it now, pause or resume it, and open the
  editor. Sensors that come from the configuration file are marked *managed* and
  those buttons are disabled, because the file wins.

Click a card to open the detail view: the range selector (1 hour, 24 hours, 7,
30, and 90 days), uptime percentage, average latency, incident count and total
downtime for the selected range, a response-time chart, an uptime strip, and a
table of the last 40 individual probe results with their messages. If an
incident is open, a red banner at the top says since when and for how long.

<img
  src="/img/detail.png"
  alt="One sensor's detail view: a range selector on 24 hours, uptime 99.3% and average 163 ms, a response-time chart with a shaded band, a thirty-day uptime strip with one red segment, and a table of recent probes."
  width="1600"
/>

*The shaded band behind the line is the spread between the fastest and the
slowest probe in each bucket — a flat line and a wide band mean very different
things, and the line alone would hide the difference.*

### Five ways to look at the same thing {#five-views}

The switcher in the top bar changes how the dashboard is drawn. It is one setting
and it follows your account, so the wall display on the kitchen tablet can be a
wall while your laptop stays on cards.

- **Cards** and **list** are the two above. Cards when you are watching, list when
  you are scanning.
- **Tree** folds by site, then by group. A closed branch still shows the worst
  status inside it, so a folded dashboard is not a blind one.
- **Wall** is a tile per sensor with a **heartbeat** — one small rectangle for each
  of the last forty checks, green or red. It answers "has this been flapping?"
  faster than any chart.
- **Map** draws the sites that have coordinates, and tells you which ones it
  cannot draw. If the tile server is unreachable the markers stay exactly where
  they belong and only the background is missing.

The full description, including the map's tile source and what it sees, is in
[Dashboard settings](/configuration/dashboard#views).

## The other three tabs

- **Incidents** — every outage, newest first, with its duration and cause, with
  a filter for still-open ones. This is the tab you open the morning after
  something went bump in the night.
- **Alerts** — the notification channels. Nothing is sent until you add one and
  attach it to a sensor; see [Alerts](/concepts/alerts).
- **Settings** — your appearance and language, the sample-data button, the user
  list, your password and second factor, and the API key.

## Add an HTTP sensor that actually verifies something

A bare `200 OK` sensor tells you the web server is answering. It does not tell
you the application behind it works. Two options make a sensor mean more:

```yaml
- name: Nextcloud
  type: http
  target: https://cloud.example.org/status.php
  interval: 60s
  timeout: 10s
  options:
    expected_status: 200
    body_contains: '"installed":true'
  channels: [telegram]
```

`expected_status` accepts a single code (`200`) or a range (`200-299`).
`body_contains` fails the sensor if the body does not contain the string, which
catches the classic "reverse proxy is up, backend is not" failure — the proxy
returns a 200 with an error page.

For an HTTPS target, `cert_warn_days` makes the sensor fail (or warn) when the
certificate is within that many days of expiry, which turns certificate expiry
from a surprise into a scheduled task.

## Next steps

- [All sensor types and their options](/concepts/sensors)
- [Set up an alert channel](/concepts/alerts)
- [How history is stored](/concepts/history)
