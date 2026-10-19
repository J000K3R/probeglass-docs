---
title: Alerts
sidebar_label: Alerts
description: Alert channels, when they fire, message templates, and webhook signing.
---

# Alerts

An alert channel is somewhere a notification can go. A sensor is attached to zero
or more channels, and ProbeGlass speaks to them in parallel: one unreachable
channel never delays the others, and never suppresses them.

<img
  src="/img/alerts.png"
  alt="The Alerts tab: one card per channel, each with the channel type, the sensors attached to it and the buttons to test, edit or delete it."
  width="1600"
/>

## 📮 Supported channels {#supported-channels}

| Channel | Required fields | Optional fields |
|---|---|---|
| Telegram | `bot_token`, `chat_id` | `thread_id`, `silent` |
| Discord | `webhook_url` | `username` |
| Matrix | `homeserver_url`, `access_token`, `room_id` | — |
| ntfy | `topic` | `server_url`, `token`, `priority` |
| Gotify | `server_url`, `token` | `priority` |
| Slack | `webhook_url` | `channel` |
| Webhook | `url` | `method`, `hmac_secret` |

Set them up under **Alerts**. The form is generated from the server's own
description of each channel type (`GET /api/channel-types`), so the field list
you see is the field list the sender actually reads — a field cannot be
documented in the UI and ignored in the code, or the other way round.

Every channel has a **Test** button that sends a real message through the real
sender. It is the only reliable way to find out that a chat ID is wrong or that a
homeserver blocks your token, and it takes five seconds.

Secrets — bot tokens, webhook URLs, access tokens, HMAC keys — are never
returned by the API. The UI receives a marker instead, and sending that marker
back preserves the stored value rather than overwriting it with the literal
text. A channel can therefore be edited without retyping its credentials.

## 🔑 Getting the credentials {#getting-the-credentials}

Every one of these needs something that is issued by somebody else — a bot token,
a webhook URL, a chat ID — and none of it is guessable. The dialog shows the
recipe for the type you picked, under the fields, in full. It is repeated here
because this page is what you have open when you are hunting for the token.

<img
  src="/img/channel-setup.png"
  alt="The New channel dialog on Telegram: the four fields, and beneath them a numbered list headed Setting up Telegram that says where the token and the chat ID come from."
  width="1600"
/>

### Telegram

