---
title: Installation
sidebar_label: Installation
description: Install ProbeGlass with Docker Compose, plain Docker, or from source, and finish the first-run setup.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Installation

ProbeGlass is one container with no runtime dependencies. Pick whichever of
the three routes below matches how you run the rest of your homelab.

## Requirements

- Any machine that runs Docker, or a Go toolchain if you build from source.
- Roughly 30 MB of disk for the image and a few MB of RAM while running.
- `NET_RAW` **only** if you want ICMP ping sensors. Everything else works
  unprivileged.

ProbeGlass speaks plain HTTP on port 8080. It expects to sit behind your
existing reverse proxy if you need TLS — see
[Running behind a reverse proxy](/operations/reverse-proxy). That page also
explains why this must **not** be reachable from outside your network yet.

## Install

Pick the route that matches how you run the rest of your homelab. They all end
up serving the same binary on port 8080.

:::note Which tag to pull
The image lives on the GitHub Container Registry as
`ghcr.io/j000k3r/probeglass`. It is public, so pulling it needs no account and
no `docker login`.

Every release carries three tags. **`0.2.1`** is the exact version and never
changes under you; `0.2` follows the 0.2.x patch releases; `latest` follows the
newest release of all. The commands below pull `0.2.1`, so the version changes
when you edit that line rather than when a container restarts. Each image also
carries the commit it was built from (`sha-4a1c2e7`), which is the tag to pin if
you want one exact build.
:::

<Tabs groupId="install-method">
<TabItem value="compose" label="Docker Compose" default>

The repository ships a `docker-compose.yml` with the volume, the port, and the
`NET_RAW` capability already set up:

```bash
git clone https://github.com/j000k3r/probeglass.git
cd probeglass
docker compose up -d
```

The compose file pins `ghcr.io/j000k3r/probeglass:0.2.1`. Change that line to
`0.1` or `latest` if you would rather it followed the patch releases or the
newest release; the deployment stays reproducible either way.

</TabItem>
<TabItem value="docker" label="docker run">

```bash
docker run -d \
  --name probeglass \
  --restart unless-stopped \
  -p 8080:8080 \
  -v probeglass-data:/data \
  --cap-add NET_RAW \
  ghcr.io/j000k3r/probeglass:0.2.1
```

Notes on the flags:

