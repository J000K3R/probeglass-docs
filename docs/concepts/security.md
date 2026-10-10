---
title: Security
sidebar_label: Security
description: The authentication model, how secrets are kept out of the API and the logs, and the deliberate choices that make this safe on a home LAN.
---

# Security

Weatherglass is a homelab tool, and its security model is built for that: it
assumes a trusted network and an untrusted browser, and it is explicit about what
it does and does not protect.

## 🔑 Accounts {#accounts}

Weatherglass has accounts. A fresh install asks for a **username and a
password**, and that first account is an administrator. Everything after that —
more people, their roles, their second factor — is managed under
**Settings → Access → Users**.

<img
  src="/img/login.png"
  alt="The sign-in screen: the Weatherglass mark, a username field, a password field and a Sign in button."
  width="1600"
/>

### Roles

Three roles, and the difference between them is what they may *change*, never
what they may *read*:

| Role | May |
|---|---|
| **Viewer** | read everything: the dashboard, history, incidents, channels, settings — and change its own appearance, language and password |
| **Operator** | and acknowledge and un-acknowledge incidents, run a check on demand, pause and resume a sensor, run the doctor |
| **Admin** | and create, edit and delete sensors and channels, rotate the API key, manage accounts, and remove the sample data |

Every request re-reads the account row, so a role change, a disabled account or a
deleted account takes effect on the **next request** — not on the next sign-in.
There is no cache to wait out, and "disable this account" is a statement about
what happens now rather than about what happens in a month.

Two rules protect an installation from locking itself out, and both live in the
store rather than in a handler, so a direct API call meets them too: the **last
active administrator** cannot be deleted, demoted or disabled, and **nobody can
delete or disable themselves**.

### Passwords

Hashed with bcrypt at cost 12. The plaintext is never stored, never logged, and
never returned by any endpoint. Login attempts are limited to five per minute,
counted in memory per process.

`POST /api/setup` runs exactly once, and only while there are no accounts at all.
Once one exists the endpoint refuses — there is no "set the password again" path
over HTTP, because that would be a way in for anyone who can reach the port.

