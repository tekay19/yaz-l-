#!/usr/bin/env bash
# Nightly Postgres dump, kept 14 days. Photos are not backed up on purpose:
# they live at most 14 days and must not survive in backups.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
docker compose exec -T db pg_dump -U sinavoku -Fc sinavoku > "backups/sinavoku-$(date +%F).dump"
find backups -name 'sinavoku-*.dump' -mtime +14 -delete
