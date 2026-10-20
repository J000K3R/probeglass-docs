---
title: Metrics for Prometheus
sidebar_label: Metrics
description: A read-only /metrics endpoint, so a monitoring stack that already runs can scrape ProbeGlass instead of repeating its checks.
---

# Metrics for Prometheus

ProbeGlass already makes the checks. `/metrics` hands their answers to a
monitoring stack that is already running — Prometheus, VictoriaMetrics, Grafana
Alloy, or anything else that reads the Prometheus text format — instead of making
that stack repeat them.

The endpoint is off by default and guarded by a credential of its own.

## Turning it on

**Settings → Monitoring → Metrics → Generate token.** The panel shows the token
and a copy button. It is read-only: it opens `/metrics` and no other route, and it
is not the API key from **Settings → Access**.

**Rotate** makes a new token; a scraper still sending the old one starts getting
`401` at its next scrape. **Disable** removes the token, and `/metrics` answers
`404` — an installation that does not use Prometheus does not advertise the
endpoint to anything that finds it.

## Scrape configuration

```yaml
scrape_configs:
  - job_name: probeglass
    scrape_interval: 60s
    authorization:
      credentials: <the token from Settings>
    static_configs:
      - targets: ["probeglass:8080"]
```

`metrics_path` is `/metrics` by default. A scraper that cannot set an
`Authorization` header may send the same token as `X-API-Key` instead. A missing
or wrong token answers `401`; the token is compared in constant time and never
appears in a log line.

If ProbeGlass sits behind a reverse proxy, the proxy has to pass the
`Authorization` header through. The [reverse proxy page](/operations/reverse-proxy)
has the general shape.

## What is exposed

| Metric | Labels | Meaning |
|---|---|---|
| `probeglass_sensor_up` | `sensor`, `group`, `site`, `type` | `1` when the sensor's current state is up, `0` otherwise |
| `probeglass_sensor_status` | `sensor`, `group`, `site`, `type`, `status` | always `1`; the state is the label: `up`, `down`, `warn`, `paused` or `unknown` |
| `probeglass_sensor_uptime_ratio` | `sensor`, `window` | uptime over `24h`, `7d` or `30d`, from `0` to `1` |
| `probeglass_sensor_latency_seconds` | `sensor`, `group`, `site`, `type` | the last probe's latency in seconds |
| `probeglass_sensor_open_incident` | `sensor`, `group`, `site`, `type` | `1` while an incident is open on that sensor |
| `probeglass_incidents_open` | — | incidents open across the installation |
| `probeglass_sensors` | `status` | how many sensors are in each current state |

The uptime ratios are the same arithmetic the dashboard shows: a maintenance
window or a parent that is down does not count against a sensor, because that time
is excused rather than failed.

Two deliberate omissions:

- **The target is not a label.** The labels name the sensor, its group and its
  site, but not the address it probes. The metrics token is likely to live in a
  central scraper outside the LAN, and the numbers are enough to graph without
  also handing that scraper an inventory of the network.
- **There is no sample history.** This is current state and the three uptime
  windows, not the per-probe series. Prometheus keeps the time series; the
  dashboard keeps the history, and `/api/history` is there if a script needs it.

## Example queries

```promql
# Everything that is down right now.
probeglass_sensor_up == 0

# Sensors below 99% over the last day, ignoring ones with no data.
probeglass_sensor_uptime_ratio{window="24h"} > 0 and
probeglass_sensor_uptime_ratio{window="24h"} < 0.99

# Open incidents per site.
sum by (site) (probeglass_sensor_open_incident)
```

An alert that mirrors ProbeGlass's own incidents should use
`probeglass_sensor_open_incident`, not `up`: the first says ProbeGlass has already
decided something is wrong, including its retry and dependency rules; the second
is only the last probe.

## A scrape interval

Sixty seconds is plenty. ProbeGlass's own checks run on their own schedules, and a
faster scrape only copies the same value more often. Use fifteen seconds if the
dashboard needs to see a change almost immediately in the same view.
