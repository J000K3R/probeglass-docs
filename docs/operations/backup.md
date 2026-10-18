---
title: Backup and restore
sidebar_label: Backup and restore
description: Two ways to take your installation with you — a portable JSON export from the dashboard, and a byte-exact copy of the SQLite file underneath it.
---

# Backup and restore

Everything ProbeGlass knows — sensors, channels, probe history, incidents,
accounts with their password hashes and second factors, per-account settings, and
the API key — lives in one SQLite file. Backing it up means copying that file, and
restoring means putting it back.

There is now a second way, and the two answer different questions. The dashboard
can write an installation out as a JSON document — all of the configuration, or
that plus a chosen slice of history — and read one back in. The file copy is
complete and byte-exact; the JSON export is portable, readable, and able to leave
history behind on purpose.

| | From the dashboard | The database file |
|---|---|---|
| What you get | one JSON document | a byte-exact copy of `probeglass.db` |
| Where | **Settings → Backup**, or the API | `docker cp`, `VACUUM INTO`, or a plain copy |
| Partial? | yes — without history, or only the last 7, 30 or 90 days | no. All of it or none of it |
| Readable without tools? | yes, it is JSON | only with SQLite |
| Secrets | in clear text | in clear text |
| Good for | moving a configuration, a copy you can read, trimming history | a real restore, a migration, a snapshot before an upgrade |

