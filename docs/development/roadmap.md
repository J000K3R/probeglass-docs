---
title: Roadmap
sidebar_label: Roadmap
description: What exists, what is next, and what is deliberately out of scope.
---

# Roadmap

Dates are not promises; the ordering is what the design already supports cheaply.
The repository's [docs/ROADMAP.md](https://github.com/j000k3r/probeglass/blob/main/docs/ROADMAP.md)
is the source of truth — this page mirrors it.

## Done — 0.1.0

- HTTP, TCP (with TLS and send/expect), ICMP ping, and DNS sensors, each validated
  before it is saved.
- Dashboard with live status over SSE, response-time charts, uptime bars, sparklines,
  incident timeline, search, grouping, and tags.
- Three-tier history: raw for 7 days, hourly for 90 days, daily forever, with exactly
  one resolution answering any range.
- Incident lifecycle with retries before an incident opens, reminder intervals while
  it stays open, and recovery alerts.
- Six alert channels: Telegram, Discord, Matrix, ntfy, Slack, and signed generic
  webhooks, with custom message templates.
- First-run setup, bcrypt passwords, hardened session cookies, API key, and cross-site
  protection for cookie-authenticated writes.
- Sensors and channels declared in YAML, re-applied on every start.
- Multi-arch container image (amd64, arm64, armv7), CI with race tests, lint, and a
  test suite across store, config, probe engines, notifications and the API. The
  image is the only thing that ships; the cross-compiled archives for darwin,
  windows and freebsd that 0.1.0 also published were removed in 0.2.0 — they
  promised a way to run this that nothing documented.

- `probeglass doctor` — one command that reports what is wrong with an installation
  and changes nothing: the configuration, the data directory, the database's size,
  integrity and schema, whether the stored sensors and channels still validate, and
  whether the daemon is answering. Built for the container, where there is no shell to
  fall back on. It replaces the `probeglass config check` this page used to promise.
  The same report is available from Settings → Diagnostics in the dashboard.
- Every failing request now leaves a log line with its cause. A `5xx` is logged once,
  at `error`, with the message the client was given and the error it was not.
- **Acknowledging an incident** — silence one outage, with a note, without stopping the
  probe or the history. Reminders stop; the first `down` alert and the recovery alert do
  not. Pausing a sensor stays a different thing.
- **A simple and an advanced interface**, chosen during setup and switchable in
  Settings. Simple hides areas and folds fields; it never disables anything.
- **Field help as `?` popovers** instead of paragraphs under the forms.
- **A password strength indicator** at setup and at password change — advisory only;
  the server's minimum stays at eight characters.
- **Four example sensors** on a fresh installation, attached to no channel and carrying
  a week of invented five-minute history — including a closed outage and one sensor
  reading **Flaky** — so the first dashboard is neither an empty grid nor a wall of grey.
- **Accounts with roles.** A fresh installation asks for a username and a password,
  and that first account is an administrator. Everyone else is added under
  Settings → Users as an **operator** or a **viewer**. A viewer reads everything and
  changes nothing; an operator adds acknowledging, running a check on demand and
  pausing a sensor; an administrator adds sensors, channels, the API key and the user
  list. Role changes, disabled accounts and deleted accounts take effect on the next
  request.
- **Two-factor authentication**, per account: a QR code the server draws, six digits,
  thirty seconds, and eight one-time recovery codes shown exactly once. A code that has
  already been used is refused.
- **Settings per account.** Theme, accent, density, layout, language, interface mode and
  tour progress follow the person rather than the installation.
- **One-click removal of the sample data**, which is marked as sample data where it is
  created so that the button can be honest about what it will delete. Example sensors
  carry a badge on their card, and the same panel offers to load them back — with
  invented history — once they are gone.
- **TLS certificate sensors.** A host or `host:port` and nothing else, with the
  certificate as the subject rather than a side effect of an HTTP request. It reports
  the days left and separates the three certificate problems: a name that does not
  match, a certificate that has expired, and a chain this host does not trust.
- **Docker container sensors.** One `GET /containers/{name}/json` over the unix socket
  and nothing else — the probe never starts, stops or changes a container. It checks the
  running state, the `HEALTHCHECK` result where there is one, and the restart count.