- `-v probeglass-data:/data` — the whole state is one SQLite file in here.
  Backing up this volume backs up everything; see [Backup](/operations/backup).
  A bind mount instead of a named volume is fine too: the container starts as root,
  takes the folder over and drops to `PUID:PGID`, so a host folder that root created is
  made writable before the database is opened. See
  [Troubleshooting](/operations/troubleshooting#the-container-starts-and-stops-again).
- `--cap-add NET_RAW` — needed for ICMP ping. Without it, ping sensors fall back
  to an unprivileged UDP ping, and if that is unavailable too the sensor result
  says so explicitly rather than silently reporting a failure.
- `--restart unless-stopped` — the image ships a `HEALTHCHECK`, so Docker knows
  the difference between "running" and "working" and can restart it if needed.

If you would rather not hand-write the command, `probeglass doctor` tells you
what a running installation is actually configured with — including a warning
when ping is listed as a problem and the capability is missing.

</TabItem>
<TabItem value="source" label="From source">

Requires Go 1.27 or newer. There is no frontend build step; the dashboard is
embedded from `internal/web/assets` at compile time.

```bash
git clone https://github.com/j000k3r/probeglass.git
cd probeglass
make run          # builds the binary and serves :8080, data in ./data
```

Other useful targets:

```bash
make build        # just the binary, into ./bin
make test         # the test suite
make dev          # run straight from source with debug logging
make seed         # fill ./data with demo data
make help         # everything else
```

`make build` builds for the machine you are on, which is what you want while
working on the code. It is not a second way to deploy: the container image is the
only thing ProbeGlass publishes, and this is where the Pi's `linux/arm64` and
`linux/arm/v7` come from.

`CGO_ENABLED=0` is not optional — the SQLite driver is a pure-Go translation,
which is exactly what lets the image be built for a Pi with no C toolchain in it.

</TabItem>
</Tabs>

## The image

Available architectures: `linux/amd64`, `linux/arm64`, `linux/arm/v7`.

The runtime stage is `gcr.io/distroless/static-debian12:nonroot`: no shell, no
package manager, and `USER 0:0` on top of it. It starts as root for one reason, and
gives it up again before it opens anything: a bind mount keeps the ownership of the
host folder, the platforms this gets installed on — MOS, Unraid, and the compose files
people write on top of them — create that appdata folder as root, and only root can
hand it to somebody else. So the daemon `lchown`s `/data` to `PUID:PGID` and becomes that
user, which is what makes a first install work without a `chown`. The default is
500:500, the identity every other image on those hosts uses; the three knobs are
`PUID`, `PGID` and `UMASK`, and
[Security](/concepts/security#privileges) sets out what the root moment costs and why
it is spent that way.

That drop is also why the `HEALTHCHECK` invokes the binary itself
(`probeglass healthcheck`) instead of `curl`. It also means
`docker exec ... sh` will not work — there is no shell to give you. The binary
is still there, so `docker exec -u 500:500 probeglass probeglass doctor` does:
the `-u` is the user `doctor` should measure the installation against, since `exec`
starts a new process as root.

## Building the container image

`make docker` needs **BuildKit**, because the Dockerfile pins its builder to
`--platform=$BUILDPLATFORM` and cross-compiles to the target architecture rather
than emulating it. BuildKit ships with Docker Desktop and is the default on
current Docker engines. If you installed Docker through Homebrew's `docker`
formula, it is a separate package:

```bash
brew install docker-buildx
```

Without it, the legacy builder fails with `failed to parse platform : "" is an
invalid OS component`, which is a confusing way of saying "BuildKit is not
installed". You can always use `make run`, which builds and serves the same
binary natively.

## Trying the newest build {#dev}

Everything that has landed since the last release is published as `dev`, rebuilt on
every push to `main`:

```bash
docker pull ghcr.io/j000k3r/probeglass:dev
```

It is not a release and it is not supported — but it is a real build of the real
tree, so it is what to reach for if you want to try something before it is in a
version, or to check that a fix works on your hardware before it is tagged. There is
also `sha-<commit>` for the same builds, which is what to name if one of them turns
out to be the one that broke something.

What it reports about itself says which build it is:

```bash
docker exec -u 500:500 probeglass probeglass version
# probeglass 0.2.1-4-g9c1f0ab (9c1f0ab) built 2026-10-17T08:12:44Z
```

That is the release the build follows, how many commits past it, and the commit —
the same string `make build` produces in a working tree. The line under it names the
channel, which is the same thing **Settings → Help and maintenance → About** shows and
is what tells two containers on one machine apart.

## First run {#first-run}

The first request to a fresh database redirects the dashboard to a setup screen:

<img
  src="/img/setup.png"
  alt="The setup screen: the ProbeGlass mark, a Username field, a Password field with a strength bar, a Repeat password field and a Continue button."
  width="1600"
/>

1. Open [http://localhost:8080](http://localhost:8080).
2. Choose a **username** and a **password**. The password must be at least eight
   characters; it is hashed with bcrypt at cost 12 and never stored or logged in
   plain text.
3. Answer the one question about how much interface to show — this is the
   [simple or advanced mode](/configuration/dashboard#simple-and-advanced), and
   it can be changed later.
4. You are signed in as the installation's first **administrator**. Four example
   sensors are created with it, carrying a week of invented history so the dashboard has
   something to show before you have added anything, and standing at two example
   places so that the map is not the one screen left blank. Add your first sensor —
   see [Your first sensor](/getting-started/first-sensor).

More accounts, their roles and their second factors are managed under
**Settings → Access → Users**; [Security](/concepts/security#accounts) describes what each
role may do.

To skip the interactive step in an automated deployment, set
`PROBEGLASS_ADMIN_PASSWORD` before the first start:

```bash
docker run -d --name probeglass -p 8080:8080 \
  -v probeglass-data:/data \
  -e PROBEGLASS_ADMIN_PASSWORD='correct horse battery staple' \
  ghcr.io/j000k3r/probeglass:0.2.1
```

This creates an account called **`admin`** with that password. It is read **only
when the database has no accounts yet** and is ignored on every later start; it
does not override an existing account, so leaving it in your compose file is not a
back door. Sign in as `admin` and rename or replace it once you are in.

:::warning
The setup endpoint is refused once an account exists. If you forget the password,
there is no recovery endpoint by design. Unless another administrator can reset it
for you under **Settings → Access → Users**, the way back in is to delete the rows from the
`users` table of the SQLite file directly — or, if the database holds nothing you
care about, to start from a fresh volume, which brings the setup screen back.
:::

## Next steps

- [Your first sensor](/getting-started/first-sensor)
- [Try it with demo data](/getting-started/demo-data)
- [Configuration](/configuration/)
