#!/bin/sh
# Build the game and deploy it (with the functions above) to Cloudflare Pages.
set -e
cd "$(dirname "$0")"
rm -rf public && cp -R ../../dist public && rm -f public/_redirects
cp public/src/ui/index.html public/index.html
npx wrangler pages deploy --project-name three-am-nostalgia --branch main --commit-dirty=true
