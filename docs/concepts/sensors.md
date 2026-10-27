---
title: Sensors
sidebar_label: Sensors
description: Every sensor type, every option each one accepts, and how validation works.
---

# Sensors

A sensor is a name, a type, a target, an interval, and a handful of options that
depend on the type. Everything is editable in the web UI, and the same objects
can be declared in [YAML](/configuration/file).

| Type | Target | What it does |
|---|---|---|
| `http` | a URL | An HTTP request, optionally asserting on the status, headers, and body |
| `redirect` | a URL | The redirect chain and the address a URL ends on |
| `tcp` | `host:port` | A connection, optionally a TLS handshake and a send/expect exchange |
| `ssh` | a host or `host:port` | The SSH identification line, so sshd is told apart from any listener |
| `smtp` | a host or `host:port` | The `220` greeting an SMTP server sends on connect |
| `imap` | a host or `host:port` | The `* OK` or `* PREAUTH` greeting an IMAP server sends |
| `udp` | `host:port` | One datagram, optionally waiting for a reply that contains a string |
| `hop` | a host or IP | One ICMP echo with a chosen TTL, naming the router or destination that answers |
| `tls` | a host or `host:port` | A TLS handshake, reporting how long the certificate is good for |
| `ping` | a host or IP | ICMP echo requests, falling back to an unprivileged UDP ping |
| `dns` | a hostname | A DNS lookup against a resolver you choose, asserting on the records |
| `docker` | a container name | The state, health and restart count of a container on this host |
| `snmp` | a host or `host:port` | One OID from a switch, router or NAS, checked against a value you set |

In the dashboard the types are grouped as **Web**, **Network**, **Services** and
**Infrastructure**, in a chooser with a search field rather than a long
dropdown. The options each type adds are chips, so the choice that is switched
off — "leave it at the default" — is visible beside the ones that are not. The
group, place and **Depends on** fields use the same kind of picker: the group
search names a new group when the word is not there yet, sites are grouped by
kind, and the other sensors are listed with the status each one has right now.

## ⚙️ Common settings {#common-settings}

These apply to every type.

| Setting | Default | Bounds | Meaning |
|---|---|---|---|
| `interval` | 60 | ≥ 5 | Seconds between probes |
| `timeout` | 10 | 1–600 | Seconds before a probe is abandoned and counted as failed |
| `retries` | 1 | ≥ 1 | Consecutive failures before an incident opens and alerts fire |
| `group` | — | | Free-text label; sensors in a group are drawn together |
| `tags` | — | | Labels for filtering and search; their symbol, colour and order are set under Settings → Monitoring → Tags |
| `reminder_every` | 0 | ≥ 0 | Seconds between repeat alerts while a sensor stays down; 0 disables them |
| `enabled` | true | | A disabled sensor is not probed and shows as Paused |
| `channels` | — | | Which [alert channels](/concepts/alerts) this sensor notifies |

Values outside those bounds are clamped on save rather than rejected, so a
generated configuration file with `interval: 1` produces a sensor that runs every
five seconds instead of a pile of overlapping probes.

### 🔁 About retries {#about-retries}

`retries` is a debounce, not a retry. ProbeGlass does not re-run a failed probe
immediately — it counts *consecutive scheduled failures* and opens an incident
when the count reaches the threshold. With `interval: 60` and `retries: 3`, a
service that goes down at 12:00:20 is reported at 12:02:20, and a single dropped
packet at 03:00 never wakes you up.

While a sensor is in the failure streak but below the threshold, its status is
**Flaky** — a yellow pill, not a green one and not a red one. That is deliberate:
the honest answer to "is it up?" at that moment is "the last probe failed and it
has not failed often enough to say it is down", and showing green would be a lie.
Flaky opens no incident and sends no alert: the incident log is for outages, and a
message per dropped packet is noise. It is still on the dashboard, so a sensor that
flaps without ever reaching its threshold is visible rather than silent.

**Pending** is the fourth thing the pill can say and means something narrower: the
sensor has never been probed, so there is nothing to report yet. That is what a
freshly created sensor reads for the seconds before its first probe.

## 🌐 `http` {#http}

