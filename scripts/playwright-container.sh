#!/bin/sh
# Run Playwright inside the official container image that matches the
# installed @playwright/test version, so screenshots render the same fonts
# locally and in CI (.github/workflows/test.yml uses the same image).
#
#   sh scripts/playwright-container.sh tests/visual [playwright args...]
#
# Uses podman, or docker if podman is missing. The container gets its own
# node_modules volume, so the host install is left alone.
set -eu

cd "$(dirname "$0")/.."

if [ -n "${PLAYWRIGHT_IN_CONTAINER:-}" ]; then
  exec npx playwright test "$@"
fi

version=$(node -p "require('@playwright/test/package.json').version")
image="mcr.microsoft.com/playwright:v${version}-noble"

if command -v podman >/dev/null 2>&1; then
  engine=podman
  # Rootless podman maps container root to you, so new files are yours.
  user_args=""
elif command -v docker >/dev/null 2>&1; then
  engine=docker
  user_args="--user $(id -u):$(id -g) -e HOME=/tmp"
else
  echo "playwright-container: install podman or docker to run the visual tests." >&2
  exit 1
fi

volume="cardz-playwright-node-modules-${version}"
tty_args=""
[ -t 1 ] && tty_args="-t"

# shellcheck disable=SC2086
exec "$engine" run --rm -i $tty_args $user_args \
  -v "$PWD:/work:z" \
  -v "$volume:/work/node_modules" \
  -w /work \
  -e PLAYWRIGHT_IN_CONTAINER=1 \
  -e NPM_CONFIG_UPDATE_NOTIFIER=false \
  -e CI \
  "$image" \
  sh -c '
    set -e
    stamp=node_modules/.lock-hash
    hash=$(sha256sum package-lock.json | cut -d" " -f1)
    if [ "$(cat "$stamp" 2>/dev/null)" != "$hash" ]; then
      npm ci --no-audit --no-fund
      echo "$hash" > "$stamp"
    fi
    exec npx playwright test "$@"
  ' sh "$@"