There is no password recovery. If you lose it, see the note in
[Installation](/getting-started/install#first-run).

Changing your own password signs out your other sessions and leaves everyone
else's alone: it is your account, not the installation's.

### Two-factor authentication

Available per account, set up under **Settings → Access**: scan the QR code with
any TOTP app, confirm with a code, and the account is protected. The parameters
are the ordinary ones — HMAC-SHA1, six digits, a thirty-second step, ±1 step of
drift — so every authenticator app works.

```
<img src="/img/two-factor.png" alt="Enrolling a second factor: the QR code, the secret in text and the confirmation field." width="900">
```

A code that has been used is not accepted a second time. Without that rule a code
read over somebody's shoulder, or from a screenshot, would stay valid for the
rest of its thirty seconds.

**Recovery codes.** Enrolling hands you eight one-time codes, shown exactly once:

```
<img src="/img/recovery-codes.png" alt="Eight one-time recovery codes with a button to copy all of them." width="900">
```

Write them down or put them somewhere safe before closing the dialog — these are
the only copies and they cannot be shown again. A code is sixteen characters in
four groups, and it is stored as a SHA-256 hash rather than a bcrypt one. That is
deliberate and it costs nothing: the code is eighty bits taken straight from the
kernel, so there is no guessable password for a slow hash to defend, while eight
bcrypt comparisons on every recovery sign-in would add two seconds to protect
nothing. Each code works once: using one marks it used, and the account page then
says how many are left. Losing them is not fatal; generating a new set under
**Settings → Access** invalidates the old one.

An administrator can also reset somebody's password from **Settings → Access → Users**,
which signs that person out everywhere.

## 🔑 Authentication {#authentication}

Two ways in:

**Session cookie.** `weatherglass_session`, whose value names the account it
belongs to and is signed with a secret generated on first start. `HttpOnly`,
`SameSite=Strict`, and **deliberately without `Secure`** — homelab installs are
usually plain HTTP on the LAN, and a `Secure` cookie on an HTTP origin is a cookie
the browser silently refuses to send, which presents as "the password works but
nothing happens".

:::warning
If you terminate TLS at a reverse proxy, nothing changes: the cookie still has no
`Secure` flag. That is intentional, so that the same build works behind HTTP and
HTTPS — but it does mean the cookie travels in clear text on a plain-HTTP LAN.
If that matters to you, either keep the dashboard on a trusted VLAN or put a TLS
proxy in front and reach it only over HTTPS. See
[Running behind a reverse proxy](/operations/reverse-proxy).
:::

**API key.** A generated key sent as `X-API-Key: …` or
`Authorization: Bearer …`. Intended for scripts, cron jobs, and Home Assistant.
Generate, rotate, and remove it under **Settings → Access → API key**. Rotating
invalidates the old key immediately.

:::warning
The key has **no account behind it, and it is an administrator.** That is the
whole point — a script has to be able to create a sensor — and it means the key
is worth exactly as much as an administrator's session, with one exception: a
disabled account is locked out at once, and the key is not tied to an account and
so is not affected by any of that. Treat it like a root password: in a secret
store, not in a shell history, and rotated when anyone who had it leaves.
:::

### Cross-site protection

Cookie-authenticated **writes** are additionally checked against `Origin`,
falling back to `Referer`, and must match the host the request arrived at. With
`SameSite=Strict` on the cookie, that closes the two ways a page on another site
could try to drive the API.

Requests with no `Origin` header at all — curl, a script, a cron job — pass the
sensor. They carry no ambient cookie, so there is no confused-deputy problem to
solve, and they are already covered by the API key.

## 🤫 Secrets {#secrets}

Credentials are the thing a monitoring tool is most likely to leak, because it
holds a lot of them: chat bot tokens, webhook URLs with embedded secrets, HMAC
keys, and the dashboard password.

**They never leave the server.** A channel's fields carry a `Secret` flag in the
server's own definition of that channel type. On the way out, every field so
flagged is replaced with a marker. The UI shows the marker; a request that sends
the marker back keeps the stored value rather than overwriting the credential
with the literal string. A channel can therefore be edited without retyping its
token — and the token is never in an HTTP response, so it is never in a browser
cache, a proxy log, or a screenshot.

:::note
One exception, and it is a deliberate one: `GET /api/settings` returns the **API
key** in clear text to an administrator, because the Settings screen has to
display it. It is left out entirely for anyone below that, so a viewer is never
handed a credential they cannot use — but it does mean an administrator's session
cookie is worth an API key, and that a screenshot of the Settings tab taken by an
administrator is a credential.
:::

**They are stripped from errors.** The Telegram API puts the bot token in the URL
of every request, so a naive `%v` on a failed request prints it. The Telegram
sender removes the token from error messages before they reach a log line or the
UI. Bot tokens end up in bug reports and pasted into chat rooms more often than
anyone would like.

**The image is minimal.** Distroless, no shell, no package manager, running as
uid 65532. There is no interpreter in the container to pivot to, and
`docker exec ... sh` does not work because there is no shell.

## 💾 The backup file carries secrets in the clear {#backup-secrets}

**Settings → Backup** writes the installation into one JSON document: the
settings, the sites, the sensors, the channels and the accounts, plus the history
if you ask for it. That document names every secret the installation holds.

| In the file, in clear text |
|---|
| every account's password hash, TOTP secret and recovery-code hashes |
| the **API key** |
| every channel's credentials: the Telegram bot token, the Discord and Slack webhook URLs, the Matrix access token, the ntfy token, a webhook's HMAC secret |
| the community string of every SNMP sensor |
| the map's tile URL |

This is the one place where a stored secret is written out **unmasked**, and the
reason is the same reason the masking exists at all. Everywhere else a secret is
replaced on the way out with `__stored__`, so that a channel's token never reaches
a browser that already holds the channel. A backup written that way would restore
a channel whose token reads `__stored__`: the file would import cleanly, the
channel would appear under the right name with the right type, and it would fail
to send anything — which nobody would notice until the first outage, the exact
moment the backup was taken for. **A backup with masked credentials is not a
backup.** So the secrets travel, the panel that produces the file says so in the
same words, and this page says so here.

What Weatherglass does about it:

- **Both directions are administrator-only.** Only an admin can download the file
  or restore one. A viewer and an operator cannot obtain any of this over the API.
- **The download can only ever become a file.** It is served as
  `application/json` with `Content-Disposition: attachment` and
  `X-Content-Type-Options: nosniff`, so a browser saves it rather than rendering
  it, and cannot be persuaded to run it as a page or a script. The filename is
  built on the server from a constant and the date — never from the request. The
  response is marked `Cache-Control: no-store`.
- **Nothing you send becomes part of the file.** It is assembled table by table
  from the server's own structures and streamed straight out.
- **The contents never reach a log line.** `backup exported` and
  `backup restored` record how many rows of each table moved and nothing else —
  the same rule the Telegram bot token already follows, where the URL holding it is
  never logged.
- **A restore looks before it writes.** The format marker and the format and
  schema versions are checked first. A file that is not a Weatherglass backup, or
  one written by a newer version, is refused with a message saying why, and nothing
  is touched.
- **A restore takes a safety copy first.** A byte-exact `VACUUM INTO` copy is
  written beside the database before anything is replaced, and a restore whose
  safety copy fails does not go ahead. That copy is the way back if the file turns
  out to lock you out.

:::warning
Treat the backup file exactly as you treat the database file itself: not in a
chat, not in an issue, not in a ticket, not in a cloud drive you do not control,
and not in a git repository. If one leaks, everything in it is compromised at once
— rotate the API key, rotate each channel's token, and have everyone change their
password and re-enrol their second factor.
:::

Two more things the file carries that are easy to overlook:

- **The session epochs come with it.** A session names the account it belongs to
  and an epoch, and the epoch is in the backup like everything else. Restoring a
  *newer* backup into an *older* database therefore brings back sessions that were
  signed out in between. "Sign out everywhere" is not a defence against a file
  somebody already holds.
- **Restoring a file from a different installation overwrites by name.** Sensors,
  sites and channels are matched by name, because a name is what a sensor is in
  this program — the same name in another installation is a different thing that
  happens to be called the same. Restore into a fresh data directory unless you
  mean to replace what is there.

## 🐳 The Docker socket is root on the host {#docker-socket}

Docker container sensors read the Docker Engine API over `/var/run/docker.sock`.
That socket is the daemon's control channel, not a monitoring API with a
monitoring-shaped permission model: anyone who can talk to it can ask the daemon
to start a container with the host's root filesystem mounted inside it. Mounting
the socket into a container is, in practice, the same as giving that container
root on the host.

It is stated this plainly because it is a decision to make knowingly. Weatherglass
itself is careful with it:

- The prober makes **one GET per probe**, `GET /containers/{target}/json`, and
  reads the container's name, state and restart count. It never starts, stops,
  restarts, removes or execs into anything.
- It speaks HTTP over the socket with the Go standard library. There is no Docker
  client library in the dependency tree that could reach further by accident, and
  no code path that picks the HTTP method.
- A missing or unreadable socket is a probe failure with a message that says which
  of the two it is. There is no fallback.

What that does not buy you:

- A read-only mount (`:ro`) does not restrict what can be sent over a socket you
  can already open.
- The socket raises what a compromise is worth. An administrator session or the
  API key can already rewrite the configuration; with the socket mounted, code
  running inside the container also reaches the host.
- The prober's restraint is a property of this program. Another process in the
  same namespace is not bound by it.

So: mount it if you want to watch containers, leave it out otherwise, and if you
want the middle ground, put a socket proxy in front that allows only the read
endpoints. The `docker-compose.yml` in the repository carries the plain mount
commented out with the same warning, so switching it on is a deliberate edit
rather than something you inherit by copying the file.

## 📡 SNMP v2c sends the community in clear text {#snmp-v2c}

SNMP sensors speak v2c. v2c has **no authentication at all**: the community
string — `public` by default, and a shared secret wherever it is set to anything
else — travels in the clear in every packet, and the answer is neither signed nor
encrypted. Anyone on the path can read it, and anyone holding it can ask the agent
whatever its own access list allows. Version 3 exists to fix exactly this and is
deliberately not implemented, so if the device needs authenticated SNMP, this
sensor is not the one.

:::warning
Use SNMP sensors on a trusted network only. A homelab LAN is the intended place;
a routed, shared or wireless network is not. If the community matters, treat it as
compromised the moment it crosses one.
:::

Within that limit, Weatherglass does the parts it can:

- The community is treated as a credential. It carries the `Secret` flag, so it is
  masked in the API like a bot token and never reaches the UI, a stored result or
  a log line. The probe's message reports the OID and the value, never the
  community.
- Nothing is written to the device. The prober issues one `GET` of one OID and
  never a `SET`, and it does not walk the MIB.
- Only what the operator asked for is read: one OID, judged against a substring or
  a numeric range the operator wrote down.

## 🗺️ Map tiles are fetched by the browser {#map-tiles}

The map view draws its background from ordinary raster tiles, and **the browser
fetches them directly from the tile server**. Weatherglass does not proxy them.
The daemon never talks to a tile server, and no tile ever passes through it.

That is a deliberate choice with a privacy cost, so it is stated plainly rather
than buried: whoever runs the tile server sees the **IP address** of the person
looking at the dashboard, their **browser's user agent**, and the **approximate
part of the map** they have panned to — which, on a dashboard folded by place, is
close to "where their homelab is". On a phone away from home that is a third party
learning that this dashboard exists.

The default is OpenStreetMap, which needs no account and no key and is run as a
public service. That is the right trade for a homelab on a home network. It is not
the right trade for a fleet of sites somebody else owns.

:::warning
If the map's subject is somebody else's infrastructure, or if the dashboard is
reachable from outside, **run a tile server inside your own network** and put its
address under **Settings → Look → Map**. The tiles then never leave your network, and the
dashboard's content security policy does not need to be widened at all — the
server is same-origin, which `'self'` already covers.
:::

### How the tile origin reaches the content security policy {#csp-tiles}

The dashboard is served with a content security policy that restricts images to
`'self'` and `data:`. A remote tile server would therefore be blocked **silently**:
the map would simply be empty, with nothing in the console pointing at the cause.
So the origin of the configured tile URL is appended to the policy's `img-src`.

The origin is resolved **once** — at start-up, and again whenever the tile URL is
saved — and cached on the server rather than read from the database per request.
Saving a new tile URL therefore takes effect without a restart, and serving a page
never costs a database read. A same-origin tile URL adds nothing to the policy,
because `'self'` already allows it.

Two consequences worth knowing:

- The policy permits the **origin**, not the exact URL. Point your tiles at a host
  that serves anything else and the browser may fetch that too — the same trust you
  extend to any server you name in a setting.
- The tile URL is an **installation-wide, administrator-only** setting, unlike the
  appearance preferences, which every account owns for itself. A viewer cannot
  point the map at a server of their choosing.

The URL is checked before it is stored: it must be `http` or `https`, and it must
contain `{z}`, `{x}` and `{y}`. A URL without them is refused rather than accepted
and quietly broken.

## 🔐 Transport security, honestly {#transport-security-honestly}

Two settings exist because sometimes the certificate really is the problem:

- `insecure_skip_verify` on an HTTP or TCP sensor accepts self-signed
  certificates. It is **per sensor, off by default, never inferred and never
  global**. If you need it, you ask for it on that sensor, and the setting is
  visible in that sensor's own configuration.
- `cert_warn_days` does the opposite: it fails the sensor when the certificate is
  within N days of expiry, turning certificate renewal from a surprise into a
  scheduled task.

There is no global "ignore certificate errors" switch, because there should not
be one.

## ⚠️ What is not protected {#what-is-not-protected}

To be clear about the boundaries:

- **The traffic is plain HTTP by default.** Anything on the network path can read
  it, including the session cookie after login.
- **The health endpoint is unauthenticated.** `GET /healthz` answers without a
  session, so a container orchestrator can use it. It returns a status and
  nothing else.
- **There is no multi-tenancy.** Several people can have accounts on one
  installation, with different roles — but they all see the same sensors, the same
  history and the same incidents. Weatherglass assumes one homelab and one group of
  people who trust each other with it. Isolating two organisations from each other
  is a different product.
- **The database is not encrypted.** It is a SQLite file. If your threat model
  includes someone with the disk, use full-disk encryption.
- **Login rate limiting is per process and in memory.** It is a speed bump
  against casual guessing, not a defence against a distributed attack.

If any of those are wrong for your deployment, the fix is a reverse proxy with
TLS and an IP allowlist in front of Weatherglass, which is two lines of nginx
configuration. See [Running behind a reverse proxy](/operations/reverse-proxy).

## 🐛 Reporting a vulnerability {#reporting-a-vulnerability}

Please do not open a public issue for a security problem. See
[SECURITY.md](https://github.com/j000k3r/weatherglass/blob/main/SECURITY.md)
in the repository for how to report it privately.
