#!/usr/bin/env sh
set -e

# We load .env inside the app using dotenv; prefer passing envs or --env-file.

exec node --enable-source-maps dist/index.js