Target: a full URL, including the scheme.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `method` | string | `GET` | Request method |
| `expected_status` | string | `200-399` | Accepted status. `200`, `200-299`, `2xx`, or a comma-separated list |
| `headers` | object | | Extra request headers |
| `user_agent` | string | — | Overrides the User-Agent header |
| `basic_auth_user`, `basic_auth_pass` | string | — | HTTP basic authentication |
| `bearer_token` | string | — | `Authorization: Bearer …` |
| `body` | string | — | Request body, for POST/PUT/PATCH |
| `body_contains` | string | — | Fail unless the response body contains this substring |
| `body_not_contains` | string | — | Fail if the response body contains this substring |
| `body_regex` | string | — | Fail unless the response body matches this regular expression |
| `expected_headers` | object | — | Response headers that must each contain a given substring |
| `max_body_bytes` | int | `262144` | How much of the body to read |
| `follow_redirects` | bool | `true` | Set false to treat a redirect as the answer |
| `insecure_skip_verify` | bool | `false` | Accept self-signed certificates. **Per sensor, never global** |
| `cert_warn_days` | int | — | Fail when the certificate expires within this many days |

`body_contains` and `expected_status` together are what turn a liveness sensor
into one that means something. A reverse proxy whose backend is dead usually
returns `200 OK` with an error page; only the body assertion catches that.

`insecure_skip_verify` exists because self-signed certificates are normal in a
homelab. It is never enabled globally and never inferred — if you want it, you
ask for it on that sensor, and the setting is visible in the sensor's own
configuration, not hidden in a global switch.

```yaml
- name: Home Assistant
  type: http
  target: https://ha.lan:8123/manifest.json
  interval: 60s
  options:
    insecure_skip_verify: true
    body_contains: '"name":"Home Assistant"'
```

## ↪️ `redirect` {#redirect}

Target: a full URL, including the scheme.

Walks the redirects itself rather than following them silently, and reports the
codes and the address it ends on: `301 → 302 → 200 · final https://example.org/`.
The ordinary `http` sensor either follows the chain or treats the first redirect
as the answer; this one exists for the question where an address actually ends up,
which is what notices a domain move or a captive portal in front of a page.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `max_hops` | int | `10` | Redirects to follow, 1–30; a longer chain fails |
| `expected_final` | string | — | Fail unless the final URL contains this substring |
| `expected_status` | string | `200-299` | Accepted status of the final response |
| `insecure_skip_verify` | bool | `false` | Accept self-signed certificates |

```yaml
- name: Website redirect
  type: redirect
  target: https://example.org
  interval: 15m
  options:
    expected_final: https://example.org/
```

## 🔌 `tcp` {#tcp}

Target: `host:port`.

| Option | Type | Meaning |
|---|---|---|
| `tls` | bool | Perform a TLS handshake after connecting |
| `server_name` | string | SNI and verification name, when it differs from the target host |
| `insecure_skip_verify` | bool | Accept self-signed certificates when `tls` is on |
| `send` | string | Text to write after connecting. `\r` and `\n` are expanded |
| `expect` | string | Fail unless the response contains this substring |

`send`/`expect` covers the protocol-aware sensors that a bare port sensor cannot:
SMTP, IMAP, MQTT, PostgreSQL, and anything else that greets you with a banner.
The response is read until `expect` is found or the timeout expires.

```yaml
- name: SMTP greeting
  type: tcp
  target: mail.lan:25
  interval: 5m
  options:
    expect: "220 "
```

## 🔑 `ssh` {#ssh}

Target: a hostname, or `host:port`. A bare hostname means port 22.

Connects and reads the identification line an SSH server sends before any
handshake, for example `SSH-2.0-OpenSSH_9.6p1`. That line is enough to tell "sshd
is answering" from "something is listening on port 22". Lines some appliances send
before the identification line are skipped, as RFC 4253 allows.

| Option | Type | Meaning |
|---|---|---|
| `expect` | string | Fail unless the banner contains this substring, for pinning a version |

```yaml
- name: NAS SSH
  type: ssh
  target: nas.lan
  interval: 5m
  options:
    expect: OpenSSH
```

## ✉️ `smtp` {#smtp}

Target: a hostname, or `host:port`. A bare hostname means port 25.

Reads the greeting an SMTP server sends on connect; RFC 5321 says it begins with
`220`. `tls` opens the connection over implicit TLS, as port 465 does — it does
not perform STARTTLS.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `tls` | bool | `false` | Connect over implicit TLS |
| `server_name` | string | the target's host | SNI and verification name |
| `insecure_skip_verify` | bool | `false` | Accept self-signed certificates when `tls` is on |
| `expect` | string | — | Fail unless the greeting contains this substring |

## 📬 `imap` {#imap}

Target: a hostname, or `host:port`. A bare hostname means port 143; use `tls`
for port 993.

