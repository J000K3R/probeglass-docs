---
title: History and uptime
sidebar_label: History and uptime
description: How probe results are stored, why there are three resolutions, and how uptime percentages stay honest over a year.
---

# History and uptime

Weatherglass keeps every probe result, but not forever and not at full
resolution. Storage is arranged in three tiers so that "what is the uptime over
the last year?" is a cheap question with an honest answer.

| Tier | Table | Resolution | Kept for |
|---|---|---|---|
| Raw | `results` | every probe | `retention.raw`, default **7 days** |
| Hourly | `results_hourly` | one row per hour | `retention.hourly`, default **90 days** |
| Daily | `results_daily` | one row per day | forever |

Each rollup row stores the sample count, the number of successful samples, and
the latency sum, minimum, and maximum for its bucket. That is enough to compute
an uptime percentage and an average, a minimum, and a maximum latency without
keeping every individual probe.

For a homelab-sized install this is a few MB per year per sensor. A week of raw
samples for forty sensors at one-minute intervals is roughly 400 000 rows; the
daily rollups that replace them after a year are 14 600.

## 🔢 Three resolutions, one answer {#three-resolutions-one-answer}

A range query reads from **exactly one** tier:

- a window inside the raw retention window reads `results`
- a window inside the hourly retention window reads `results_hourly`
- anything longer reads `results_daily`

This is the property that keeps the numbers honest. If two tiers could both
contribute to one chart, the samples inside their overlap would be counted twice
and uptime would drift quietly above 100%. The test suite pins this down with a
test that probes exactly this case, because the failure mode is a plausible-looking
number rather than an error.

## 🕳️ Gaps stay gaps {#gaps-stay-gaps}

A bucket with no samples is returned as empty, not as a zero. On a chart it is
drawn as a gap; in the uptime calculation it is excluded from the denominator.

"We did not probe" and "the probe failed" are different facts, and a monitoring
tool that conflates them is worse than useless: it reports an outage that never
happened, and — worse — dilutes the outages that did. If you stop Weatherglass
for a week and start it again, you see a one-week gap, not a week of downtime.

The same applies to the current hour and the current day: they are never rolled
up half-finished. Only complete buckets are summarised.

## ♻️ Rollups are idempotent and re-runnable {#rollups-are-idempotent-and-re-runnable}

The rollup statements are `INSERT ... ON CONFLICT DO UPDATE SET ...`, so running
a rollup pass twice rewrites the same bucket rather than accumulating it. The
maintenance pass runs every five minutes and on every start, which means:

- A container that was stopped for a month catches up on the next start.
- A crash during a rollup cannot double-count, because the next pass overwrites.
- Nothing has to be scheduled at exactly the top of the hour.

Raw pruning deletes rows older than the raw window. The rollups those rows fed
stay.

## 🕰️ Timestamps {#timestamps}

Every timestamp is a fixed-width UTC string, written as
`2006-01-02T15:04:05.000000000Z`. Since every range query is a lexicographic
`BETWEEN` on `ts`, the format is a correctness requirement rather than a style
choice.

The practical consequence for anyone writing SQL against the database: compare
against strings in that exact shape, and let the fixed width do the work.

<details>
<summary>Why not <code>RFC3339Nano</code>, and how the buckets are cut</summary>

`RFC3339Nano` drops trailing zeros, so `…:00.5Z` sorts *before* `…:00Z` — the
string ordering stops matching the time ordering, which is exactly the ordering
every range query depends on. There is a test asserting that the RFC3339Nano
form sorts wrong, so this cannot be changed by accident.

Buckets are derived the same way, from the timestamp prefix: an hourly bucket is
`substr(ts,1,13) || ':00:00.000000000Z'`, a daily one `substr(ts,1,10)`. No
boundary arithmetic, no timezone surprises, and the rollups stay expressible in
plain SQL.

</details>

## 🔌 Reading it from outside {#reading-it-from-outside}

Three endpoints cover history:

| Endpoint | Returns |
|---|---|
| `GET /api/sensors/{id}/results?limit=N` | The most recent raw samples |
| `GET /api/sensors/{id}/series?range=24h` | Downsampled points for a chart |
| `GET /api/sensors/{id}/uptime?range=30d` | Uptime percentage, latency statistics, incident count and downtime |

Valid ranges are `1h`, `24h`, `7d`, `30d`, `90d`, `1y`, and `all`. The chart
selector in the UI offers the first five; the API accepts all of them, which is
how you get a year of uptime into a script. See the [HTTP API](/reference/api).