- **SNMP sensors.** A single `GET` of a single OID over v2c, checked against a substring
  or a numeric range. Enough for a switch, a router or a NAS, and deliberately not a
  walk, not traps and not v3.
- **A guided tour** of the dashboard, driven by a data list of steps so a new feature
  adds a step rather than a new tour. It zooms into one example sensor and names its
  parts, says out loud that the data on screen is invented, explains the sample-data
  button, and offers to go deeper into sensors, incidents or alerts at the end.
- **Five views of one dashboard.** Cards and list as before, plus a foldable **tree**
  by site and group, a **wall** of tiles carrying the last forty checks as a
  heartbeat, and a **map** of your sites, drawn from coastlines that ship in the
  binary. They are one setting, not
  five pages, and the switcher in the top bar is one click wide.
- **Sites.** A named place — the cellar rack, the VPS at a hoster — with a kind and
  optional coordinates. Sensors point at one by name, which is what lets the
  configuration file describe a place with a single line. Optional throughout: a
  sensor without a site behaves exactly as it did before sites existed.
- **An account menu** in the top bar: who is signed in, their role, the theme,
  density and language switches, a way into Settings and **Sign out** — which used
  to be reachable only from the bottom of the Settings page.
- **One search box, and it searches everything.** The field in the middle of the top
  bar finds sensors, sites, channels, incidents, the individual probe messages of the
  retention window, the settings panels and — for administrators — the accounts, and
  takes you to whichever you picked. It matches literally, so a `%` is a percent sign,
  and it never looks at a credential. See [The search
  box](/configuration/dashboard#search).
- **A dashboard that moves when a probe lands.** A result redraws the one card it
  belongs to rather than the whole board, so an open tree branch stays open and the
  focus stays where you left it. A **Live** indicator in the top bar shows whether the
  event stream is connected, and turns it off (`ui.live`) if you would rather it did
  not. See [Live updates](/configuration/dashboard#live).
- **A top bar that holds one line at every width.** The words go first and the icons
  stay; when even those do not fit, the four working controls — layout switcher,
  Customise, New sensor, Live — fold into a `⋮` beside them and give their line to
  the search field. Below about 620 pixels the field leaves the bar rather than shrink
  to a stub, and a magnifier in the row lays it back over the bar at full width — the
  field does not go in behind the `⋮`, because a search box that has to be unfolded
  out of a menu is a search box nobody on a phone uses. One line from 320 pixels to
  2400, with less on it.
- **Settings in five tabs** with icons, one category on screen at a time instead of
  ten identical panels in a column. See
  [How the settings page is laid out](/configuration/dashboard#arrangement).
- **A header made of widgets.** The strip at the top of the dashboard — the status
  ring and the four figures — can be rearranged, added to and emptied: a clock, the
  recent incidents, the slowest sensors, a small map, shortcuts. Arranged by dragging
  the tiles or from Settings, stored per account. See
  [The header, as widgets](/configuration/dashboard#widgets).
- **A filter line on the incidents screen** — by state, by sensor, by period and by a
  word from the message, with a reset that puts the whole list back.
- **Backup and restore from the dashboard.** The configuration, or that plus the
  incidents and the rollups of the last 7, 30 or 90 days, written out as one JSON
  document and read back in after a format check and a byte-exact safety copy. The
  file carries secrets in clear text, which is stated rather than hidden — see
  [Backup and restore](/operations/backup).
- **A setup recipe in the channel editor.** Each channel type explains how to get its
  credentials — `@BotFather` for Telegram, the webhook path for Discord, the homeserver
  and access token for Matrix — under the fields, in the dialog where the question is
  actually asked. See [Getting the
  credentials](/concepts/alerts#getting-the-credentials).

- **A second interface language.** German joins English — since the 0.1.0 tag, so it
  ships with 0.2.0. The dictionary is a file
  beside the English one — same keys, same order, same placeholders, held there by a
  test — and one entry in the two lists that say what the interface offers, so the
  next language is no code at all. The switch is in Settings and in the account menu,
  and it covers dates and numbers as well as words. Three surfaces stay English on
  purpose: the [watchdog page](/operations/troubleshooting#the-dashboard-will-not-load),
  `doctor`, and the channel types and recipes the server sends as its own text.

- **Maintenance windows.** Silence a sensor or a group for a defined period —
  expected downtime should not open an incident and should not count against the
  uptime figure. The check keeps running and the result is recorded; what it is spared
  is the incident, the alert and the arithmetic. Recurring weekly or a single stretch
  of time, in the zone the person creating it is in.

## Next — 0.2.x

Ordered by value per unit of work.

- **More sensor types.** SSH banner, SMTP/IMAP greeting, UDP port, an ICMP TTL/hop
  sensor, and an HTTP sensor that follows a redirect chain and reports what it found.
  Each is one file in `internal/sensor`.
- **Dependencies between sensors.** Mark the router as a parent of everything behind
  it, so one power cut produces one incident and one alert instead of thirty.
- **Dashboard polish.** Pin a sensor to the top, per-group colours, and
  drag-to-arrange groups. (The side-by-side comparison view this item used to
  promise is the **tree**, the **wall** and the **map**, which shipped in the
  section above.)
- **Escalation.** A second channel that only fires when an incident is still open
  after N minutes.
- **Import and export, for the configuration file.** The dashboard can already write
  the whole installation out as JSON and read it back in — sensors, channels, sites,
  accounts, and as much history as you ask for. What this item still wants is the
  **other direction**: writing the `probeglass.yaml` that a file-driven installation
  is configured from, so the versioned part of a setup stops being something maintained
  by hand.

## Later — 0.3.x and beyond

- **A `/metrics` endpoint**, so a homelab that already runs a monitoring stack can
  scrape ProbeGlass instead of duplicating the checks it already makes.
- **Public status page.** A read-only view on its own path and its own token, safe to
  share outside the LAN, with the incidents you choose to publish.
- **SLA reports.** Monthly uptime per sensor and per group as a printable summary,
  built from the daily rollups that are already kept forever.
- **Certificate inventory.** One page listing every TLS certificate seen by any HTTPS
  or TLS-enabled TCP sensor, sorted by expiry.
- **Remote probes.** A second instance reporting into the first, for watching the
  homelab from outside.
- **Notification digest.** A daily "here is what happened" message instead of only
  event-driven alerts.
- **OIDC login** for homelabs that already run an identity provider.
- **Optional Postgres backend** for instances that outgrow one SQLite file.

## Out of scope

- **Agents and infrastructure discovery.** ProbeGlass watches what you tell it to
  watch; it is not a service-discovery or inventory tool.
- **Windows and macOS at all.** The container is the only thing that ships; there
  is no archive to unpack on a desktop.
- **A full SNMP poller.** ProbeGlass reads single OIDs over v2c, because that is what
  a switch, a router or a NAS is asked for. What stays out is the rest of it: a MIB walk,
  trap receivers, v3 with its authentication and privacy protocols, and the
  table-and-rate model a serious poller is built around. A homelab that needs those wants
  a different program, and the generic webhook is the bridge.
- **Multi-tenancy.** One instance, one homelab. Several people can have accounts on it
  with different roles, but they all see the same sensors, the same history and the same
  incidents — ProbeGlass assumes one group of people who trust each other with the
  dashboard. Isolating two organisations from each other is a different product, and
  running two containers is the answer to wanting two.
- **Plugins loaded at runtime.** The sensor and channel interfaces are the extension
  point, and they live in the binary where they can be tested.

## Guiding constraints

Every item above is judged against the same four rules, which are why the project
exists:

1. **One container, no sidecars.** If a feature needs a second process to run, it is
   not this feature. A small pure-Go library is a different thing: it ships inside the
   one binary and costs nothing at run time. The bar is that the protocol would otherwise
   have to be written by hand and got wrong — DNS, TLS, SQLite and SNMP cleared it; a
   library that wanted to bring a daemon did not.
2. **One SQLite file.** The whole state is that file, and copying it is still a
   complete backup. The JSON export above does not replace it and is not a second
   store: it is a document written out of this one database and read back into it,
   which is what lets it say "without the history" when a file copy cannot.
3. **No frontend build step.** A change to a `.js` file is a reload.
4. **The numbers must be right.** Uptime percentages, gaps, and incident durations are
   the product. Anything that risks double-counting a probe or hiding a gap loses to
   anything that does not.

## Next steps

- [Architecture](/development/architecture)
- [Contributing](/development/contributing)