Reads the untagged greeting an IMAP server sends on connect. RFC 3501 allows
`* OK` and `* PREAUTH`; `* BYE` is a failure.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `tls` | bool | `false` | Connect over implicit TLS |
| `server_name` | string | the target's host | SNI and verification name |
| `insecure_skip_verify` | bool | `false` | Accept self-signed certificates when `tls` is on |
| `expect` | string | — | Fail unless the greeting contains this substring |

## 📤 `udp` {#udp}

Target: `host:port`.

Sends one datagram and, when `expect` is set, waits for a reply containing it. UDP
has no handshake, so without `expect` the probe can only report that the packet
left — not that anything is listening. With it, the check is real: DNS over UDP, a
status reply from a game server, a collector that answers.

| Option | Type | Meaning |
|---|---|---|
| `payload` | string | Bytes to send. `\r` and `\n` are expanded; empty sends an empty datagram |
| `expect` | string | Fail unless a reply contains this substring; empty does not wait for one |

The socket is connected, so an ICMP port-unreachable is reported as a probe
failure when a reply is awaited.

```yaml
- name: UDP echo service
  type: udp
  target: 192.168.1.5:9999
  interval: 60s
  options:
    payload: PING
    expect: PONG
```

## 🔒 `tls` {#tls}

Target: a hostname, or `host:port`. A bare hostname means port 443.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `server_name` | string | the target's host | The name to send as SNI and to verify the certificate against |
| `cert_warn_days` | int | `14` | Fail when fewer days are left; `0` switches the check off |
| `insecure_skip_verify` | bool | `false` | Accept any certificate; the message then says the check was skipped |

HTTP and TCP sensors read a certificate as well, so this type adds no capability —
it is the place to say that the certificate *is* the subject. The probe connects,
completes a handshake, and reads the leaf certificate; the message carries the
remaining days, and a certificate that has already run out fails whatever
`cert_warn_days` says.

The three ways a certificate can be wrong are reported separately, because they
are fixed in three different ways: a name that does not match the one you asked
for, a certificate that has expired or is not valid yet, and an issuer this host
does not trust — the last being the usual self-signed homelab appliance, which is
what `insecure_skip_verify` is for.

```yaml
- name: Home Assistant certificate
  type: tls
  target: ha.lan:8123
  interval: 6h
  options:
    cert_warn_days: 21
```

## 🐳 `docker` {#docker}

Target: a container name or id on the host whose Docker socket is mounted into
the ProbeGlass container.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `socket` | string | `/var/run/docker.sock` | Path to the Docker socket |
| `expect_running` | bool | `true` | Set false to watch a container that is supposed to be stopped |
| `expect_health` | string | `healthy` | `healthy`, `starting`, or `unhealthy`; empty switches the check off |
| `max_restarts` | int | `0` | Fail above this many restarts; `0` switches the check off |

The probe asks the Docker Engine API for one container's inspect output and reads
four things from it: whether it is running, what state it reports, what its health
check last said, and how often it has restarted. The restart count is in the
message on every probe, whether or not you set a limit — seeing the number is what
tells you the limit is worth setting.

`expect_health` is on by default, and it needs a container with a `HEALTHCHECK`.
Most containers have none, and such a container can never report `healthy`, so it
is reported down with the reason spelled out — together with the name of the
option that switches the check off.

A socket that is missing or unreadable fails the probe with a message that says
which it is, rather than failing to save the sensor: the socket belongs to the
host, and it may well not be there while you are writing the sensor.

