#!/bin/sh
cd "$(dirname "$0")" && exec npx esbuild src/main.ts --bundle --format=iife --target=es2022 --sourcemap --outfile=site/main.js "$@"
