---
title: Scanning a network
sidebar_label: Network scan
description: Look at a private IPv4 range, see which hosts answer, and turn the result into sensors.
---

# Scanning a network

The sensor catalogue has a **Scan network** button for the first setup: give it a
private range and it looks for the hosts and services ProbeGlass already knows how
to watch, then offers them as sensors.

## What it does

1. Open **New sensor** and choose the **Network scan** tab, next to Templates and
   Single sensor.
2. Enter a private IPv4 range — `192.168.1.0/24`, up to 256 addresses — and,
   optionally, SNMP credentials.
3. **Scan.** Without SNMP the scan is TCP only. With credentials it also asks each
   answering device for its `sysDescr`, which is what lets it name a QNAP,
   Synology, UniFi, MikroTik, Proxmox or TrueNAS and suggest that template's checks.
4. Every suggestion starts ticked. Untick what you do not want, choose the group
   for the new sensors, and **Add selected sensors**.

The scan dials a fixed list of ports — the ones the templates in this program
already use (SSH, HTTP/HTTPS, SMB, MQTT, the web interfaces of common homelab apps,
and so on). It is not a general-purpose port scanner and there is no field for an
arbitrary port list.

## What it suggests

- **Ping** for every host that answered.
- **HTTP** or **HTTPS** for a web port, and a **TLS certificate** check for port
  443.
- **Uptime** over SNMP, plus the SNMP checks of the matching template when the
  device identified itself (a QNAP's temperatures, for example).
- The matching template's name is shown beside the host, so a device the scan
  cannot fully expand can still be added from the catalogue with one click.

## Limits

- **Private networks only.** RFC1918, loopback and link-local IPv4 ranges are
  accepted; a public range is refused before anything is dialled.
- **At most 256 addresses.** Use `/24` or smaller.
- **Administrators only.** A scan dials addresses the caller chose and creates
  sensors, so it belongs with the other configuration actions.
- **Credentials are not stored.** The SNMP values are used for the scan; the
  sensors that are created carry the ones their checks need, masked in the API like
  every other credential.

A `/24` with all ports closed can take half a minute. The scan has a 90-second
budget and reports a timeout rather than running forever.
