#!/usr/bin/env bash
# Builds the public site and publishes it to the gh-pages branch.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:pages
REMOTE="$(git remote get-url origin)"
TMP="$(mktemp -d)"
cp -r dist-pages/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name || echo deploy)" -c user.email="$(git -C "$OLDPWD" config user.email || echo deploy@local)" commit -q -m "Deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git push -f -q "$REMOTE" gh-pages
echo "Published to gh-pages. Live in 1 to 2 minutes."
