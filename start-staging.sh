#!/bin/bash
cd ~/Desktop/dnx-suite || exit 1
pkill -f next || true
npx dotenv-cli -e apps/compramelafoto/.env.staging.local -- pnpm --filter compramelafoto dev & \
npx dotenv-cli -e apps/fotorank/.env.staging.local -- pnpm --filter fotorank dev
