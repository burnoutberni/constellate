# Development Setup

## Dependency Management

### Local Development
When running `npm run dev:app` or `npm run dev:server` locally:
- The `predev:app`/`predev:server` hooks automatically run `check-deps.js`
- This script checks if dependencies need updating based on file timestamps
- Only installs/updates if `package.json` or `package-lock.json` are newer than `node_modules`
- Works for both server and client dependencies

### Docker Development
When running via `docker-compose up`:
- **Dockerfile** installs dependencies at BUILD time (for faster builds)
- **dev-entrypoint.sh** handles dependencies at RUNTIME (necessary because volume mounts can hide build-time node_modules)
- The entrypoint script checks timestamps and only updates if needed
- `check-deps.js` detects Docker environment and skips (no redundancy)

### Why Both Dockerfile and dev-entrypoint.sh?
1. **Dockerfile** installs deps during image build for faster subsequent builds
2. **Volume mounts** (`.:/app`) can hide the build-time `node_modules`
3. **Anonymous volumes** (`/app/node_modules`) preserve deps but may be empty on first run
4. **dev-entrypoint.sh** ensures deps are always available at runtime, regardless of volume state

This is **not redundant** - it's a necessary pattern for Docker development with volume mounts.


