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
| `tcp` | `host:port` | A connection, optionally a TLS handshake and a send/expect exchange |
| `tls` | a host or `host:port` | A TLS handshake, reporting how long the certificate is good for |
| `ping` | a host or IP | ICMP echo requests, falling back to an unprivileged UDP ping |
| `dns` | a hostname | A DNS lookup against a resolver you choose, asserting on the records |
| `docker` | a container name | The state, health and restart count of a container on this host |
| `snmp` | a host or `host:port` | One OID from a switch, router or NAS, checked against a value you set |

## ⚙️ Common settings {#common-settings}

These apply to every type.

| Setting | Default | Bounds | Meaning |
|---|---|---|---|
| `interval` | 60 | ≥ 5 | Seconds between probes |
| `timeout` | 10 | 1–600 | Seconds before a probe is abandoned and counted as failed |
| `retries` | 1 | ≥ 1 | Consecutive failures before an incident opens and alerts fire |
| `group` | — | | Free-text label; sensors in a group are drawn together |
| `tags` | — | | Free-text labels for filtering and search |
| `reminder_every` | 0 | ≥ 0 | Seconds between repeat alerts while a sensor stays down; 0 disables them |
| `enabled` | true | | A disabled sensor is not probed and shows as Paused |
| `channels` | — | | Which [alert channels](/concepts/alerts) this sensor notifies |

Values outside those bounds are clamped on save rather than rejected, so a
generated configuration file with `interval: 1` produces a sensor that runs every
five seconds instead of a pile of overlapping probes.

### 🔁 About retries {#about-retries}

`retries` is a debounce, not a retry. Weatherglass does not re-run a failed probe
immediately — it counts *consecutive scheduled failures* and opens an incident
when the count reaches the threshold. With `interval: 60` and `retries: 3`, a
service that goes down at 12:00:20 is reported at 12:02:20, and a single dropped
packet at 03:00 never wakes you up.

While a sensor is in the failure streak but below the threshold, its status is
**Unknown**, not Down. That is deliberate: the honest answer to "is it up?" at
that moment is "we do not know yet", and showing green would be a lie.

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
the Weatherglass container.

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
health dropdown, labelled "only check that it runs".

## 📡 `snmp` {#snmp}

Target: a hostname or IP, optionally with a port — a bare host means port 161.

| Option | Type | Default | Meaning |
|---|---|---|---|
| `oid` | string | — | The object to ask for, dotted. **Required** |
| `community` | string | `public` | v2c community string. A shared secret, masked in the API |
| `version` | string | `2c` | `2c` or `1`. v3 is not supported |
| `expect` | string | — | Fail unless the value contains this substring |
| `min`, `max` | number | — | Bounds a numeric value must lie within |

This is one `GET` of **one OID**. No walk, no traps, no version 3 — a switch, a
router or a NAS answers "how warm is the CPU", "how long has it been up" and "how
much ink is left" with a single request each, and that is the whole job. A walk
enumerates a device's entire MIB, which is a different tool with a different cost,
and it is not this one.

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
on a trusted network only — see [SNMP v2c sends the community in clear
text](/concepts/security#snmp-v2c).
:::

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
