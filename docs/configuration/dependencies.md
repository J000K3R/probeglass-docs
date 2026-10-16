---
title: Dependencies between sensors
sidebar_label: Dependencies
description: Mark the router as the parent of everything behind it, so one power cut is one outage instead of thirty.
---

# Dependencies between sensors

A homelab does not fail one thing at a time. When the router goes, the NAS, the switch,
the Pi and the seven services on it all go at once — and a watchdog that reports thirty
outages for one power cut is a watchdog you stop reading.

A sensor can name another as the one it **sits behind**. While that parent is down, the
sensor is **excused**:

- it opens no incident of its own and sends no alert;
- the checks it fails in that time do not count against its uptime;
- **it is still checked, and the result is still recorded.**

The last point is the same bargain as a [maintenance
window](/configuration/maintenance): a machine that comes back before its parent still
shows up in its chart as having come back. What is suppressed is the claim that somebody
needs to do something.

## Setting it up

In the sensor editor there is a **Depends on** field, listing the other sensors. Leave
it empty and the sensor stands on its own.

In the configuration file it is one line per sensor:

```yaml
sensors:
  - name: Router
    type: ping
    target: 192.168.1.1
    interval: 30s

  - name: NAS
    type: http
    target: http://nas.lan/health
    depends_on: Router
```

The name is the link, so renaming the parent carries it along. **The file may declare
them in any order** — a sensor whose parent is written further down still ends up
pointed at it, because the file is applied in two passes.

## Chains

A sensor may sit behind a sensor that sits behind another: the router, then the switch,
then the things on the switch. The whole chain is walked, so a router that goes down
excuses everything under it however deep.

```
Router  ──  Switch  ──  Pi
   │           │         │
 down       excused   excused
```

Circles — A depending on B depending on A — are refused when the sensor is saved, with
a message naming the sensor that closes the loop. So is a parent that does not exist.

## What is not a reason

**A flaky parent excuses nothing.** Only a *confirmed* outage counts — a sensor has to
fail past its retries before it is called down. One lost ping on the router will not
quietly stop thirty sensors from alerting, which is the failure mode this could have
had.

**A paused parent excuses nothing either.** A paused sensor is not being checked, so
nothing is known about what is behind it, and its children are judged on their own
probes.

## When the parent comes back

The child has to earn its own outage again. Whatever failed while the parent was down
is not evidence about now, so the sensor starts its retry count over — and if it is
still failing, a new incident opens once it has failed past the retries, **dated from
after the parent recovered**, not from before it.

That is the same rule a maintenance window follows, and deliberately so: being excused
explains the failures while it lasts and nothing after it.

## What the dashboard shows

The status stays whatever the probe found. A sensor behind a down router is **red**,
because it really is not answering — what the badge beside it says is that this is a
consequence rather than a fault of its own.

<img
  src="/img/dependencies-cards.png"
  alt="The Rented server group on the dashboard: a paused ping, an SSH check that is down and holds the one ongoing incident, and a web check behind it that is down with a blue Dependent badge and a blue ring around its card."
  width="1600"
/>

The group above shows it as it looks in the example data: the rented server is away,
so its SSH check is **Down** and holds the incident — and the web check behind it is
**Down** with the **Dependent** badge, and no incident of its own.

Blue rather than the violet of a maintenance window: the two say different things — "I
arranged this" and "this happened to me" — and a dashboard where they looked the same
would lose the distinction this feature exists to draw.

## See also

- [Maintenance windows](/configuration/maintenance) — the same silence, for downtime
  you planned
- [Incidents](/concepts/incidents) — what opens an incident and what does not
- [History and uptime](/concepts/history) — what the figures mean once an excused
  period has been taken out of them
