---
title: Upgrading
sidebar_label: Upgrading
description: How to move between versions, what happens to the database, and how to roll back.
---

# Upgrading

Upgrading is pulling a new image and restarting. Database migrations run at
startup, in a transaction, and are recorded so they are never applied twice.

## Upgrading from the old name

The project was called **Weatherglass** until 2026-10 and is **ProbeGlass** now.
Every name changed at once, and the commands on this page assume the new ones, so
an installation that is still running under the old name needs a few hand-steps
first. There is deliberately no compatibility layer: the new version reads
nothing under the old names, and a file it does not find is not an error — it is a
fresh start, which is why the data file comes first.

1. **Rename the data files.** `weatherglass.db` becomes `probeglass.db` and
   `weatherglass.yaml` becomes `probeglass.yaml`. A new version that finds neither
   starts with an empty database rather than with yours.

   ```bash
   docker run --rm -v weatherglass-data:/data alpine sh -c \
     'mv /data/weatherglass.db /data/probeglass.db; \
      mv /data/weatherglass.yaml /data/probeglass.yaml 2>/dev/null || true'
   ```

   The *volume* keeps whatever name you gave it; only the paths inside it changed,
   so the commands above still work as written.

2. **Rename the environment variables.** Every `WEATHERGLASS_*` is a
   `PROBEGLASS_*` now — `PROBEGLASS_ADMIN_PASSWORD`, `PROBEGLASS_DATA_DIR`,
   `PROBEGLASS_LISTEN`, the two retention settings and the rest. Update your own
   `docker-compose.yml` or systemd unit. A stale file does not fail, it is simply
   not read: the variable is set, so nothing looks wrong, and the setting it was
   carrying is gone. `PUID`, `PGID` and `UMASK` never had the prefix and do not
   change.

3. **Switch your webhook receivers** to `X-ProbeGlass-Event` and
   `X-ProbeGlass-Signature`. A receiver still watching the old headers sees the
   request and no event.

4. **Issue the recovery codes again.** The salt they are hashed with is derived
   from the name, so codes printed under the old one no longer match. Sign in and
   generate a new set from the account page.

5. **Import your backups first, or rewrite their marker.** A file written by the
   old version says `weatherglass-backup` in its header and the new importer
   refuses it. Import the file before you upgrade, or change that one string:

   ```bash
   sed -i 's/"weatherglass-backup"/"probeglass-backup"/' weatherglass-backup-*.json
   ```

6. **Sign in once more.** The session cookie was renamed, so every open browser is
   signed out. Nothing else about your account changes. Your authenticator app
   will show the issuer as `ProbeGlass` from the next enrolment onwards; an entry
   added earlier keeps showing the old name, and keeps working.

While the project is in development there is one moving tag, `dev`:

```bash
docker pull ghcr.io/j000k3r/probeglass:dev

docker stop probeglass && docker rm probeglass
docker run -d --name probeglass --restart unless-stopped \
  -p 8080:8080 -v probeglass-data:/data --cap-add NET_RAW \
  ghcr.io/j000k3r/probeglass:dev
```

Once 0.1.0 is released, every version is published as its own tag — `0.1.0`,
`0.1`, and `latest` — so pin the one you mean and change it when you choose to:

```bash
docker pull ghcr.io/j000k3r/probeglass:0.1.0
```

With Compose, change the tag and `docker compose up -d`. The volume is untouched
by both.

## Before you upgrade

Take a backup. It costs one command and five seconds:

```bash
docker stop probeglass
docker run --rm -v probeglass-data:/data -v "$PWD:/backup" alpine \
  cp /data/probeglass.db /backup/probeglass-before-upgrade.db
docker start probeglass
```

Migrations are written to be additive — new tables, new columns, new indexes —
so a rollback to the previous image usually just works, reading the columns it
knows about and ignoring the rest. "Usually" is doing real work in that sentence,
which is why the backup exists.

If you would rather not stop the container for it, **Settings → Backup** writes the
same installation out — the configuration and the accounts, or that plus the
history — as one JSON file, without an interruption, and can put it back from the
same page. It reads the schema version before it writes anything, so a file from a
newer build is refused rather than half-applied. It is the gentler of the two and it
is enough for an upgrade; the file copy above is the one to reach for when you want
the whole database, byte for byte. Both are described in
[Backup and restore](/operations/backup).

## What survives an upgrade

Everything. Sensors, channels, history, incidents, your password, your API key,
and the dashboard preferences are all in the database, and the database is in the
volume, which nothing in the upgrade touches.

Two things to know:

- **Alert channels declared in a configuration file** are re-applied at every
  start, so a new version's changed field list takes effect on the first start
  after the upgrade. If a required field was added to a channel type you use,
  startup fails with the channel name and the missing field, rather than running
  with an alert that cannot be delivered.
- **Your API key stays valid.** It is a database row, not a build artefact.

## What does not survive

The image. Anything you had configured through `docker exec` — nothing, since
there is no shell — and any manual change to the container's filesystem, which is
discarded on recreate. That is the design: the container is disposable, the volume
is not.

## Checking the version

```bash
docker exec probeglass probeglass version
```

```
probeglass 0.1.0 (4a1c2e7) built 2026-11-02T09:14:03Z
```

The commit and the build date are only present when they were stamped in at
build time, which the release workflow does and a local `go build` does not. The
same information is at `GET /api/version` and in the dashboard's Settings tab, so
a bug report can name the exact build without anyone guessing.

## Downgrading

Stop the container, replace the image tag with the older one, start it. The
database stays as the newer version left it.

This is the case the pre-upgrade backup is for. Restore it and you are back
exactly where you started, including the incident log:

```bash
docker stop probeglass
docker run --rm -v probeglass-data:/data -v "$PWD:/backup" alpine \
  sh -c 'rm -f /data/probeglass.db-wal /data/probeglass.db-shm && \
         cp /backup/probeglass-before-upgrade.db /data/probeglass.db'
docker start probeglass
```

## Release notes

Every release is described in
[CHANGELOG.md](https://github.com/j000k3r/probeglass/blob/main/CHANGELOG.md),
in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format. Breaking
changes and security fixes are called out there and in the GitHub release notes.

## Next steps

- [Backup and restore](/operations/backup)
- [Troubleshooting](/operations/troubleshooting)
