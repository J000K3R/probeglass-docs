---
title: Running behind a reverse proxy
sidebar_label: Reverse proxy
description: nginx, Caddy, and Traefik configurations, with the two settings that actually matter — and why this must not be exposed to the internet yet.
---

# Running behind a reverse proxy

:::danger Do not expose this to the internet yet

ProbeGlass is at version 0.2.0 and is not ready to be reachable from outside
your own network. A reverse proxy is for TLS, a hostname and an IP allowlist
**inside a LAN**. It is not a way to make this safe to publish.

What is missing, concretely:

- **The login throttling is per process and in memory.** It slows a single
  attacker down. It is not a lockout, it does not survive a restart, and it
  knows nothing about a second instance.
- **There is no account recovery and no audit trail** of who signed in from
  where, so an intrusion would leave little to notice.
- **The API key carries full administrative rights** and is a single string
  with no expiry and no scopes. Anyone who reads it owns the installation. See
  [Security](/concepts/security#authentication).
- **The session cookie has no `Secure` flag**, deliberately, because homelab
  installs are often plain HTTP. Behind a TLS proxy the cookie is still willing
  to travel in clear text.
- **The alert channels hold credentials** — a bot token, a webhook URL — and
  the backup file contains them unmasked on purpose.

An IP allowlist narrows who can reach it. It does not fix any of the above, and
it is one misconfigured rule away from being no protection at all. When the
project leaves 0.x, this page will say what changed and what to review first.

:::

ProbeGlass serves plain HTTP on port 8080 and expects a proxy in front of it if
you want TLS, a hostname, or an IP allowlist. Two things need configuring, and
getting them wrong produces failure modes that are confusing rather than obvious.

## The two settings that matter

```yaml
base_url: https://probeglass.lan
trust_proxy: true
```

**`base_url`** is used to build the link inside an alert message. Without it, the
alerts carry no link — harmless, but a link straight to the dashboard turns
"something is wrong" into a two-second check.

**`trust_proxy`** makes the API believe `X-Forwarded-For` and `X-Forwarded-Proto`.
Turn it on **only** when a proxy you control is actually in front, because
otherwise any client can claim any address and the login rate limiter becomes
trivial to sidestep.

## Streaming: the one thing that breaks

The dashboard keeps a Server-Sent Events stream open on `/api/events`. Most proxy
defaults will buffer it, and a buffered event stream is an event stream that
never arrives — the page loads, then never updates.

ProbeGlass sends `X-Accel-Buffering: no`, which nginx honours. Other proxies
need telling explicitly. Two more consequences:

- **Do not set a short proxy read timeout.** A quiet system produces a heartbeat
  every 25 seconds, so a 60-second read timeout will cut the stream repeatedly.
  The browser reconnects on its own, but the log fills with noise.
- **Do not put a buffering CDN in front of it.** This is a LAN dashboard.

## nginx

```nginx
server {
    listen 443 ssl http2;
    server_name probeglass.lan;

    ssl_certificate     /etc/ssl/certs/probeglass.lan.pem;
    ssl_certificate_key /etc/ssl/private/probeglass.lan.key;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Server-Sent Events: no buffering, and no timeout for a quiet stream.
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 1h;
    }
}
```

`proxy_buffering off` is the important line. With `proxy_http_version 1.1` and no
buffering, the event stream flows through unchanged.

## Caddy

Caddy needs no special handling — it does not buffer responses by default and it
obtains a certificate on its own:

```caddyfile
probeglass.lan {
    reverse_proxy 127.0.0.1:8080
}
```

If you want to narrow who can reach the dashboard inside your own network:

```caddyfile
probeglass.lan {
    @lan remote_ip 192.168.0.0/16 10.0.0.0/8
    handle @lan {
        reverse_proxy 127.0.0.1:8080
    }
    respond 403
}
```

An allowlist like that is a useful second lock on a LAN and no help at all
against the things listed at the top of this page — it narrows the door, it does
not replace one.

## Traefik

```yaml
services:
  probeglass:
    image: ghcr.io/j000k3r/probeglass:0.2.0
    labels:
      traefik.enable: "true"
      traefik.http.routers.probeglass.rule: "Host(`probeglass.lan`)"
      traefik.http.routers.probeglass.entrypoints: "websecure"
      traefik.http.routers.probeglass.tls: "true"
      traefik.http.services.probeglass.loadbalancer.server.port: "8080"
    volumes: ["probeglass-data:/data"]
```

Traefik does not buffer by default and sets the forwarded headers itself.

## The session cookie

The session cookie deliberately has **no `Secure` flag**, even when the dashboard
is reached over HTTPS. This is a documented decision, not an oversight: the same
build has to work on a plain-HTTP LAN, and a `Secure` cookie sent over HTTP is
silently dropped by the browser — which presents as "the password works but
nothing happens".

The practical consequence is that on a plain-HTTP LAN the cookie travels in clear
text. See [Security](/concepts/security#transport-security-honestly) for the
reasoning and what to do if it matters to you.

## Verifying it works

Three sensors, in order:

```bash
# 1. The daemon is healthy, from inside the network.
curl -s http://127.0.0.1:8080/healthz

# 2. The proxy is passing things through, with the forwarded headers.
curl -s -H "X-Forwarded-Proto: https" https://probeglass.lan/healthz

# 3. Authentication survives the round trip.
curl -s -c /tmp/jar -X POST -H 'Content-Type: application/json' \
  -H 'Origin: https://probeglass.lan' \
  -d '{"password":"..."}' https://probeglass.lan/api/login
curl -s -b /tmp/jar https://probeglass.lan/api/session
```

`/healthz` needs no authentication and returns `{"status":"ok","version":…}`,
which makes it the right thing for a proxy to poll.

If step 3 returns `{"authenticated":false}` while step 1 works, the cookie is not
surviving the proxy. That is almost always a `Host` header that does not match, or
a proxy rewriting the `Set-Cookie` header.

## Next steps

- [Troubleshooting](/operations/troubleshooting)
- [Security](/concepts/security)
