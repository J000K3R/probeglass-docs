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

## Choosing what is published

The same panel lists every sensor, grouped by its group, with a filter line
above. Tick the services the page should show and press **Save selection**.

A published page contains:

- the service's **name** and its current state — operational, degraded, down,
  paused;
- its **uptime** for 24 hours, 7 days and 30 days;
- when it was **last checked**;
- recent **incidents**, thirty days back, with the times and — only if you turn
  this on — the probe's own message.

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

## What protects it

- The token is 32 random bytes in base64url, the same kind the Prometheus endpoint
  uses, and only its holder can read the page.
- A wrong token and a page that is switched off answer the same `404`, so an
  outsider cannot tell a stale link from an installation that has none.
- The page sends `X-Robots-Tag: noindex, nofollow` and `Referrer-Policy:
  no-referrer`, and its CSP allows inline styles and nothing else: no script, no
  image, no font, no frame.
- The token is not written to the request log; the log shows `/status/…`.
- The page is read-only in the only sense that matters: there is no route on it
  that changes anything, no session cookie is read, and its data comes from the
  same tables the dashboard uses.

## Limits

- **Only sensors, not groups.** Publishing a group means ticking its sensors; a
  sensor added to the group later is not published automatically. That is on
  purpose — a new sensor should not appear on a public page because somebody
  filed it under the wrong heading.
- **No history beyond the incident list.** The uptime figures are the three
  standard windows; the dashboard is where the charts are.
- **One page per installation.** There is no second public page for a second
  audience.
