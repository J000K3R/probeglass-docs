---
title: The certificate inventory
sidebar_label: Certificates
description: Every certificate your HTTPS, TLS-enabled TCP and TLS sensors have seen, sorted by expiry, on one page.
---

# The certificate inventory

The **Certificates** tab lists every certificate ProbeGlass has actually seen,
soonest to expire first. It is not a second scan and it does not ask a server
anything: the sensors you already run meet these certificates, and this page
remembers what they met.

## What appears on it

A row appears after a sensor completes a TLS handshake:

- an **HTTPS** sensor,
- a **TCP** sensor with `tls` switched on,
- a **TLS certificate** sensor.

A plain HTTP target, or a TCP port without TLS, has no certificate and therefore
no row. A probe that fails before the handshake changes nothing — the certificate
may still be in use, and a page that emptied itself on every timeout would say
less the worse things got.

## Reading it

| Column | What it says |
| --- | --- |
| **Sensor** | The sensor that saw it, and its target. The row opens that sensor. |
| **Certificate** | The name on the certificate and its subject alternative names. |
| **Issuer** | The organisation that signed it — the recognisable part of the issuer name. Hover for the full name. |
| **Expires** | The day it stops being valid, and the TLS version the sensor negotiated. |
| **Days left** | Red and reading `expired` once it has run out, amber within 30 days. |

The counts above the table are also the filter: **Expired**, **Within 30 days**
and **Valid**.

## Thirty days, and the sensor's own window

The page calls a certificate "soon" at 30 days because that is long enough to
renew without an evening and short enough to mean something.

The sensor's own decision is separate, and it is the one that alerts. `http`, `tcp`
and `tls` sensors all take `cert_warn_days`:

- a **TLS certificate** sensor starts at 14 days,
- **HTTP** and **TCP** sensors start at 0, so they fail only once the certificate
  has expired.

A certificate can therefore sit in the amber bucket on this page while its sensor
is still green. That is the point: the page is for renewing before the alarm, not
after it.

## One row per sensor

A renewal replaces the row — the new expiry and the new fingerprint, not a second
line — and deleting the sensor deletes its row. A sensor that moves from `https`
to `http` loses its row at the next successful probe.

There is no certificate history here. The fingerprint in the API is what says a
certificate changed; for "when did it last change" the sensor's probe history and
its incidents are the record.

## Self-signed certificates

A certificate from a private CA is refused by the handshake unless the sensor says
`insecure_skip_verify`. With verification off, the handshake completes, the
certificate is listed, and its expiry still fails the sensor when the warning
window is reached. The page notes nothing about trust — it is an inventory, not a
verdict.

## API

`GET /api/certificates` returns the same list, sorted by `not_after`, with the
sensor's name, target, group and place. `days_left` is worked out when the answer
is built, not stored.
