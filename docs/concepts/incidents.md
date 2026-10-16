---
title: Incidents
sidebar_label: Incidents
description: The state machine behind a sensor, how outages open and close, and what happens across a restart.
---

# Incidents

An **incident** is one outage: a start time, an end time, and the message from
the probe that opened it. A sensor that starts failing opens an incident; a sensor
that recovers closes it. The Incidents tab is the list, newest first.

The dashboard shows you what is broken *now*. The incident log is what lets you
answer "is this happening more often than it used to?" — which is usually the
question that matters a week later.

<img
  src="/img/incidents.png"
  alt="The Incidents tab: a filter line with an All / Open / Resolved control, a sensor dropdown, period chips and a text field, and below it one row per outage with its start time, duration, the sensor's name and the message the probe returned."
  width="1600"
/>

## 🔎 Narrowing the list {#filtering}

Four controls across the top, and they combine:

| Control | What it does |
|---|---|
| **All / Open / Resolved** | which of the two states to show. Open is what is failing right now |
| **Sensor** | one sensor's outages, out of the whole installation. Defaults to *All sensors* |
| **Period** | outages that *started* in the last 24 hours, 7 days, 30 days or 90 days — or *All time* |
| **Text** | matches the message, the sensor's name and any acknowledgement note |

A **reset** button appears as soon as anything is filtered and puts the whole list
back in one press. It is worth knowing what the empty list means, because the two
readings are different: "no incidents" on an installation that has none is good
news, and "no incidents" under a filter that matches nothing is a setting. The page
says which one it is rather than leaving you to work it out.

The same four filters are on `GET /api/incidents` as `state`, `sensor`, `range` (or
`since`) and `q` — see the [API reference](/reference/api#history).

## 🔁 The state machine {#the-state-machine}

Every sensor runs one small state machine:

```
unknown --first success-------> up
unknown --first failure-------> warn   no incident, no alert
up      --first failure-------> warn   no incident, no alert
warn    --(N-1) more fails----> down   opens an incident, sends "down"
warn    --success-------------> up
down    --success-------------> up     closes the incident, sends "up"
down    --every reminder_every->        sends "reminder", stays down
```

Two details are deliberate:

**Below the threshold, the status is Flaky, not Down.** With `retries: 3`,
a sensor that has failed once is not down — and calling it up would be a lie.
**Flaky** is the honest third answer, it is visible on the dashboard as a yellow
pill rather than hidden, and it is the state that makes a flapping sensor
noticeable before it becomes an outage. It deliberately opens no incident and sends
no alert: the incident log is for outages, and a message per dropped packet would
be noise. A sensor that recovers from Flaky closes nothing, because nothing was
opened.

**Reminders only fire while an incident stays open**, at most once every
`reminder_every` seconds. They are a nudge, not a paging loop; setting
`reminder_every: 0` disables them entirely, which is the right choice for
anything noisy.

## What the alerts say

| Transition | Alert | Contains |
|---|---|---|
| Up → Down | `down` | The probe's own message — `HTTP 503 Service Unavailable` |
| Still down | `reminder` | The same, plus how long the outage has lasted |
| Down → Up | `up` | How long the sensor was down, computed from the incident start |

The recovery alert names the real outage length. It is read from the incident's
start time *before* the sensor's status timestamp is moved on to the recovery
time — a detail that is easy to get wrong, and which produces the memorable
"was down for 0s" message when you do. There is a regression test for it.

## 💤 Pausing, and acknowledging {#pausing-and-acknowledging}

These are two different things, and keeping them apart is the point.

**Pausing** a sensor stops watching it. No probes, no history, no alerts. It is
what you want for a device you have taken out of service, or one you will not
get around to for a month. The card says *Paused* and nothing is expected of it.

**Acknowledging** an incident stops the noise and changes nothing else. The
sensor is still probed, the history still fills, and the incident is still
there. It is what you want when you already know about the outage and do not
need to be told again — you are rebooting the NAS at eleven at night and do not
want a reminder every hour until you are finished.

Acknowledgement hangs off the **incident**, not the sensor, and it carries a
note. That is deliberate: "which outage did I silence?" has an answer, and a
sensor that fails again next week has not been silently excused by something you
acknowledged a month ago.

What it does and does not do:

| | Effect of acknowledging |
|---|---|
| The next reminder | suppressed |
| The first `down` alert | **not** suppressed — it fires on the transition, before anyone can acknowledge |
| The recovery alert | **not** suppressed — "it is back" is useful to the person who acknowledged it too |
| Probing and history | unchanged |
| The incident log | unchanged, and marked as acknowledged |

Taking the acknowledgement back starts the reminders again immediately, rather
than waiting out the rest of the interval. A paused sensor cannot be
acknowledged at all — it has no open incident to acknowledge — which is what
keeps the two concepts visibly separate in the interface.

From the API: `POST /api/incidents/{id}/ack` with a `note`, `DELETE` on the same
path to take it back, and `POST /api/sensors/{id}/ack` as a shortcut for
whatever that sensor currently has open. That last one answers **409** when
nothing is down, rather than quietly doing nothing.

:::info Maintenance windows are a different feature
Acknowledging is per-outage and manual: somebody decides, each time, that this
particular outage does not need chasing. A [maintenance
window](/configuration/maintenance) is decided in advance and applies to every
outage that falls inside it — no incident is opened and no alert is sent at all.
:::

:::tip An outage that a window closed
If a window begins while an outage is open, the outage is closed with a note saying
so. That is not a recovery — if the box stays away, a new outage opens once it has
failed its way past the retries again, dated from after the window.
:::

## Restarts

Runtime state is rebuilt from the database on start: the current status, the
length of the running failure streak, and any incident that is still open. A
container restart therefore:

- **does not lose an outage.** A sensor that was down when the process stopped is
  still down afterwards, with the same start time.
- **does not re-announce one.** An already-open incident does not send a second
  "down" alert just because the process restarted. Nobody needs a notification
  every time you upgrade a container.

There is a third case: ProbeGlass was switched off when the service went down.
On start, if the trailing failures reach the retry threshold and no incident is
open, one is reconstructed from the stored results, with the start time taken
from the first failure in the streak. The outage appears in the log with the
cause *reconstructed after restart*, rather than being silently swallowed. It
does not send an alert — the outage is old news by then, and you are looking at
the dashboard anyway.

## Manual probes

**Run now** — and `POST /api/sensors/{id}/probe` — executes the sensor once and
stores the result, but deliberately bypasses the state machine entirely. A manual
probe never opens an incident and never sends an alert.

The reasoning: you press Run now precisely when you are already looking at the
dashboard and already know something is wrong. Firing an alert at the person who
just clicked the button is noise.

## Retention

Incidents are kept forever, like the daily rollups. A single incident row is a
few dozen bytes, and the whole point of keeping it is to be able to look at last
year.

Deleting a sensor deletes its incidents and its probe results — the foreign keys
cascade. The reverse is not true: deleting an incident is not something the UI
offers, because the log is the record.