1. Open [@BotFather](https://t.me/BotFather) in Telegram and send it `/newbot`. It
   asks for a name and answers with a token.
2. Paste that token into **Bot token**.
3. Add the bot to the group the alerts belong in, or open a direct chat with it,
   and send it any message.
4. Open `https://api.telegram.org/bot<token>/getUpdates` in a browser, with your
   own token in place of `<token>`, and read the number in `chat.id`. A group's
   ID starts with a minus, like `-1001234567890`; a person's does not.
5. **That address contains the token.** It belongs in no chat, no issue and no
   ticket — anyone who has it controls the bot. ProbeGlass strips it out of
   error messages for the same reason.

`thread_id` is for forum groups only, and is the topic's own ID, not the group's.
`silent` delivers without a notification sound.

### Discord

1. In Discord, open the settings of the channel that should carry the alerts.
2. Go to **Integrations → Webhooks** and press **New Webhook**.
3. Give it a name, pick the channel, and press **Copy Webhook URL**.
4. Paste it into **Webhook URL**. Anyone who has it can post to that channel,
   which is why it is stored as a secret.

`username` overrides the name the webhook posts under, in place of the one
configured in Discord.

### Matrix

1. Enter the base address of your homeserver, **without** the `/_matrix` path:
   `https://matrix.example.org`, not `https://matrix.example.org/_matrix/client`.
2. In Element, open **Settings → Help & About**, expand **Advanced**, and reveal
   the access token. Paste it into **Access token**.
3. Open the room's settings, go to **Advanced**, and read the **Internal room
   ID**. It starts with `!` and carries a colon, like `!kRcQvYtLmNpZxW:matrix.org`.
4. The account the token belongs to has to be in that room already — a room it
   has not joined cannot be posted to.

The access token is the whole account, not just this channel. Treat it like a
password, and use a dedicated account if you can.

### ntfy

1. Pick a topic name and subscribe to it in the ntfy app, or open your server's
   page with that topic in the address, so that you can see what arrives.
2. Enter it in **Topic**. Leave **Server URL** as it is to use the public
   `https://ntfy.sh`.
3. On the public server, **anyone who guesses the topic can read your alerts** —
   a phone that went down at 3 a.m., a sensor called `Garage`. Choose a long,
   unguessable name, or run your own server and enter its address there.
4. Fill in an access token only if that server asks for one. `priority` takes
   `min`, `low`, `default`, `high` or `urgent`.

### Gotify

1. Open your Gotify server in a browser and sign in — it is the other self-hosted
   push server a homelab tends to have, and it needs no account outside the LAN.
2. Under **Apps**, press **Create Application**, give it a name, and copy the token
   it shows. That token is the whole credential: it can post to its own
   application and read nothing back, which is why it is safer to keep than an
   account password.
3. Paste it into **App token**, and enter the server's base address in **Server
   URL** — `https://gotify.example.org`, without `/message` at the end.
4. Subscribe to that application in the Gotify phone app. `priority` is Gotify's
   own 0-to-10 scale; leave it empty and a down alert goes out at 8, a reminder at
   6 and a recovery at 4.

### Slack

1. Open [api.slack.com/apps](https://api.slack.com/apps), press **Create New App
   → From scratch**, and pick the workspace.
2. In the app's settings, open **Incoming Webhooks** and switch **Activate
   Incoming Webhooks** on.
3. Press **Add New Webhook to Workspace**, pick the channel the alerts should go
   to, and allow it.
4. Copy the webhook URL Slack shows and paste it here.

The receiving channel is baked into that URL. Fill in **Channel override** only to
send somewhere else; the `#` is added for you.

### Generic webhook

1. Enter the address on your own side that should receive the alerts, and make it
   accept a `POST`.
2. Each request carries `Content-Type: application/json` and the header
   `X-ProbeGlass-Event` with the kind of event in it. The body is described
   under [Generic webhooks](#generic-webhooks).
3. With an **HMAC secret** set, the body is signed with HMAC-SHA256 and the
   signature arrives in `X-ProbeGlass-Signature`, prefixed with `sha256=`.
   Compare it before you act on the body.
4. Press **Test** before you rely on it: the test event goes through the same
   sender, the same signing and the same retries as a real outage.

## 🔔 When alerts fire {#when-alerts-fire}

| Event | When |
|---|---|
| `down` | A sensor has failed `retries` times in a row and an incident opens |
| `reminder` | A sensor has been down for `reminder_every` seconds since the last alert |
| `escalation` | An incident is still open and unacknowledged after the sensor's `escalate_after`; sent once, to the second channel list |
| `up` | A sensor that was down succeeded again, naming how long it was down |
| `test` | You pressed the Test button |

Nothing is sent for the individual failed probes below the retry threshold, for
**Run now** probes, or for a sensor that was already down when ProbeGlass
started — a container restart neither loses an outage nor re-announces one.

## ⏫ Escalation {#escalation}

A sensor can carry a second list of channels and a delay. The ordinary
`channels` hear about the outage first; if it is still open and nobody has
acknowledged it after `escalate_after`, the `escalate_channels` are told once.
Acknowledgement stops it. The incident records that the message went out, so a
restart cannot send it a second time, and a failed send is not retried beyond
the dispatcher's own three attempts.

Both are set in the sensor form, under **Escalation**, and in a configuration
file as `escalate_after` and `escalate_channels`.

## ✏️ Message templates {#message-templates}

Every channel takes an optional `title_template` and `body_template`. Both are Go
[`text/template`](https://pkg.go.dev/text/template) strings rendered against the
event:

| Variable | |
|---|---|
| `.Name` `.Type` `.Target` `.Group` | The sensor |
| `.Status` | `up`, `down`, `warn`, `unknown`, `paused` |
| `.Message` | The probe's own message — `HTTP 503 Service Unavailable` |
| `.LatencyMS` `.StatusCode` | From the most recent probe |
| `.DownSince` `.DownFor` | When the outage started, and how long it has lasted |
| `.Time` | When this alert was produced |
| `.URL` | A link to the dashboard, built from `base_url` |

```yaml
channels:
  - name: telegram
    type: telegram
    options:
      bot_token: "123456:ABC-DEF..."
      chat_id: "-1001234567890"
    body_template: |
      {{.Name}} is {{.Status}}
      {{.Message}}
      down for {{.DownFor}}
      {{.URL}}
```

A template that fails to parse, or that executes against a missing field, falls
back to the built-in wording for that event rather than losing the alert. An
alert with the wrong words is a nuisance; an alert that never arrives because a
template had a typo is a monitoring outage.

The built-in wording differs per event, so a recovery alert reads like a
recovery, not like a second outage.

## 🪝 Generic webhooks {#generic-webhooks}

A webhook channel sends JSON. The payload shape is part of the public API, so
additions to it stay backwards compatible:

```json
{
  "event": "down",
  "title": "Nextcloud is down",
  "message": "HTTP 503 Service Unavailable",
  "url": "https://probeglass.lan/#/dashboard",
  "timestamp": "2026-10-08T12:00:00Z",
  "sensor": {
    "id": 3,
    "name": "Nextcloud",
    "type": "http",
    "target": "https://cloud.example.org/status.php",
    "group": "Services",
    "tags": ["web"]
  },
  "result": {
    "ts": "2026-10-08T12:00:00Z",
    "success": false,
    "status_code": 503,
    "message": "HTTP 503 Service Unavailable",
    "latency_ms": 42.1
  },
  "incident": {
    "id": 17,
    "started_at": "2026-10-08T12:00:00Z",
    "cause": "HTTP 503 Service Unavailable"
  }
}
```

`title` and `message` are the rendered templates — the same text the chat
channels show. `incident` is present for `down`, `reminder`, and recovery
events, and carries `resolved_at` once the outage is over.

Two headers travel with it:

- `X-ProbeGlass-Event` — `down`, `up`, `reminder`, or `test`
- `X-ProbeGlass-Signature` — `sha256=<hex>`, present only when `hmac_secret`
  is set

The signature is HMAC-SHA256 over the **exact request body bytes**, so verify it
against the raw body before parsing:

```python
import hmac, hashlib, os
from flask import Flask, request, abort

app = Flask(__name__)
SECRET = os.environ["PROBEGLASS_HMAC"].encode()

@app.post("/hooks/probeglass")
def hook():
    expected = "sha256=" + hmac.new(SECRET, request.get_data(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, request.headers.get("X-ProbeGlass-Signature", "")):
        abort(401)
    event = request.headers["X-ProbeGlass-Event"]
    ...
```

`method` defaults to `POST`, and must be `POST`, `PUT`, or `PATCH`. It changes the
verb but not the body.

## 🔁 Delivery and retries {#delivery-and-retries}

Delivery runs off the scheduler goroutine: a slow chat webhook must never delay
the next probe. Each channel gets up to three attempts with a linear backoff,
and:

- `429` and `5xx` are retried — the service is busy or broken, and might not be
  in a moment.
- Other `4xx` responses are not — a bad token will not fix itself, and retrying
  it just makes the log noisier.

A channel that keeps failing has its error recorded and surfaced in the UI. It
does not block its siblings: the fan-out is one goroutine per channel.

## 🔒 A note on secrets in logs {#a-note-on-secrets-in-logs}

The Telegram sender strips the bot token out of error messages before they reach
a log line or the UI. That matters more than it sounds: the Telegram API puts the
token in the URL of every request, so a naive `%v` on a failed request would print
it — and log lines end up in bug reports and pasted into chat.

See [Security](/concepts/security) for the rest of the model.
