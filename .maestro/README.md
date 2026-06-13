# E2E tests (Maestro)

Maestro drives the real app on a simulator/emulator for critical happy-path flows.
It's a thin smoke layer on top of the Jest unit/integration tests — not a
replacement for them.

## One-time install

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash
```

(See https://maestro.mobile.dev for details. Maestro is a system binary, not an
npm dependency.)

## Running

Build and launch a dev client / simulator build first (e.g. `npm run ios`), then:

```bash
npm run e2e                       # all flows
maestro test .maestro/smoke.yaml  # just the smoke test (no account needed)

# Credentialed flows need a real test account:
EMAIL=you@example.com PASSWORD=secret maestro test .maestro/sign-in.yaml
EMAIL=you@example.com PASSWORD=secret maestro test .maestro/create-hangout.yaml
```

## Flows

| File                  | Needs account | Covers |
|-----------------------|:-------------:|--------|
| `smoke.yaml`          | no            | App launches and reaches welcome/home. Start here. |
| `sign-in.yaml`        | yes           | Email sign-in → Home. |
| `create-hangout.yaml` | yes           | Sign in → open "Plan a hangout" → type picker. |

## Notes

- `appId` is `com.hangoutplanner.app` (from `config/app.config.ts`).
- Selectors match on-screen **text/labels** (e.g. "Sign in", "Plan a hangout").
  If a label changes in the UI, update the matching flow.
- `create-hangout.yaml` intentionally stops at the type picker; extend it with the
  specific path (Food / Movie / Sports / Activity) you want to guard. The full
  end-to-end scripts (vote, bills, ratings) live in `docs/QA-CHECKLIST.md` for
  manual runs until they're worth automating here.
