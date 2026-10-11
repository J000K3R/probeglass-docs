---
title: Dashboard settings
sidebar_label: Dashboard settings
description: Theme, accent colour, density, layout, language, live updates and the tour — the settings that belong to your account, plus the search box, the backup panel, the sample data and the user list.
---

# Dashboard settings

These are not process configuration. They live in the database, on **your
account**, are edited under **Settings**, and follow you to whatever browser you
sign in from — which is what you want on a wall display and on a laptop at the
same time.

<img
  src="/img/settings-look.png"
  alt="The Settings screen: a tab strip of five named categories across the top with Look selected, and below it the appearance controls for interface mode, theme, accent, density, layout and language."
  width="1600"
/>

| Setting | Values | Default |
|---|---|---|
| `ui.mode` | `simple`, `advanced` | chosen during setup |
| `ui.theme` | `auto`, `dark`, `light` | `auto` |
| `ui.accent` | `azure`, `violet`, `emerald`, `amber`, `rose`, `slate` | `azure` |
| `ui.density` | `compact`, `comfortable` | `comfortable` |
| `ui.layout` | `grid`, `list`, `tree`, `wall`, `map` | `grid` |
| `ui.language` | `en` | `en` |
| `ui.live` | `on`, `off` | `on` |
| `ui.widgets` | a comma-separated list of widget names | `status,uptime,latency,probes,since` |

- **Interface mode** — the one setting that is about the interface rather than
  its looks. See below.
- **Theme** — `auto` follows the operating system's preference and switches live
  when it changes.
- **Accent** — the colour of buttons, links, and the active tab. Charts are drawn
  for the theme and accent in use and are redrawn when either changes, so nothing
  ends up illegible against a background it was not designed for.
- **Density** — `compact` tightens padding and type size. On a dashboard with
  forty sensors, it roughly doubles how many fit on a screen.
