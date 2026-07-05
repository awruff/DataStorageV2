#!/usr/bin/env bash
# Runs `packwiz update` on every pack under bundles/.mrpacks/<version>/<Bundle>,
# bumping mods to their latest stable versions (updates the source .pw.toml files).
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
MRPACKS_DIR="$SCRIPT_DIR/../data/oneclient/bundles/.mrpacks"

# shellcheck source=setup-packwiz.sh
source "$SCRIPT_DIR/setup-packwiz.sh"

for version in "$MRPACKS_DIR"/*; do
  [ -d "$version" ] || continue
  for bundle in "$version"/*; do
    [ -d "$bundle" ] || continue
    echo "Updating $bundle"
    ( cd "$bundle" && "$PACKWIZ_BIN" update -a -y --stable )
  done
done