Whichever one you take, the file is the installation. Guard it as such — see
[the backup file](/concepts/security#backup-secrets).

## 💾 From the dashboard {#from-the-dashboard}

**Settings → Backup** — the **Backup** tab of the settings page — has two
menus and two buttons:

<img
  src="/img/backup-panel.png"
  alt="The Backup and restore panel: a menu labelled What to include, set to With history; a second labelled History of the last, set to 30 days; a Download backup button and a Restore from a file button; and, below them, a plain warning that the file holds password hashes, two-factor secrets and alert-channel credentials in plain text."
  width="1600"
/>

**What to include** decides what the file is about:

- **Without history** — the sensors, the sites, the alert channels, the accounts
  and the settings. This is the file to keep in version control or to carry to a new
  machine, because nothing in it changes from one hour to the next. Outages and probe
  results are left out, and a restore leaves the ones already on the machine
  untouched.
- **With history** — all of the above, plus the outages and the hourly and daily
  figures for the period you pick under **History of the last**: **7 days**,
  **30 days**, **90 days** or **Everything kept**.

The two scopes exist because a copy of the database cannot express either of them.
A backup that is "everything except the history" is a description of a
configuration, and a file copy has no way to be that.

### What is in the file {#what-is-in-the-file}

```json
{
  "format": "probeglass-backup",
  "format_version": 1,
  "schema_version": 3,
  "app_version": "0.2.2",
  "created_at": "2026-10-09T21:00:00Z",
  "scope": "history",
  "days": 30,
  "settings": [ … ],
  "sites": [ … ],
  "channels": [ … ],
  "sensors": [ … ],
  "users": [ … ],
  "incidents": [ … ],
  "results_hourly": [ … ],
  "results_daily": [ … ]
}
```

Sensors are referred to **by name**, not by row id, so a file carries the same
meaning on a different installation — which is the point of it. A sensor whose id
was 7 here is not the sensor whose id is 7 there, and a file that said `"sensor": 7`
would restore somebody else's sensor under your name.

### What is *not* in the file {#what-is-not-in-the-file}

**The raw probe results.** Seven days at one-minute intervals across forty sensors
is around 400 000 rows, and as JSON that is several times the size of the database
it came from — for a slice of history that the hourly and daily rollups already
summarise. The rollups *are* in it, and they are what every uptime figure and every
chart beyond the raw window is computed from, so the numbers are right after a
restore. What is missing is stated plainly: the individual probe messages of the
days you left behind are no longer findable with the search.

:::warning
The file carries your secrets in clear text — password hashes, TOTP secrets,
recovery-code hashes, the API key, and the credentials of every alert channel. That
is deliberate: a backup with masked credentials would restore a channel that cannot
send anything, and you would not find out until the first outage. The panel says so
in as many words. Read [The backup file carries secrets in the
clear](/concepts/security#backup-secrets) before you email one to yourself.
:::

### Restoring {#restoring}

**Restore from a file…** reads a backup back in. It asks twice, because it is not an
undoable operation: the first question names the file and says that everything —
sensors, channels, accounts and settings — is replaced by what the file says, and
the second says that this cannot be undone in the dashboard and that the safety copy
is the way back.

Before it touches anything, ProbeGlass:

1. **Checks the file.** A document whose `format` is not `probeglass-backup`, or
   whose format or schema version is newer than this build understands, is refused
   with a message saying which. Nothing is written.
2. **Takes a safety copy.** `VACUUM INTO` writes
   `probeglass-pre-restore-<timestamp>.db` beside the database — a byte-exact
   snapshot taken before the change. If that copy cannot be written, the restore
   does not go ahead. This is the way back if the file turns out to lock you out.

Only then does it replace what the file names. A file **without history** does not
mention the incidents or the rollups, so those are left exactly as they are — a
configuration rollback does not wipe your history. Inside a table, though, rows are
replaced rather than merged: restoring means putting back, not blending.

Afterwards the running scheduler is brought back in line with the restored sensors,
so probes resume against what the file describes rather than against what was there
before. The response also carries a `token_epoch_notice` flag when the restored
accounts carry session epochs that invalidate, or re-validate, sign-ins.

:::note
Restoring a backup from a **different** installation overwrites the sensors, sites
and channels whose names line up. Restore it into a fresh data directory unless you
mean exactly that. And because the session epoch travels in the file, restoring an
*older* backup brings back sessions that were signed out in the meantime — "sign out
everywhere" is not a defence against a file somebody else holds.
:::

## ⌨️ From the command line {#from-the-command-line}

Both directions are ordinary JSON routes, so a cron job or an Ansible play can take
the backup instead of you remembering to press a button.

**Download.** `scope` is `config` or `history`; `days` is `7`, `30`, `90` or `all`,
and matters only for the history scope.

```bash
curl -fsS -H "X-API-Key: $PROBEGLASS_API_KEY" \
  "http://localhost:8080/api/backup?scope=history&days=30" \
  -o "probeglass-backup-$(date +%F).json"
```

The answer arrives with `Content-Type: application/json`, a
`Content-Disposition: attachment` naming the file, and `Cache-Control: no-store`.

**Restore.** The file is the request body — there is no multipart form anywhere in
the project, and inventing one for this would be a precedent nobody needs. The
upload is capped at 64 MiB.

```bash
curl -fsS -X POST -H "X-API-Key: $PROBEGLASS_API_KEY" \
  -H "Content-Type: application/json" \
  --data-binary @probeglass-backup-2026-10-09.json \
  "http://localhost:8080/api/restore"
```

The reply says what moved and where the safety copy went:

```json
{
  "counts": { "sensors": 12, "channels": 2, "users": 1, "incidents": 84 },
  "safety_copy": "probeglass-pre-restore-20261009T211500Z.db",
  "token_epoch_notice": false
}
```

Both routes are administrator-only, like every other route that can rewrite the
installation. The full parameter list is in the [API reference](/reference/api).

## 🗄️ The database file {#the-database-file}

The JSON export is a description of your installation. The database file *is* your
installation, and a copy of it is still the right backup when you want everything,
byte for byte, with nothing left to interpretation.

```
/data/probeglass.db         the database
/data/probeglass.db-wal     write-ahead log, if any
/data/probeglass.db-shm     shared-memory index, if any
/data/probeglass.yaml       the configuration file, if you mounted one
```

### The safe way: `VACUUM INTO`

Copying a SQLite file while the process is writing to it can produce a torn copy.
SQLite is robust about this — it will usually report the corruption rather than
serve bad data — but "usually" is not a backup strategy.

Ask SQLite for a consistent snapshot instead. `VACUUM INTO` writes a single
coherent file with no WAL to reconcile.

The image has no shell and no `sqlite3`, so this has to run from outside the
container. Two options:

**Stop, copy, start.** Short, simple, and for a homelab, entirely adequate:

```bash
docker stop probeglass
docker run --rm -v probeglass-data:/data -v "$PWD:/backup" alpine \
  cp /data/probeglass.db /backup/probeglass-$(date +%F).db
docker start probeglass
```

**Copy the volume while running**, accepting that you may need the `-wal` file
too:

```bash
docker run --rm -v probeglass-data:/data -v "$PWD:/backup" alpine \
  sh -c 'sqlite3 /data/probeglass.db "VACUUM INTO /backup/probeglass-$(date +%F).db"'
```

This runs `sqlite3` from a throwaway `alpine` container against the volume, which
is the part you cannot do from inside the ProbeGlass image. `VACUUM INTO` takes
a read lock and writes a clean, fully checkpointed copy.

Either way, the result is one file of a few MB that you can `scp` anywhere.

### From source

Nothing special — the same file, in `./data` by default:

```bash
cp data/probeglass.db ~/backups/probeglass-$(date +%F).db
```

### Restoring a database file

Stop the container, replace the file, start it again:

```bash
docker stop probeglass
docker run --rm -v probeglass-data:/data -v "$PWD:/backup" alpine \
  cp /backup/probeglass-2026-10-08.db /data/probeglass.db
docker start probeglass
```

If you restored a file from a version that had a `-wal` next to it, delete the
stale `-wal` and `-shm` files — they belong to the copy you just replaced and
will otherwise be replayed on top of it. That is the one way this procedure can
go wrong.

Migrations run at startup, so restoring an older database into a newer binary
upgrades it in place — the migration is recorded in a `schema_migrations` table
and never applied twice.

:::caution
Going the other way is not supported: putting a database written by a *newer*
version in front of an *older* binary. Migrations are only ever applied forwards,
so an older binary will happily open a newer schema and then fail in whatever way
an unexpected column produces. Restore an old database only into an equal or
newer build. The in-app restore enforces the same rule, and refuses a file from a
newer schema rather than trying.
:::

## 🚚 Migrating to another machine {#migrating}

Copy the database and, if you use one, the `probeglass.yaml`. That is the whole
migration. Two things do not travel and are worth knowing about:

- **The password hash does travel.** It is in the `settings` table, so the
  dashboard password is the same on the new host. That is usually what you want,
  and occasionally a surprise.
- **The API key travels too**, and stays valid. Rotate it after a migration if the
  old host is going somewhere you do not control.

If you would rather not move a whole database — because the old host is going to
somebody else, or because you only want the configuration — take a **Without
history** export from the dashboard and restore that instead. It carries the
accounts and the API key with it, and leaves whatever history the new machine
already has exactly where it is.

## 📦 What is not backed up {#what-is-not-backed-up}

The image itself — pull it again. The configuration file, if you keep it outside
the data volume — copy it yourself, or better, keep it in version control.

## 📏 Sizing {#sizing}

To estimate before you commit: one raw probe result row is roughly 60 bytes. A
sensor every 60 seconds produces 1 440 rows a day, so about 86 KB a day, 600 KB a
week, per sensor. Forty sensors at one-minute intervals for a week of raw retention
is therefore in the tens of MB — and after the raw window has passed, the hourly
and daily rollups that replace it are smaller than the configuration file. A JSON
export carries those rollups and not the raw rows, so it is the smaller file of the
two by a wide margin.

Measure yours:

```bash
docker run --rm -v probeglass-data:/data alpine ls -lh /data
```

## Next steps

- [Upgrading](/operations/upgrading)
- [Troubleshooting](/operations/troubleshooting)
