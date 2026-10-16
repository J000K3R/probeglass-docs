---
slug: /about
title: Who makes this, and how
sidebar_label: About this project
description: ProbeGlass is a hobby project, written in dialogue with an AI coding agent. No warranty, no liability, no support contract, nobody to call.
---

# ⚖️ Who makes this, and how {#who-makes-this}

:::warning Read this before you rely on ProbeGlass for anything
**ProbeGlass is a hobby project by somebody who is not a professional software
developer.** One person, spare time, written for their own homelab. There is no
company behind it, no support contract, no paid tier, no SLA, and no promise that a
bug will be fixed — or fixed soon.

**It is "vibe coded".** The code is written in dialogue with an AI coding agent
(Claude Code). A minority of it is written or reworked by hand; most of it is
written by the agent and then read, run, measured and argued with until it behaves.
It has not had a design review, a security audit, or a second pair of human eyes on
every line. Expect the rough edges that come with that, and please report them.

**Nobody is liable for anything.** ProbeGlass is MIT licensed and provided "as
is", without warranty of any kind. That covers data loss, a container that will not
start, and — the case this project exists to catch — a service that was down for a
day while the dashboard said it was fine. **Do not make it your only line of
defence.** If a missed alert would cost you money, keep a second, independent check
on the things that matter most.
:::

## How it came about {#how-it-came-about}

It started with an annoyance. A homelab had outgrown the way it was being watched:
the tools that were to hand wanted a few hundred megabytes of RAM and a stack of
moving parts to answer the question *"is the NAS up?"*, and setting up a new check
was a project of its own. So the first constraint ProbeGlass was built under was
the opposite one: **smaller than the thing it monitors**. One container, one SQLite
file, a few megabytes of RAM, and no dependency that can itself be the reason the
monitor is down.

The second constraint was ease. Adding a sensor should be unceremonious: fill in a
form, get a check. That is still the standard every screen is held to, and a screen
that makes it harder is a bug.

The third constraint was that it had to exist at all. There are enough monitoring
tools in the world and no shortage of good ones — this is not an argument against
any of them, and if one of them fits what you need, use that one. ProbeGlass is
here because it was wanted in this particular shape, and because the person who
wanted it could build it.

It grew from there, one annoyance at a time: history that survives a restart,
incidents that say how long something was down, alerts that reach a phone, a
dashboard you can leave open on a wall, and a guided tour for the parts that are not
obvious. There is no grand design behind the order of the features — it is the order
in which things got in the way.

## Who this is for {#who-this-is-for}

ProbeGlass is built for one homelab: the one it runs in. It is shared on the
chance that somebody else is looking for something similar, and that is the whole of
its ambition. There is no roadmap anybody promised you and no plan to compete with
anything — a feature arrives because it was wanted here, or it does not arrive.

If that is the kind of thing you find useful, it is genuinely nice to hear about it.
If you need a tool with a company behind it, this is not that tool, and the honest
thing is to say so here rather than in a support ticket later.

## How it is written today {#how-it-is-written-today}

**Language and dependencies.** Go, with the dashboard embedded in the binary.
SQLite through a pure-Go driver, so the binary is static and `CGO_ENABLED=0` holds
— which is what lets one container image be built for amd64 and for a Raspberry Pi
alike. The frontend is plain ES modules: no framework,
no bundler, no npm, no CDN, no build step at all — editing a `.js` file and
reloading the page is the entire frontend toolchain. That is a deliberate choice
about a decade of maintenance rather than about download size: a build step is
another thing that can be abandoned by the people who maintain it.

**How a change is made.** The maintainer describes in plain language what should be
different and why. The agent writes the code. Then it is run, in a real browser, on
a real database, and looked at — and the answer "it compiles" is not the answer to
"does it work". Anything that can be measured is measured rather than assumed: the
breakpoints in the top bar, for instance, are checked by a test that drives Chrome
and reads the geometry of the bar, because a comment describing where a layout
breaks does not fail when the layout moves.

**Testing.** `make check` runs `gofmt`, `go vet` and the unit and integration suites;
`golangci-lint` runs clean; and `e2e/` holds an end-to-end suite that drives the real
interface in a real browser — logging in, adding a sensor, opening the ⋮, resizing
the window — and asserts on pixels and HTTP responses rather than on internal state.
It is not complete coverage, and it is not a security review. It is the reason a
change to one screen is unlikely to break another.

**The comments carry the reasoning.** This codebase is commented at length, and
almost never about syntax. Why a breakpoint sits at 380 pixels and not at 400. Why
the session cookie deliberately has no `Secure` flag. Why a navigation icon gives up
its word before its icon does. If you want to know why something is the way it is,
the comment above it usually says so — including when the answer is "this is a
compromise".

**Some of the prose is AI-written too.** The documentation, the changelog entries,
the comment blocks and the copy on this site were drafted the same way the code was.
They are read and corrected before they ship, but a sentence that reads oddly is
more likely to be a drafting artefact than a considered decision. Tell us and it gets
rewritten.

## What that means for you {#what-that-means-for-you}

- **The issue tracker is read, and it is welcome.** A bug report with a version
  number, what you expected and what happened instead is genuinely useful, and
  so is a patch. What is not on offer is a timeline, an acknowledgement window, or
  a fix you can plan around.
- **0.1.0 means exactly that.** The foundation works and has been run for real. The
  surface is still moving — a config key, a URL or a screenshot may change between
  minor versions. Pin a version or a digest if you need a deployment that does not
  move.
- **Read the code before you trust it with something that matters.** It is small on
  purpose, and reading a few thousand lines of Go is a realistic evening. That is a
  better use of the time than taking anybody's word for it — including this page's.
- **If it is wrong, that is expected, not surprising.** A missed alert, a chart that
  draws the wrong thing, a migration that eats a week of history: these are all
  possible, and the honest expectation is that you find some of them.

## What it is not {#what-it-is-not}

- **No telemetry, no phone-home, no analytics, no update check, no account.** There
  is no server to call. ProbeGlass makes outbound connections only to the targets
  you configure and the alert channels you set up.
- **No hosted version and no paid tier.** The project exists as source code and as a
  container image, and there is no plan to sell anything.
- **Not a replacement for a professional monitoring stack** in a place where money
  or safety depends on the answer. It is a homelab watchdog, and it is good at being
  that.

## Licence and liability {#licence-and-liability}

MIT. In full and in plain words: you may use, copy, modify and sell this software;
the copyright notice stays; and **it comes with no warranty of any kind**, express
or implied, and the authors are **not liable** for any claim, damage or other
liability arising from it or from using it. The full text is in
[LICENSE](https://github.com/j000k3r/probeglass/blob/main/LICENSE) — that file is
the one that counts, not this paragraph.

If that is not the trade you want to make for a hobby project, that is a completely
reasonable position — and in that case one of the other monitoring tools out there,
or a commercial service, is the better answer.
