#!/bin/bash
set -e
echo "=== Rebuilding sharp for Linux ==="
cd /var/app/staging
npm rebuild sharp
echo "=== Sharp rebuild completed ==="
