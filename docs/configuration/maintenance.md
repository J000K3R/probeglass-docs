---
title: Maintenance windows
sidebar_label: Maintenance windows
description: Tell ProbeGlass in advance that a box is allowed to be away, so a planned outage opens no incident and drags no uptime figure down with it.
---

# Maintenance windows

A homelab has outages you arranged. The NAS is restarted for a firmware update, the
snapshot runs every night at three, the disk gets swapped on a Saturday afternoon.
Without anything else, each of those is an incident, an alert and a red number — for
something you knew about in advance.

A **maintenance window** is a period in which a sensor is expected to be down. Inside
it:

- no incident is opened, and no alert is sent;
- the checks that fail there do not count against the sensor's uptime;
- **the checks keep running, and the results are still recorded.**

That last point is the one that makes the first two trustworthy. A window is not a
pause: the probe still goes out, and a box that comes back early shows up in the
chart as having come back. What a window suppresses is the claim that somebody needs
to do something about it — not the measurement.

## Making one

**Settings → Monitoring → Maintenance windows**, then **New window**. Anything the
installation shows you is read-only if a [configuration
file](/configuration/file) owns it.

| Field | What it is |
|---|---|
| **Applies to** | one sensor, or a whole group — every sensor carrying that group name |
| **Repeats** | *once*, between two times; or *every week*, on chosen days at a chosen time of day |
| **Note** | what it is for. Optional, and the only place you will remember in six months |
| **Active** | the switch. A window that is off silences nothing and stays in the list |

The times of a weekly window are read in **your** time zone, which the form fills in
from the browser when you create it. That is deliberate and it is the only place in
ProbeGlass that a zone other than UTC appears: a container has no idea where its
operator lives, and "Sunday at three" means three on your wall — twice a year and
all.

## What happens at the edges

Three cases are worth knowing about, because each of them has an answer that is not
obvious.

**A window begins while an outage is already open.** The outage is closed, with a
note saying why, and nothing is sent about it — the message that opened it already
went out. Leaving it open would mean the dashboard showing an outage nobody is being
told about, for as long as the window lasts and then some.

**The window ends and the box is still away.** None of what failed inside the window
is evidence about now, so the sensor starts again from the first failure outside it:
it has to use up its retries before it is called down, exactly as it would for any
other outage. The new incident is dated from after the window, not from before it.

**The sensor comes back inside the window.** Nothing is sent. No "down" ever went
out, so an "up" would be a message about a problem you were never told about.

## What the dashboard shows

The sensor's status is whatever the probe found — if it is not answering, the card is
red, because that is true. What the window changes is that the card says the downtime
is **expected** rather than broken, and the uptime figure on it leaves the window's
checks out.

A window that is running right now is marked in the list, which is the thing to check
when a sensor goes quiet and you want to know whether you arranged it.

## Two things it does not do

**A window saves nothing for later.** It starts applying the moment you save it. The
checks already recorded are not rewritten, so a window declared for an outage that
already happened leaves the numbers for that morning as they were. A window is a
statement about the future, and it is honest about being one.

**It is not a pause.** Pausing a sensor stops the checks altogether and the sensor
reads *paused*; a window lets them run and only silences what they would have said. If
you want the probes to stop, [pause the sensor](/configuration/dashboard) instead.

## In the configuration file

The windows are made in the dashboard. A `maintenance:` section in
`probeglass.yaml` is [on the roadmap](/development/roadmap) and not in 0.2.0 — an
installation driven entirely from a file has to add them through the interface for
now.

## See also

- [Incidents](/concepts/incidents) — what a window is not, and how acknowledging one
  differs
- [History and uptime](/concepts/history) — what the figures mean once the window's
  checks have been taken out of them
- [The dashboard](/configuration/dashboard) — pausing a sensor, which is the other
  thing people reach for
