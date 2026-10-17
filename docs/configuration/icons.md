---
title: Symbols on sensors, places and groups
sidebar_label: Symbols
description: Draw a router, a NAS or your own uploaded image beside a name — on a sensor, a place or the heading of a group.
---

# Symbols on sensors, places and groups

A dashboard of names is harder to read than it looks. "Router", "Router: ping" and
"Gateway" are three rows of text that mean three different things, and the eye has to
read every one of them. A symbol beside the name is what lets it stop reading.

Any **sensor**, any **place** and the heading of any **group** can carry one. The field
is in the sensor editor, in the site editor, and in **Settings → Monitoring → Groups**,
and the symbol is then drawn beside the name in every view: the cards, the list, the
tree, the wall and the sensor's own detail dialog.

<img
  src="/img/icon-picker.png"
  alt="The icon picker open on the sensor form: a row for No icon, then twenty-six built-in drawings with their names — Router, Switch, Server, NAS, Container, Cloud, Internet, Database — and below them the uploaded images and an Upload an image button."
  width="1600"
/>

## The drawings that ship with the program

Twenty-six of them, drawn by hand in the same line style as the rest of the interface:
router, switch, server, NAS, container, cloud, internet, database, disk, processor,
Wi-Fi, camera, printer, battery, socket, temperature, light, lock, certificate, alert,
e-mail, phone, laptop, screen, clock and label. Nothing is downloaded and nothing is
fetched: they live inside the binary.

They are also **coloured by the text around them** rather than carrying a colour of
their own, so the same file is right in the dark theme, in the light theme, and under
all six accent colours. That is also why a group's heading passes its colour on to the
symbol in front of it — the two are one thing to look at.

## Your own images

The same picker takes a file: **PNG, JPEG or GIF**, at most **64 KiB** and **512
pixels** a side. Once uploaded it appears in the picker under **Uploaded**, and can be
given to any sensor, place or group.

Three things are worth knowing about how that works:

- **The bytes go into the database, not into a folder beside it.** "One SQLite file,
  and copying it is the whole backup" is a promise this project makes in three places,
  and an image kept on disk would quietly make it false: the copy would come back
  without them.
- **SVG is refused, and not as a matter of taste.** An SVG is not an image but a
  document: it may carry script and references to other sites, and it would be served
  from this dashboard's own address, where that script would run with the session
  cookie of whoever looked at it. A raster image cannot do that.
- **What the file is gets read, not believed.** The name and the type the browser sends
  are both chosen by whoever uploads; the dimensions and the format come from reading
  the bytes, and a file that is truncated or is not an image at all is refused where
  the message can still be acted on — in the dialog, next to the field.

Deleting an uploaded image that something still wears is refused, and the refusal says
how many sensors, places and groups point at it. Confirming takes it off all of them
and deletes it in one go. Nothing breaks if you leave a dangling reference behind: a
symbol is a piece of text, not a link, so an image that is gone simply draws nothing.

## Groups

A group is a word somebody typed on a sensor — there is no "create group" step
anywhere, and no list of groups to keep in step with the sensors. What **Settings →
Monitoring → Groups** holds is what is known *about* a group once somebody has said
more:

| Setting | What it does |
|---|---|
| Icon | the symbol drawn before the heading |
| Colour | the colour of the heading, and of the symbol in front of it |
| Position | where the group stands in the order; lower numbers first, and groups with the same number stay alphabetical |

The colour is one of six names — azure, violet, emerald, amber, rose, slate — and not a
value you type. Every colour in this interface exists twice, once for the dark theme and
once for the light one, and a hex value chosen on one of them is wrong on the other.

**Forget** removes all three and leaves the group alone: the sensors keep the word, and
the heading goes on being drawn — plainly, exactly as it was before anybody opened the
editor. A group with no settings is not an unfinished group; it is the ordinary state of
every group on an installation nobody has decorated.

## In the configuration file

A sensor or a site declared in `probeglass.yaml` may name one:

```yaml
sites:
  - name: Rack A
    kind: local
    icon: builtin:server

sensors:
  - name: Router
    type: ping
    target: 192.168.1.1
    group: Network
    icon: builtin:router
```

The two forms are the same two the dashboard writes: `builtin:<name>` for a drawing
that ships with the program, `upload:<id>` for an image this installation has. They are
checked when the file is applied — and by `probeglass doctor`, which reports them
without changing anything — because a file doctor accepts has to be a file serve
applies.

That matters more here than it looks. A sensor the file declares is written from the
file **whole** on every start, so a column the file could not name would be cleared each
time the daemon came up; an icon set in the dashboard on a file-owned sensor would
disappear overnight. The file owns everything about the rows it declares, and that is
what it is for.

## What a symbol is not

- **It is not inherited.** A sensor's symbol is its own; a group's heading is drawn from
  the group's settings. Decorating a group does not decorate the sensors in it.
- **It does not change the map's pins.** A place on the map is drawn with the pin its
  kind gives it — that is what tells a rack from a server at a hoster at a glance — and
  a symbol is what a place shows beside its name in the tree and in the settings list.
- **It is not monitored.** Nothing about a sensor's checks, its incident, its alerts or
  its uptime depends on which picture is next to its name.
