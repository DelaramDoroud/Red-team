#!/bin/sh
set -eu

npm i --no-audit --no-fund --include=dev
npm run debug