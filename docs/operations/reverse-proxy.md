---
title: Running behind a reverse proxy
sidebar_label: Reverse proxy
description: nginx, Caddy, and Traefik configurations, with the two settings that actually matter.
---

# Running behind a reverse proxy

Weatherglass serves plain HTTP on port 8080 and expects a proxy in front of it if
you want TLS, a hostname, or an IP allowlist. Two things need configuring, and
getting them wrong produces failure modes that are confusing rather than obvious.

## The two settings that matter

```yaml
base_url: https://weatherglass.lan
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

Weatherglass sends `X-Accel-Buffering: no`, which nginx honours. Other proxies
need telling explicitly. Two more consequences:

- **Do not set a short proxy read timeout.** A quiet system produces a heartbeat
  every 25 seconds, so a 60-second read timeout will cut the stream repeatedly.
  The browser reconnects on its own, but the log fills with noise.
- **Do not put a buffering CDN in front of it.** This is a LAN dashboard.

## nginx

```nginx
server {
    listen 443 ssl http2;
    server_name weatherglass.lan;

    ssl_certificate     /etc/ssl/certs/weatherglass.lan.pem;
    ssl_certificate_key /etc/ssl/private/weatherglass.lan.key;

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
weatherglass.lan {
    reverse_proxy 127.0.0.1:8080
}
```

If you want the IP allowlist that makes this safe to expose on a wider network:

```caddyfile
weatherglass.lan {
    @lan remote_ip 192.168.0.0/16 10.0.0.0/8
    handle @lan {
        reverse_proxy 127.0.0.1:8080
    }
    respond 403
}
```

## Traefik

```yaml
services:
  weatherglass:
    image: j000k3r/weatherglass:latest
    labels:
      traefik.enable: "true"
      traefik.http.routers.wg.rule: "Host(`weatherglass.lan`)"
      traefik.http.routers.wg.entrypoints: "websecure"
      traefik.http.routers.wg.tls: "true"
      traefik.http.services.wg.loadbalancer.server.port: "8080"
    volumes: ["weatherglass-data:/data"]
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
curl -s -H "X-Forwarded-Proto: https" https://weatherglass.lan/healthz

# 3. Authentication survives the round trip.
curl -s -c /tmp/jar -X POST -H 'Content-Type: application/json' \
  -H 'Origin: https://weatherglass.lan' \
  -d '{"password":"..."}' https://weatherglass.lan/api/login
curl -s -b /tmp/jar https://weatherglass.lan/api/session
```

`/healthz` needs no authentication and returns `{"status":"ok","version":…}`,
which makes it the right thing for a proxy to poll.

If step 3 returns `{"authenticated":false}` while step 1 works, the cookie is not
surviving the proxy. That is almost always a `Host` header that does not match, or
a proxy rewriting the `Set-Cookie` header.

## Next steps

- [Troubleshooting](/operations/troubleshooting)
- [Security](/concepts/security)
