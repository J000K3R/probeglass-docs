---
title: Contributing
sidebar_label: Contributing
description: How to build, test, and send a patch — including how to add a probe engine, an alert channel, and a language.
---

# Contributing

ProbeGlass stays small on purpose. Every contribution — a bug report, a docs fix,
a new probe engine — helps, and the constraints in the
[roadmap](/development/roadmap#guiding-constraints) are what keep it small.

The authoritative version of this page lives in the repository as
[CONTRIBUTING.md](https://github.com/j000k3r/probeglass/blob/main/CONTRIBUTING.md).
What follows is the part that needs more room than a file in the repository root.

## Development setup

- Go 1.27 or newer.
- Docker, if you want to build and test the image.

```bash
git clone https://github.com/j000k3r/probeglass.git
cd probeglass
make help          # lists every target
make run           # build and serve on :8080, data in ./data
make test          # the test suite
make test-race     # the same, under the race detector
make test-browser  # the dashboard, in a real browser
make lint          # golangci-lint
make cover         # coverage report
```

There is no frontend build step. Edit a file in `internal/web/assets`, reload the
page, and you are looking at your change. Nothing is compiled, bundled, or
minified.

## The browser test

Everything else in the suite talks to the API, and that is where the sharpest
limit of the suite used to be. The dashboard once shipped a bug where
`/api/session` and `/api/summary` both answered `200`, the data arrived, and the
whole thing was covered by a full-height loading spinner that never went away —
because `[hidden]` is a user-agent rule and a `.boot { display: grid }` in our
own stylesheet outranks it. No check that does not lay a page out can see that,
and the two states are identical from the server's side of the socket.

So there is one test that renders a page:

```bash
make test-browser          # needs Chrome or Chromium; skips without one
cd e2e && go test ./... -v # the same thing
```

It starts the real binary on a free port with a throwaway data directory, drives
a headless browser through first-run setup — choose a password, submit — and then
asserts on what is on screen: the spinner is gone, the shell is up, exactly one
view is visible, and a reload does not send you back to the login form. On
failure it writes a screenshot, which says more about a stuck spinner than a
stack trace does.

A browser is found automatically, or `PROBEGLASS_E2E_BROWSER` names one. With
none, the test skips — unless `PROBEGLASS_E2E_REQUIRE_BROWSER=1`, which CI sets
so that a missing browser can never quietly pass as coverage.

It lives in `e2e/`, a module of its own, and that is deliberate: a browser driver
is a large dependency and it belongs to the harness, not to the thing being
shipped. Keeping it in a separate module is what keeps the product's `go.mod` at
SQLite, `x/net`, `x/crypto` and `yaml.v3`. Note that `go test ./...` in the
repository root does not descend into it; the CI job runs it by name.

## Adding a probe engine

One file in `internal/sensor`, implementing three methods:

```go
type Prober interface {
    Type() model.SensorType
    Validate(model.Sensor) error
    Run(context.Context, model.Sensor) (Outcome, error)
}
```

Then register it, and it appears in the UI: the sensor-type list, the validation
endpoint, and the scheduler all read from the same registry.

Guidelines that matter more than they look:

- **Validate the target, not just the options.** The UI calls `Validate` on a draft
  before saving, so a bad target is caught while the user is still looking at the
  field. The error text is shown verbatim — write it for a human.
- **Read options through the typed accessors.** `Options.Str`, `.Int`, `.Bool` return
  a default for anything missing or of the wrong type, which is what keeps a sensor
  saved by an older version working. A `count` that arrives as a string must fall
  back to the default, not become zero.
- **Report what failed, precisely.** `permission denied` on a raw socket and
  `i/o timeout` are different problems with different fixes, and a sensor that says
  "failed" sends the user looking in the wrong place.
- **Test against a real socket.** A local `httptest` server, a real TCP listener, a
  DNS stub built with `dnsmessage` — the interesting failures live in the interaction
  with the network, and a mock hides exactly those.

## Adding an alert channel

One file in `internal/notify`, plus a definition in `types.go`. The definition is
what the UI builds its form from, so a field added there shows up in the dashboard
with no frontend change at all.

Two rules:

- **Mark credentials `Secret: true`.** The API replaces every field so marked with a
  marker on the way out and preserves the stored value when the marker comes back.
  A token that is not marked leaks into every API response.
- **Strip credentials from error messages.** The Telegram API puts the bot token in
  the URL of every request, so a naive `%v` on a failed request prints it, and log
  lines end up in bug reports. There is a test for this one.

## Adding a language

The dashboard has no user-facing strings in its markup — everything goes through
`t()` or a `data-i18n` attribute — so a new language is:

1. A dictionary object in `internal/web/assets/i18n.js`, with every key the English
   catalogue has. English is the reference catalogue; a missing key is a bug.
2. That language's code in the `available` list and in the server's allowed UI
   values.

Nothing else changes. German is the first planned addition.

## Coding guidelines

- Write idiomatic Go, and run `gofmt` on everything you touch. CI fails on
  unformatted code.
- Keep dependencies minimal, and justify any new one in the pull request. The current
  set is SQLite, `x/net`, `x/crypto`, and `yaml.v3`.
- Do not add a frontend dependency. No npm, no bundler, no CDN. This is a
  constraint, not a preference.
- Prefer table-driven tests, and add a test for every behaviour change.
- Conventional-commit messages: `fix(scheduler): avoid drift on long intervals`.

## The two things that are easy to get wrong

**Close your `Rows`.** The store runs on a single connection by design, so a
`*sql.Rows` that is never closed blocks every other request in the process — not
just that one query. This is the sharpest edge in the codebase.

**Keep timestamps in the fixed-width format.** `2006-01-02T15:04:05.000000000Z`, never
`RFC3339Nano`. The shorter form drops trailing zeros, and `…:00.5Z` then sorts
*before* `…:00Z`, which silently breaks every range query. Write them with the
helpers in `internal/store`, and read the comment on the format before you decide it
is over-cautious.

## Security alerts

CodeQL and GitHub's secret scanning run on every push. The `Security alerts`
workflow looks at both tabs again every Monday and fails when an alert is open,
so a finding nobody opened does not sit there unnoticed.

The same check locally:

```bash
GH_TOKEN=... make security
```

The token is a fine-grained personal access token with **Code scanning alerts:
read** and **Secret scanning alerts: read** (Metadata is added automatically).
The Actions `GITHUB_TOKEN` can read code scanning but not secret scanning; the
workflow uses a repository secret named `SECURITY_ALERTS_TOKEN` when it is
configured and falls back to `GITHUB_TOKEN` for the half it can read. Without
that secret the job says which half it could not check — it does not pretend to
have checked both.

Two findings are expected in this codebase and are dismissed with their reason
rather than silenced:

- **The HTTP and redirect sensors, and the MOS discovery client, make a request
  to an address an administrator chose.** That request is the sensor or the
  discovery; refusing private addresses would make it unable to watch the homelab
  it exists for. CodeQL calls it request forgery.
- **The session cookie is not `Secure` on a plain-HTTP homelab.** It is
  `Secure` whenever the request arrived over TLS, directly or through a proxy
  sending `X-Forwarded-Proto: https`; on plain HTTP the flag would make the
  browser drop the cookie and lock everyone out.

Everything else is fixed, not dismissed. A new alert of either shape above is
not automatically the same decision — read it first.

## Pull requests

1. Branch from `main` (`feat/dns-sensor-timeout`).
2. Keep it focused on one change.
3. Add tests, or say in the description why they do not apply.
4. Update `CHANGELOG.md` under `Unreleased`.
5. Confirm `make lint` and `make test` pass locally — and `make test-browser` if
   you touched the dashboard's markup, styles, or JavaScript.

## Documentation

Two repositories: the code, and this documentation site. A change that alters
behaviour should update the pages that describe it — the same pull request is
easiest for everyone. Documentation issues are welcome in either repository.

## Reporting a bug

Include the version from `probeglass version`, how you deployed it, what you
expected, what happened, and the relevant logs with secrets redacted. If it is a
dashboard problem, the browser console output is worth more than a screenshot.

Security problems: please do not open a public issue. See
[SECURITY.md](https://github.com/j000k3r/probeglass/blob/main/SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the MIT
License.
