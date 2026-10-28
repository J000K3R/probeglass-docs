---
title: The public status page
sidebar_label: Public status page
description: A read-only page for the people who use your services, on its own link, with only the sensors you publish.
---

# The public status page

ProbeGlass has a second interface for the people who *use* your homelab rather
than operate it: a single page at `/status/<token>` with the state of the
services you choose to publish.

It needs no account, so the link is the credential. Treat it like one.

## Turning it on

**Settings → Monitoring → Public status page → Generate link.** The panel shows
the shareable URL and four buttons:

- **Copy link** — the whole URL, ready to paste into a chat or a wiki.
- **Open** — the page as an outsider sees it, in a new tab.
- **New link** — replaces the token. Every copy of the old URL stops working at
  once, and the new one starts working. Use it when a link has gone further than
  you meant.
- **Switch off** — removes the token. The URL answers `404` until a new link is
  generated.

The selection is kept while the page is off, so turning it back on restores the
page you configured.

## Building the page

Below the link, the panel is the page: title, subtitle, theme, accent colour,
layout and the switches for what each service shows. Everything is saved together
with **Save page**, and the page follows at its next load.

- **Theme** — system, light or dark.
- **Layout** — a **list** (a table with the columns you enabled), **cards** (one
  card per service, with its logo and heartbeat) or **compact** (one line each).
- **Accent colour** — azure, violet, emerald, amber, rose or slate. It colours the
  rule under the title and the section headings.
- **What the page shows** — each uptime window can be shown or hidden, and so can
  the last check, the heartbeat, the logos, the incidents and their causes. A
  page with only names and states is a valid page.

### Sections

The services are grouped into **sections** you name yourself — Internet, Media,
Homelab, whatever the people reading the page understand. Each section has its
own heading, an accent colour for that heading, and its own list of sensors.

**Add section**, type a heading, then press **Sensors**. The dialog lists every
sensor by its group with a filter line; tick what belongs in the section. A sensor
can only be in one section. The arrows move a section up or down, and **Save
page** writes the whole arrangement at once.

A section with nothing in it is not drawn. A sensor that is deleted drops out of
every section without any further action.

A published page contains, according to the switches:

- the service's **name** and its current state — operational, degraded, down,
  paused;
- its **uptime** for 24 hours, 7 days and 30 days;
- when it was **last checked**;
- the **heartbeat**: the last thirty probes as a strip of ticks, so a reader sees
  how the last hour has gone without a chart;
- the service's **logo**, when the sensor has one. The built-in drawings and brand
  marks are static files; an uploaded image is served through the page's own token
  and only while a sensor on the page wears it;
- recent **incidents** for the chosen window (7, 30 or 90 days), with the times and
  — only if you turn this on — the probe's own message.

It never contains the sensor's **target**, its options, its credentials, its
channels, or any other sensor. There is no login box and no link back into the
dashboard, so a reader with the URL can see the status and nothing else.

A sensor that sits behind another one is still drawn on its own. Publication is
about what the page says, not about how the probes are arranged.

## The words on the page

The page is server-rendered HTML with no JavaScript, so it loads on anything and
there is nothing for a shared link to reach. It follows the browser's
`Accept-Language`: a German browser gets the German page, everybody else gets
English. Nothing about the language is stored.

It refreshes itself once a minute with a `<meta http-equiv="refresh">`, which is
the one thing a page without scripts can do.

## Incidents and the probe's message

The **Show the probe's message on an incident** switch is off by default. A probe
message is written for the operator — *"HTTP 502 Bad Gateway"* is harmless, but a
message built from a body check can quote content you did not mean to publish.
With the switch off, the page says when an incident started, whether it is still
running, and how long it lasted, and nothing about why.

## The shapes it can take

The same page in its three layouts:

- **List** — the table, with a column for each window you enabled.
- **Cards** — a grid of cards, each with the logo, the state, the figures you
  chose and the heartbeat.
- **Compact** — one line per service: logo, name, state, 24-hour figure and
  heartbeat. Useful for a page with thirty services on a phone.

## What protects it

- The token is 24 random bytes in base64url — 32 characters, the same kind the
  Prometheus endpoint uses — and only its holder can read the page.
- A wrong token and a page that is switched off answer the same `404`, so an
  outsider cannot tell a stale link from an installation that has none.
- The page sends `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy:
  no-referrer`, and its CSP allows inline styles and images from this server and
  nothing else: no script, no font, no frame. The only images are the symbols.
- The token is not written to the request log; the log shows `/status/…`.
- The page is read-only in the only sense that matters: there is no route on it
  that changes anything, no session cookie is read, and its data comes from the
  same tables the dashboard uses.

## API

`GET /api/status-page` returns `{"enabled":…,"token":"…","config":{…}}`; `PUT`
with `{"config":{…}}` replaces the page. Omitted switches keep their defaults; an
explicit `false` turns one off. An unknown theme, accent or layout falls back to
the default, and a sensor can appear in only one section.

`GET /status/{token}` is the page and `GET /status/{token}/icon/{id}` is an
uploaded symbol of a published sensor, both reachable without a session.

## Limits

- **Sections are a list, not a rule.** A sensor added to a dashboard group later
  does not appear in a status section by itself. That is on purpose — a new
  sensor should not appear on a public page because somebody filed it under the
  wrong heading.
- **No history beyond the incident list.** The uptime figures are the three
  standard windows; the dashboard is where the charts are.
- **One page per installation.** There is no second public page for a second
  audience.
