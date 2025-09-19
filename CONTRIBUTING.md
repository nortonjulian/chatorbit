# Contributing to ChatOrbit

## Dev setup
1) `npm ci` at repo root  
2) `cp server/.env.example server/.env` and edit  
3) `npm run -w server prisma:generate && npm run -w server prisma:migrate dev`  
4) Run: `npm run -w server dev` and `npm run -w client dev`

## Coding standards
- ESLint + Prettier must pass (`npm run lint`, `npm run format:check`).
- Keep functions small; prefer pure helpers inside `/services` or `/utils`.
- Add/extend tests for any non-trivial change.

## Commit messages
- Conventional commits preferred: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.

## PR checklist
- [ ] Lint/format/test pass locally
- [ ] Update docs/README if routes or env changed
- [ ] Include screenshots for UI changes (if applicable)