- **Layout** — which of the five views the dashboard is drawn in. See
  [Views](#views).
- **Language** — English is the only catalogue so far. Adding another is a
  dictionary in `i18n.js` and one entry in the allowed list; the markup contains
  no user-facing strings, so nothing else changes. See the
  [roadmap](/development/roadmap).
- **Live** — whether the dashboard subscribes to the event stream at all. See
  [Live updates](#live).

Theme, density and language are also on the account menu in the top right corner,
next to the name of whoever is signed in — that menu holds **Settings** and **Sign
out** as well, so leaving the dashboard no longer means scrolling to the bottom of
another page. Everything in it is the same setting as in the table above; the menu
is a short way to the two or three you change often, not a second set.

<img
  src="/img/user-menu.png"
  alt="The account menu open in the top right corner: the name jane with the role Administrator, dropdowns for theme and density, then Settings and Sign out."
  width="1600"
/>

:::note There is no default interface mode
`ui.mode` is asked for during the first-run setup, on the step after the account,
and it is written then. An installation that never answered the question — one set
up by a script that only posted a username and password to `/api/setup` — reads the
fallback and shows everything.
:::

## 📊 The top bar {#top-bar}

Everything is one click away from the bar at the top of every view: the four tabs —
**Dashboard**, **Incidents**, **Alerts**, **Settings** — the search field in the
middle, and on the right the layout switcher, the header's **Customise** button,
**New sensor**, the **Live** indicator and your account. On a window too narrow to
hold all of that, those last four are behind a **⋮** beside them, and at its narrowest
the search field stands in the row as a **magnifier**; see below.

It is three columns rather than one row of things, and the middle one is why: a
field of fixed width only stays in the middle of the window if the columns beside it
take equal shares of what is left over. What the field does is
[its own section](#search).

<img
  src="/img/dashboard.png"
  alt="The top bar of the dashboard: the Weatherglass mark and the four tabs, each with an icon and a word, on the left; the search field centred; and on the right the layout switcher, the Customise button, New sensor, the Live indicator and the account chip."
  width="1600"
/>

**When there is no room for the words, the words go.** Every tab and every button up
there carries an icon *as well as* its word, and below roughly 1570 pixels the words
are dropped and the icons stay. The bar keeps one line, and nothing in it changes
meaning because it is drawn smaller.

That is a deliberate choice against the obvious alternative. A bar that wraps pushes
the whole page down and slides its controls sideways under the pointer that was
about to press one; a bar that shrinks to its icons stays where it was and loses
nothing but the letters. The exact width follows what the bar is holding — add a
control and the threshold moves with it — so treat the number as a reading, not a
constant.

**The label stays, even when the word does not.** It moves onto the button itself,
which is neither decoration nor a shortcut: a word hidden with `display: none` is not
read out at all, so a tab drawn as an icon alone would be a tab a screen reader could
not name and a tooltip could not explain. Each one keeps its label and answers to it.

**When there is no room for the controls either, the controls go — not the line.**
Below roughly 1130 pixels the four working controls on the right — the layout
switcher, **Customise**, **New sensor** and **Live** — fold into a **⋮** that stands
beside them, and the line they were on is the search field's: the field is at its
widest in exactly this range, which is the opposite of what a bar does when it starts
running out of room.

They are not copies. They are the same elements laid out as rows of a panel, so every
listener, every label and every scrap of state on them goes on working, and the words
they gave up on the way down — "New sensor", "Live", the switcher's labels — come back
with them, because a menu has no line to buy with them.

**The search field does not go in there.** Below about 620 pixels even a panel row's
worth of field is not there to be had, and a field squeezed to fit is a stub seven
characters wide. But a search box that has to be unfolded out of a menu is a search box
nobody on a phone uses, so the field keeps its place in the row in the shape of a
**magnifier**: one press lays the field **over** the bar at the full width of it, which
is the only shape worth typing in on a phone, and <kbd>Esc</kbd> puts the bar back. The
magnifier is in the bar rather than a row of the **⋮** on purpose — it is the one
control the bar never gives up, because it is the way to the field rather than a
replacement for it. And a field that is not in the bar is not in the tab order either,
which is the second reason the magnifier has to be a real button: nothing is reachable
only by a device that has no pointer.

The result is a bar that holds one line from 2400 pixels down to 320 — the same line,
with less on it.

## 🔍 The search box {#search}

One field, in the middle of the top bar, and it looks through **everything the
installation holds** — not just the sensors. Type two characters and it starts
answering; press <kbd>Enter</kbd> on a hit and it takes you there.

What it finds, and where each hit goes:

| It found | Pressing it |
|---|---|
| a **sensor** | opens that sensor's detail window |
| a **site** | goes to **Settings → Monitoring → Sites**, where the site is |
| a **channel** | goes to the **Channels** tab |
| an **incident** | opens the sensor it belongs to — the outage is shown in its own context, and the incident list has no anchor for a single row to hang on |
| a **probe message** | the same: it opens the sensor the message came from |
| a **setting** | goes to **Settings** and scrolls to the panel that holds it |
| an **account** | goes to **Settings → Access → Users** — administrators only |

Sensors, sites, channels, accounts and the settings are answered out of what the
page already holds, so those appear as you type. Incidents and the individual probe
messages of the last days live on the server, so they arrive a moment later from
`/api/search` — see the [API reference](/reference/api#search). Arrow keys move
through the list, <kbd>Enter</kbd> opens the highlighted hit, <kbd>Esc</kbd> closes it.

Two things worth saying plainly:

- **It does not search your secrets.** A sensor's options and a channel's
  configuration hold credentials, and a search box that answers with a bot token is
  worse than no search box at all. They are not looked through, and neither are
  password hashes or TOTP secrets. Account hits are administrator-only.
- **On the dashboard it also filters.** The cards narrow down as you type, exactly
  as the old per-view field did — and on the other four tabs it just opens the
  results. Both happen at once on the dashboard, which is the useful reading of
  "find a thing" when you are already looking at the list.

## 🟢 Live updates {#live}

The dashboard does not sit still between reloads. Every probe the daemon runs
arrives over the [event stream](/reference/api#server-sent-events), and the card it
belongs to is **updated in place**: a fresh latency figure, the status dot, the
sparkline and the heartbeat move, and nothing else on the page is touched.

That distinction is the whole design. Rebuilding the dashboard on every probe would
close any tree branch you had opened, move the map back to where it started, and
take the focus out of whatever you were typing — every minute, forever. So a probe
that merely produces a new number redraws one card's numbers, and only a changed
**status** animates. When a sensor's state flips, that card alone gets a brief
highlight, and one element on it is all that changes.

If a sensor's detail window is open when the sensor is checked, the window is left
alone — a chart that rescales under somebody who is reading it is a chart they have
to read again. The status dot in its header follows along, and a quiet line offers
**N new checks — refresh**, which you press when you are ready.

The **Live** indicator sits at the right-hand end of the top bar — or, on a window too
narrow for the bar to hold it, on the row of the **⋮**, where it is drawn with its
word: a dot and a word, bright while the stream is open and muted when it is not. On a
wide window the word is among the first things the bar gives up when it runs out of
room, so there it can be the dot alone — the button keeps its label either way, see
[the top bar](#top-bar). It is also the honest
place to notice that the connection has dropped, which was previously invisible.
Clicking it toggles `ui.live`, which is a setting like any other and belongs to your
account:

- **On** (the default) — everything above.
- **Off** — the dashboard does not subscribe at all. No stream, no patching, no
  traffic. The minute-by-minute refresh and the reload when you come back to the
  tab continue to run, so the page is never stale for long; it simply is not
  animated.

If the operating system asks for reduced motion, the values still arrive — they
arrive without the highlight, because a reading that flickers is not more
accessible than one that does not.

## 🗂️ How the settings page is laid out {#arrangement}

The settings used to be ten identical blocks in a column, and finding **Backup**
meant scrolling past **Accent**. They are now five named categories with a **tab**
each, and **only the chosen category is on screen** — the others are not further
down the page, they are not on it at all.

| Category | Holds |
|---|---|
| ◐ **Look** | Appearance, Map |
| ◉ **Monitoring** | Dashboard defaults, Sites, Sample data |
| ⚿ **Access** | Access, Users |
| ⛃ **Backup** | Backup and restore |
| ⓘ **Help and maintenance** | Getting started, Diagnostics, About |

<img
  src="/img/settings-monitor.png"
  alt="The settings page on the Monitoring tab: five tabs along the top with Monitoring chosen, and below them the Dashboard defaults, Sites and Sample data panels — and nothing from the other four categories."
  width="1600"
/>

Three things follow from the grouping, and all three are deliberate:

- **It changes where a panel sits, not what a panel does.** Every setting is the
  same setting, with the same name and the same effect.
- **The simple/advanced fold still applies inside the categories.** See
  [Simple and advanced](#simple-and-advanced) — a category in which everything is
  folded away is folded away with it, so the tabs never offer a way to nothing.
  The **Backup** tab is the clearest case: a signed-in account that is not an
  administrator has no backup panel, so the tab is not there.
- **Which category you are on is not saved on the server.** It is where you are
  looking, not a setting, so it lives in the page and survives a reload rather
  than following you to another browser. Coming back to the dashboard and
  returning to Settings leaves you on the category you were reading.

Each panel is still a **target for the search box** above: searching for "backup",
"tile" or "second factor" puts the panel that owns it at the top of the results,
and choosing a hit **switches to that panel's category** so the thing you searched
for is actually in front of you.

## 🧩 The header, as widgets {#widgets}

The row at the top of the dashboard — the ring with the counts and the four
figures beside it — is a **strip of widgets**. Which ones are on it, and in what
order, is yours to decide, and the answer is stored on your account.

<img
  src="/img/widgets.png"
  alt="The dashboard header as a fresh account has it: the status ring, then a tile each for uptime, latency and probes — the first with an hourly band under its figure, the second with a curve — and a tile for the date monitoring began."
  width="1600"
/>

Every tile is the same surface in the same twelve-column grid, so the row reads
across: the labels sit on one line, the figures under them, and the drawing — if a
tile has one — at the foot of the tile. A figure carries the period it is for and,
where there is something to compare it with, the same figure over seven days. Not
every tile has a drawing: the probe count is the number of checks taken in an hour,
which is the same number every hour, so a curve under it would be a flat line
pretending to be information.

**Arranging it.** The **Customise** button in the top bar, beside the layout
switcher, puts the header into editing. It is drawn as a segmented control with an
icon and a word — the same shape as the switcher next to it, because it is the same
kind of thing: a control about how this dashboard is put together.

While the header is being arranged the switcher stands down and an **add** button
takes its place in the same segment. That is a width, not a whim: the header only
exists in the card view, so the control that leaves it is not one you can use while
you are arranging it, and it is exactly the width of the button that replaces it.
The top bar holds one line at every width the dashboard is read at — it drops its
words, then folds its working controls into the **⋮**, before it would ever wrap, see
[the top bar](#top-bar) — and a control that quietly costs
it a second line is a worse trade than one that steps aside.

In editing every tile carries a bar with its name and three buttons:

- **drag a tile** to where you want it — this works with a finger as well as a
  mouse, which matters for a dashboard on a wall display or a phone;
- **◀ ▶** move a tile one place. They are the same thing dragging does, in a way
  that works from the keyboard, which is why they are there rather than hidden
  behind the drag;
- **✕** takes a tile off the strip. The widget is not gone — it goes back into the
  list of ones you can add;
- **Done** ends editing. The arrangement is saved as you go, so there is nothing
  to confirm.

<img
  src="/img/widgets-edit.png"
  alt="The dashboard header while it is being arranged: every tile carries a bar with a grip, its name, a left arrow, a right arrow and a cross, and the top bar shows a plus and a tick where the layout switcher was."
  width="1600"
/>

**Adding one.** The **+** button opens a narrow window listing every widget that is
not on the header yet, each with its icon and its name:

<img
  src="/img/widgets-picker.png"
  alt="The widget picker open over the dashboard: a narrow window headed “Add a widget”, listing the widgets that are not on the header, each with an icon and a name."
  width="1600"
/>

Choosing one puts it at the end of the strip and shuts the window, so the tile you
have just added is not sitting behind a window that is still standing — which would
read as nothing having happened. Where it belongs is then one drag, or a couple of
arrow clicks, away. There are no dashed placeholders in the strip itself: a tile
that is not a widget is a tile that has to be explained, and a real tile already
says what it would be.

The same list is also in **Settings → Monitoring → Dashboard defaults**, as rows
with a checkbox, the two arrows and a **Reset to the default header** button. Two
views of one setting, and they cannot disagree: switch a widget off there and it
leaves the strip when you press it. That side is also the place to read what is
available before you start moving things about.

**What there is:**

| Widget | Shows |
|---|---|
| **Status** | the ring and the counts: how many sensors are up, down, paused or unknown |
| **Uptime 24h** | the mean 24-hour uptime over all sensors |
| **Latency** | the average latency across all sensors |
| **Probes 24h** | the number of probes taken in the last 24 hours |
| **Monitoring since** | the date and time the installation started monitoring |
| **Clock** | the time, with the date under it — the viewer's clock, not the server's |
| **Recent incidents** | the last few incidents with the sensor, how long ago and what was wrong; a click opens the sensor |
| **Slowest sensors** | the five sensors with the highest average latency, worst first |
| **Most outages** | the five sensors with the worst 30-day uptime — the same figure the cards show, so the list cannot disagree with them |
| **Map** | a small map of your sites; clicking a pin opens the sensor, and the layout switcher has the full map |
| **Shortcuts** | buttons for the places you go often: incidents, alerts, Settings, live on and off — plus a new sensor, for an administrator |

The five that a fresh account starts with are exactly the header the dashboard has
always had, so **nothing changes until you change it**. Emptying the strip is
allowed, too, and says so rather than leaving a blank space.

**Where it is kept.** In one account setting, `ui.widgets`, as the widget names in
order — so the arrangement follows you to another browser, unlike the settings tab.
Anything not in the list is not drawn, and a name the server does not know is
refused rather than stored, which is why a widget can never appear as a blank tile.
The map is the one widget kept out of the general redrawing: it is mounted when its
tile has been given its size and then only has its pins recoloured, so a refresh
never moves the viewport or reloads the tiles under you. It also gives up the
keyboard: the small map is a picture, its pins are clickable, and it is not a tab
stop that swallows the arrow keys on the way past.

## 👀 Five views {#views}

The dashboard can be drawn five ways. They are not five pages: they are one
setting, they show the same sensors and the same numbers, and the switcher in the
top bar sets it directly — every view is one click away, and each one is a
different answer to "what am I looking at right now".

**Cards** (`grid`) and **list** (`list`) are the two there have always been. Cards
give each sensor a sparkline and three periods of uptime; the list is one dense row
each, which is what you want when there are forty of them and you are scanning for
the red one.

<img
  src="/img/dashboard.png"
  alt="The dashboard on sample data: five invented sensors in two groups, one of them down, each with a sample badge, a sparkline and 24-hour, 7-day and 30-day figures."
  width="1600"
/>

**Tree** (`tree`) folds by place and then by group, the way a file tree does. Each
place is a heading you can close, carrying its kind
and the **worst** status beneath it, so a folded branch still tells you whether
anything inside it is unhappy. Under the heading the sensors keep their group,
their sparkline, their 24-hour uptime and their buttons.

<img
  src="/img/dashboard-tree.png"
  alt="The tree view: two places, Hetzner Cloud and Homelab, each folded open into its groups and sensors, with a third heading for the sensors that have no place yet."
  width="1600"
/>

**Wall** (`wall`) is a grid of tiles rather than a list. Each tile carries
the sensor's name, its current status and latency, and a **heartbeat**: one small
rectangle per recent check, green for a probe that succeeded and red for one that
did not. That row is the point of the view — it is the shape of the last hour at a
glance, where a card's sparkline is the shape of the latency.

<img
  src="/img/dashboard-wall.png"
  alt="The wall view: tiles for each sensor arranged under their place, each with a status pill, a row of green and red heartbeat rectangles, the current latency and the 24-hour uptime."
  width="1600"
/>

The heartbeat covers the **last 40 checks**, which is roughly forty minutes at a
one-minute interval and about three and a half hours at five. The heading says
"recent checks" rather than "the last hour" for exactly that reason.

**Map** (`map`) draws the places that have coordinates on a real map. Homelab and
external sites are told apart by **shape** as well as
colour — a filled disc against a hollow diamond — because the colour of a marker is
the worst status of the sensors on it, and two meanings on one channel would be one
too many. Everything else is ordinary map behaviour: drag to pan, scroll to zoom on
the point under the pointer, and buttons for the ones who prefer them.

<img
  src="/img/dashboard-map.png"
  alt="The map view: OpenStreetMap tiles of central Europe with two markers, Hetzner Cloud in the north-east and Homelab further south-west, a legend in the bottom left corner and the OpenStreetMap attribution in the bottom right."
  width="1600"
/>

**If the tile server cannot be reached, the markers stay where they are.** They are
placed by arithmetic, not by the pictures behind them, so a homelab with no route to
the internet shows a plain grid with the places correctly arranged on it and one
line saying the tiles are missing. That is a deliberate trade: an offline dashboard
that lies about where things are would be worse than one that admits it has no map.

## 📍 Sites {#sites}

A **site** is a place your sensors are: the rack in the cellar, the VPS at a
hoster. It is what the tree folds by and what the map draws, and it is a small list
of its own under **Settings → Monitoring → Sites**.

<img
  src="/img/settings-sites.png"
  alt="The Sites panel in Settings: two rows, Homelab marked local with coordinates and Hetzner Cloud marked external, each with its sensor count, plus the button that adds another."
  width="1600"
/>

Each site has a name, a **kind** — `local` for the homelab, `external` for a hoster
or a cloud — and optional coordinates. Three things are worth knowing:

- **A site without coordinates is fully useful.** It groups the tree and the wall
  exactly like any other; it is simply not drawn on the map, and the map says which
  sites those are so you are not left wondering where one went.
- **A sensor without a site works exactly as before.** It appears in the tree and
  the wall under **No site**. Nothing has to be assigned for the dashboard to make
  sense, which is what makes this an addition rather than a migration.
- **Nothing with sensors on it is deleted by accident.** Removing a site that is
  still in use is refused with the number of sensors that would be orphaned; the
  dialog then offers to remove it *and* leave those sensors without a site, which
  is the honest way to say the same thing.
- **A site can be made while the sensor is made.** The sensor form's place picker
  ends with **New site…**; choosing it brings up a name and a kind, and the place is
  made together with the sensor. Making a sensor is usually the moment somebody
  first knows where the thing stands, and a trip to Settings and back would cost
  them the half-filled form. The place is made **on save**, not when the entry was
  chosen: a form closed again leaves nothing behind, and a name that already exists
  is used rather than made a second time.

Coordinates are all-or-nothing: both or neither. A site with a latitude and no
longitude has no position — `0, 0` is a real place in the Gulf of Guinea and is
never allowed to mean "unknown".

A site declared in the [configuration file](/configuration/file#sites) is the
file's to own: its name, kind and coordinates cannot be changed or removed in the
dashboard, for the same reason a sensor from the file cannot. The list says so
instead of hiding the buttons, and a change sent past the dashboard is refused
rather than accepted and quietly undone by the next start.

## 🗺️ Map tiles {#map-tiles}

The map is drawn from ordinary raster tiles fetched by **your browser**, straight
from a tile server named in Settings. The default is OpenStreetMap, which needs no
account and no key:

```
https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

`{z}`, `{x}` and `{y}` are required and are substituted per tile; `{s}` is optional
and cycles through `a`, `b` and `c` for servers that spread their load over
subdomains. A URL that does not carry the three required placeholders is refused
rather than half-working. The attribution line is a separate field, because it is a
licence obligation rather than decoration — the OpenStreetMap default carries the
link that the [ODbL](https://www.openstreetmap.org/copyright) requires.

:::warning The tile server sees your browser
The tiles are fetched by the browser, so whoever runs the tile server sees your IP
address, your browser's user agent and roughly the part of the world you are
looking at. That is fine for a homelab on your own network. It is not fine for a
fleet you monitor on behalf of somebody else, and on a phone away from home it is a
third party learning that this dashboard exists and about where.
:::

For anything more than a homelab, run a tile server inside your own network and put
its address in the field. Nothing about the map needs the public internet: with your
own server the browser fetches tiles from an address it could already reach, and the
dashboard's content security policy does not have to be widened at all. Weatherglass
does not proxy tiles through the daemon — a proxy would make the server an
outbound fetcher with an interesting attack surface and a cache to manage, and the
privacy would end up the same.

See [Security](/concepts/security#map-tiles) for how the tile origin reaches the
dashboard's content security policy.

## ✂️ Simple and advanced {#simple-and-advanced}

The same program, with the parts you do not need taken out of the way. **Simple**
hides whole areas and folds the rest: the per-type options, the channel
selection, the reminder interval and retries, tags, the user list, the API key,
the accent and density and layout pickers, and the full text of the self-check.

The simple mode hides things; it never disables them. Every sensor keeps probing
at the interval it had, every channel keeps firing, and nothing an advanced
installation set stops working because the picker that set it is out of sight.
Switching back shows all of it again, unchanged.

Since the mode is a per-account setting, one person can run the dashboard in
simple mode on the kitchen tablet while another keeps the full one open.

## 🧪 Sample data {#sample-data}

A new installation comes with a few invented sensors so that there is something to
look at, and `weatherglass seed --demo` adds more. Both are marked in the database
as **sample data**, and Settings has a panel that says how much of it there is.

<img
  src="/img/dashboard.png"
  alt="The dashboard on sample data: five invented sensors in two groups, one of them down, each with a sample badge, a sparkline and 24-hour, 7-day and 30-day figures."
  width="1600"
/>

**They say so on their card.** Every sensor that came from the sample data carries
a badge where it is drawn — visible in the picture above — so nothing invented is
ever mistaken for a sensor you set up. That holds on a wall display and in a
screenshot as much as it does at your desk.

<img
  src="/img/example-data.png"
  alt="The sample-data panel in Settings: how many example sensors, results and incidents there are, and the button that removes them."
  width="1600"
/>

Removing the sample data deletes exactly the sensors that were marked, and their
history goes with them — results and incidents belong to a sensor and go when it
goes. It cannot be undone, so the button asks first. Sensors you created yourself
are never touched, however they are named.

**And the same panel loads it back.** Once there is nothing left to remove, the
panel offers to load the sample data instead, and the answer is the fuller
dataset: more sensors than the setup writes, in their groups, with an invented
week of history, so the charts and the uptime bars have something in them the
moment the page reloads. That is deliberately more than the four bare sensors a
fresh installation starts with — you pressed a button to see a populated
dashboard, not an empty one.

Loading is safe to do twice: a name that is already taken is left alone, so the
second press creates nothing and invents nothing. On an installation whose sensors
come from a configuration file, the panel only offers the count, because the file
is the source of truth and the server refuses to write rows it does not declare.

Either way the panel is never blank: it shows the count while there is sample data
to remove, and the load button once there is not. The installation is entirely
yours when the count is zero — and stays that way unless you ask for it back.

## 💾 Backup and restore {#backup}

The panel under the **Backup** category of Settings writes the installation out as one
JSON file and reads one back in. It is the portable half of
[Backup and restore](/operations/backup), which is the page to read before you use
it; what belongs here is how it behaves.

<img
  src="/img/backup-panel.png"
  alt="The Backup and restore panel: a menu labelled What to include, set to With history; a second labelled History of the last, set to 30 days; a Download backup button and a Restore from a file button; and below them a plain warning that the file holds password hashes, two-factor secrets and alert-channel credentials in plain text."
  width="1600"
/>

Two menus decide what the file is:

- **What to include** — **Without history** is the sensors, the sites, the alert
  channels, the accounts and the settings. **With history** adds the outages and the
  hourly and daily figures.
- **History of the last** — how far back those figures go: 7, 30 or 90 days, or
  everything kept.

The individual probe messages are not in either file. They are the one part of the
history that does not fit reasonably into a document — seven days across forty
sensors is some 400 000 rows — and every uptime figure and chart that reaches past
the raw window is computed from the rollups, which **are** in the file. So the
numbers are right after a restore; what is gone is the ability to search for a
particular probe message from a day you did not carry over.

:::warning The file carries your secrets in clear text
Password hashes, TOTP secrets, recovery-code hashes, the API key and the
credentials of every alert channel. This is the one place the masking does not
apply — a backup with a masked bot token restores a channel that cannot send
anything, and you would only find that out during an outage. The panel says this
too, in the same words. Read [The backup file carries secrets in the
clear](/concepts/security#backup-secrets) before you put one somewhere.
:::

**Restoring** asks twice and says what is about to be replaced. Before anything is
written it checks the file — a document that is not a Weatherglass backup, or one
from a newer version, is refused and nothing changes — and it writes a byte-exact
`VACUUM INTO` safety copy of the database beside itself. A file **without history**
leaves the incidents and the rollups exactly where they are, so a configuration
rollback does not wipe your history.

## 👥 Users {#users}

Administrators get a list of the accounts on this installation, with each one's
role, whether a second factor is enrolled, when it was last used and how many
recovery codes are left.

<img
  src="/img/users.png"
  alt="The user list: one row each for jane, anna and ben, with their roles, whether a second factor is set, their last sign-in and the actions available."
  width="1600"
/>

Creating and editing go through the same dialog as everything else. An
administrator can reset somebody's password there, which signs that person out
everywhere. The list is part of the advanced mode, and only an administrator sees
it at all.

The rules that keep an installation reachable — the last active administrator
cannot be removed or demoted, and nobody can remove themselves — are enforced by
the server, not by hiding the button. See
[Security](/concepts/security#accounts) for what each role may do.

## 🔐 Your own account {#your-own-account}

Under the **Access** category you change your own password and set up a second factor. Nothing
here is an administrator's business but your own, which is why the password form
asks for the current password even for an administrator.

Two-factor authentication is described in full in
[Security](/concepts/security#two-factor-authentication); it is set up from this
panel and the API key below it is the administrator's.

## 🩺 The self-check {#the-self-check}

The **Diagnostics** panel at the bottom of Settings runs the same checks
`weatherglass doctor` runs on the command line — the database, the schema, the
integrity of the file, the configuration, the accounts, whether the daemon is
answering, and whether it can open an ICMP socket — and shows both the results and
the literal text the command line prints. It also gives you the one-line
`docker exec` command to run it yourself.

<img
  src="/img/settings-doctor.png"
  alt="The diagnostics panel after a run: a summary of ten ok, zero warn and zero fail, then one row per check — build, config, data dir, database, integrity, schema, users, contents, daemon and icmp — each with its own verdict and detail."
  width="1600"
/>

One honest caveat: run from the dashboard, the configuration check is always
green, because the daemon that is answering the request is by definition
running. The command line version is the stricter of the two. The panel says so
rather than leaving you to work it out.

## Through the API

The same settings are readable and writable over HTTP, and they are the settings
of whichever account the request is authenticated as:

```bash
curl -H "X-API-Key: $WG_KEY" localhost:8080/api/settings | jq

curl -X PUT -H "X-API-Key: $WG_KEY" -H 'Content-Type: application/json' \
  -d '{"ui":{"theme":"dark","density":"compact"}}' \
  localhost:8080/api/settings
```

A `PUT` may carry any subset of the keys. An unknown key or an out-of-range value
is a `400` naming the offending key, so a typo in a setup script fails loudly
instead of being stored and ignored.

A change is published on the event stream, and every open dashboard applies it
immediately — no reload, and no polling.

:::note The API key has no account
A request carrying the API key is an administrator with no account row behind it.
Writes to these settings therefore land on nobody, and reads answer with the
defaults. Use a session for anything that should be somebody's preference; the
key is for sensors, incidents and channels.
:::

## Why these are per account and not per browser {#per-account}

A theme per browser would mean storing a preference in `localStorage`, and the
dashboard deliberately keeps **nothing** in browser storage: no `localStorage`,
no `sessionStorage`, no client-side state that has to be reconciled with the
server. The session is a cookie the server owns, and everything else is state the
server can describe. That makes "which settings am I actually running?" a
question with exactly one answer.

An account is the smallest thing the server can already describe, so a preference
hangs off the account row rather than out of a browser. That is why the same
person gets their theme on every device, and why two people sharing one dashboard
can disagree about the layout without either of them being wrong.

Two people on one installation still see the same **sensors, history and
incidents**, and will always see the same ones: Weatherglass is one homelab, not a
multi-tenant service. Isolating two organisations from each other is explicitly
[out of scope](/development/roadmap#out-of-scope).