:::warning
Mounting the Docker socket gives the container root on the host. Read
[The Docker socket is root on the host](/concepts/security#docker-socket) before
you do, and check that it is what you want.
:::

```yaml
- name: Home Assistant container
  type: docker
  target: homeassistant
  interval: 60s
  options:
    max_restarts: 3
```

`expect_health` is absent above for that reason: the example watches whether the
container is up and how often it has restarted, and asks nothing of a health check
that may not exist. In the dashboard the same choice is the empty entry in the
health chips, the first one labelled "only check that it runs".

## 📡 `snmp` {#snmp}

Target: a hostname or IP, optionally with a port — a bare host means port 161.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `oid` | string | — | The object to ask for, dotted. **Required** |
| `community` | string | `public` | v1/v2c community string. A shared secret, masked in the API |
| `version` | string | `2c` | `2c`, `1` or `3` |
| `username` | string | — | v3 user name, required for version 3 |
| `security_level` | string | `authPriv` | v3: `noAuthNoPriv`, `authNoPriv` or `authPriv` |
| `auth_protocol` | string | `SHA` | v3: `MD5`, `SHA`, `SHA-224`, `SHA-256`, `SHA-384`, `SHA-512` |
| `auth_pass` | string | — | v3 authentication passphrase, masked in the API |
| `priv_protocol` | string | `AES` | v3: `DES`, `AES`, `AES-192`, `AES-256` |
| `priv_pass` | string | — | v3 privacy passphrase, masked in the API |
| `context_name` | string | — | v3 context, usually empty |
| `expect` | string | — | Fail unless the value contains this substring |
| `min`, `max` | number | — | Bounds a numeric value must lie within |

This is one `GET` of **one OID**. No walk and no traps — a switch, a router or a
NAS answers "how warm is the CPU", "how long has it been up" and "how much ink is
left" with a single request each, and that is the whole job. A walk enumerates a
device's entire MIB, which is a different tool with a different cost, and it is not
this one.

Version 3 adds a user, authentication and, with `authPriv`, encryption. The form
shows only the fields the chosen version and security level use; an empty version
means 2c and an empty security level means `authPriv`, the same defaults the prober
uses. v1 is there for equipment old enough to refuse 2c, and nothing else.

The community and both v3 passphrases have a **Generate** button: it makes 128
random bits as hex, shows the value and copies it, so it can be entered on the
device and in the sensor in the same step. The same button appears on an HTTP
basic-auth password and on a generic webhook's HMAC secret.

You must give at least one of `expect`, `min` or `max`. That the agent answered at
all is what a `ping` already tells you, so the value has to be judged against
something you wrote down, or the sensor is a liveness check wearing a number.

OIDs are written as dotted numbers — `1.3.6.1.2.1.1.3.0` is uptime. Names such as
`sysUpTime.0` are refused: resolving a name needs a MIB file, and a tool that
quietly guesses at one quietly watches the wrong thing. Values are shown as they
arrive; non-printable ones (a MAC address is six raw bytes) are shown as hex rather
than as punctuation soup, and uptime is shown as `1h 11m` as well as raw.

:::warning
SNMP v2c is unauthenticated and the community string travels in clear text. Use it
on a trusted network only, and prefer v3 with `authPriv` where the device supports
it — see [SNMP v2c sends the community in clear
text](/concepts/security#snmp-v2c).
:::

### Device templates

The sensor catalogue carries a template library: **QNAP**, **Synology**, **UniFi**,
**APC UPS**, **MikroTik**, **pfSense/OPNsense**, **Proxmox**, **TrueNAS**, printers
and a generic **HOST-RESOURCES** set for almost anything else. The templates are
filtered by vendor, system and what they watch (availability, CPU, temperature,
storage, power), and the detail view names the MIB or community template the OIDs
were checked against.

Choosing one asks for the device's address and SNMP credentials. **Check device**
makes one real SNMP request before anything is created: the box answers with its
own `sysDescr`, so a wrong address, a wrong community or the wrong vendor's
template is visible before a dozen sensors exist. The checks are then ticked (all
of them by default) and created as ordinary sensors in one group, in one
transaction. Nothing is hidden afterwards: every sensor has the same options as one
made by hand, and a vendor OID that differs on your firmware is edited, not worked
around.

The QNAP and Synology templates carry disk 1–4 temperatures as separate checks. A
NAS with more or fewer bays is a matter of unticking and adding one by hand; the
template does not guess at a table it has not walked.

Some vendor OIDs were cross-checked against the community [PRTG Device
Templates](https://gitlab.com/PRTG/Device-Templates) (BSD-3-Clause); the
**Source** line in a template's detail view names the MIB or template its numbers
came from.

### Application templates and MOS

A template does not have to be SNMP. Its checks may be HTTP, TCP or ping, each
with a target pattern: `{address}` is what you typed and `{host}` is its host
without a scheme or port, so one template can request
`http://{address}:8123/` or `{host}:1883`. A template may also ask for a
credential such as an API token; it is stored with the created sensors and masked
in the API like every other secret.

**MOS NAS OS** is one of these. It uses the MOS API under `/api/v1`, authenticated
with a Bearer token:

1. Create an admin token in MOS — **Settings → API tokens**, or
   `POST /api/v1/auth/admin-tokens` — and copy it.
2. Apply the **MOS NAS OS** template, enter the NAS address (with `:998` if the API
   is on its own port) and paste the token.
3. The template checks `system/load`, `disks` and `pools`, and offers the UPS
   status from `nut/status` unticked, because not every NAS has NUT configured.

The same pattern covers the homelab applications in the catalogue: Home
Assistant, Pi-hole, AdGuard Home, Grafana, Portainer, Jellyfin, Uptime Kuma,
Node-RED, Mosquitto and Shelly. A template's first check is what **Check device**
runs, so a wrong port or token is visible before the sensors are created.

Vendor OIDs are a starting point, not a promise. UniFi's MIB, for example, has no
CPU, memory or temperature objects, and not every firmware answers its private
uptime object — so that template asks the standard uptime OID and adds an ICMP
check, leaving the rest to the controller.

```yaml
- name: Switch is the model I think it is
  type: snmp
  target: 192.168.1.2
  interval: 5m
  options:
    oid: 1.3.6.1.2.1.1.1.0
    community: homelab-ro
    expect: RB5009
```

## 📡 `ping` {#ping}

Target: a hostname or IP address.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `count` | int | `3` | Echo requests per probe, up to 20 |

The sensor tries an unprivileged datagram ICMP socket first and falls back to a
raw socket. In a container this is where things go wrong most often: without
`NET_RAW`, and with `net.ipv4.ping_group_range` not covering the container's uid,
neither socket can be opened. When that happens the sensor fails with a message
saying precisely which socket it tried and what the kernel said, rather than a
bare timeout that sends you looking at the network.

Two failures that used to read the same are told apart, because they send you to
different places: a probe that **left this host** and got nothing back says
`no ICMP reply from … (3/3 lost)` and the network is the suspect, while a probe whose
socket **refused to send at all** says `could not send ICMP to …` and names the
kernel's reason — with the `NET_RAW` hint appended when that is what it was.

## 🛣️ `hop` {#hop}

Target: a hostname or IP address.

Sends one echo request with a chosen time-to-live and reports what answered. A TTL
of 1 asks the first router; a larger one asks the router that many hops away, and a
packet that reaches the destination answers as itself.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `ttl` | int | `1` | Time-to-live to send with, 1–255 |

A router whose TTL ran out answers with ICMP Time Exceeded, and that answer is the
success of the probe: the hop exists and named itself. The message says either
`hop 3 · 192.168.1.1 · time exceeded` or `hop 3 · reached 1.1.1.1`.

This sensor needs a raw ICMP socket, which means `CAP_NET_RAW` in the container —
the same capability ping sensors use. Unlike ping, it cannot fall back to an
unprivileged datagram socket: the router's address is in the Time Exceeded message,
and a ping socket does not hand that message over. Without the capability the probe
says so and names it.

```yaml
- name: First hop
  type: hop
  target: 1.1.1.1
  interval: 60s
  options:
    ttl: 1
```

## 🧭 `dns` {#dns}

Target: a hostname to look up.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `record_type` | string | `A` | `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `NS`, `SRV`, or `PTR` |
| `resolver` | string | system | `1.1.1.1` or `192.168.1.1:53` — the server to ask |
| `expected` | string | — | Comma-separated substrings the answers must contain |
| `expect_all` | bool | `false` | Require every item in `expected`, not just one |

Queries are built with `golang.org/x/net/dns/dnsmessage` rather than the system
resolver, so the sensor asks a server you name and inspects the records that
actually came back. That is the difference between "DNS works" and "this
internal name resolves to the address I expect from the resolver my clients
use":

```yaml
- name: Nextcloud resolves internally
  type: dns
  target: cloud.lan
  interval: 5m
  options:
    resolver: 192.168.1.1:53
    record_type: A
    expected: 192.168.1.42
```

## ✅ Validation {#validation}

Every engine validates its own target and options, and the server runs the same
validation when you save. The **Test** button in the sensor form additionally
probes once and shows you the real latency, status code, and message.

A malformed option does not fail the sensor silently.

<details>
<summary>What happens to an option of the wrong type</summary>

Options are read through typed accessors that fall back to the default for
anything missing or of the wrong type, so a sensor saved by an older version
keeps working — a `count` that arrives as a string becomes the default rather
than becoming zero. Anything that is a genuine configuration error is reported
at the point you can fix it.

</details>

## 📄 Sensors from the configuration file {#sensors-from-the-configuration-file}

A sensor declared in the YAML configuration is marked **managed** in the UI: its
edit, pause, reorder, and delete buttons are disabled, because the file wins.
It is re-applied on every start, so a rebuild from zero restores the whole
monitoring setup in seconds. See
[Declarative sensors and channels](/configuration/file#declarative-sensors-and-channels).
