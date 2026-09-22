# Cloud storage

Where the projects on this site keep your data: one private GitHub repository you own, or this browser alone.

Open `web-projects/cloud-storage/` (linked from the bottom of the Playground) to paste a fine-grained GitHub token, name the private data repository, see the three checks pass, choose what to keep when a project's data differs between this device and the cloud, and export or import every project's data as one file.

## How it works

- A project that keeps something you made saves it in this browser first, and to `triunity-studios-data/<project>/<file>.json` in your repository when a token is set up.
- Two devices editing at once do not overwrite each other: records merge one by one, and the newer edit wins.
- The token stays in this browser and goes to `api.github.com` and nowhere else.

## For developers

The shared module every web-project imports. `AGENTS.md` holds the module map and the adoption checklist; `PLAN.md` holds the phased plan; root ADR 0016 holds the decision.

## Tests

```bash
bun test
```
