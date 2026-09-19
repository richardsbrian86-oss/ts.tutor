# sandbox/

Your workspace. `tutor drill` writes exercises here; `tutor check` type-checks
and runs them. Each exercise is a pair of files:

- `<name>.ts` — the stub you fill in
- `<name>.test.ts` — the tests that decide whether you got it right

Nothing outside this directory is ever written to, and `tutor check` only
executes code that lives here.

Delete anything in here whenever you like — it is all disposable practice.
