#!/usr/bin/env bash
# Ensures `packwiz` is available and exports $PACKWIZ_BIN pointing at it.
#
# Intended to be *sourced* by the other bundle scripts:
#   source "path/to/setup-packwiz.sh"
#
# Resolution order:
#   1. `packwiz` already on PATH
#   2. A previously downloaded copy cached next to this script
#   3. Download the Polyfrost packwiz fork (Linux x86-64 only)
set -euo pipefail

_PACKWIZ_SETUP_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

_packwiz_download() {
  local url="$1" out="$2"
  if command -v wget >/dev/null 2>&1; then
    wget -qO "$out" "$url"
  elif command -v curl >/dev/null 2>&1; then
    curl -fLso "$out" "$url"
  else
    echo "Error: Neither wget nor curl is installed; cannot download packwiz." >&2
    return 1
  fi
}

if command -v packwiz >/dev/null 2>&1; then
  PACKWIZ_BIN="$(command -v packwiz)"
  echo "Using packwiz from PATH: $PACKWIZ_BIN"
elif [[ -x "$_PACKWIZ_SETUP_DIR/packwiz" ]]; then
  PACKWIZ_BIN="$_PACKWIZ_SETUP_DIR/packwiz"
  echo "Using cached packwiz: $PACKWIZ_BIN"
elif [[ "$(uname -s)" == "Linux" ]]; then
  if ! command -v unzip >/dev/null 2>&1; then
    echo "Error: unzip is required to set up packwiz." >&2
    return 1
  fi
  echo "packwiz not found, downloading Polyfrost fork (Linux x86-64)"
  _url="https://nightly.link/Polyfrost/packwiz/workflows/go/main/Linux%2064-bit%20x86.zip"
  _zip="$_PACKWIZ_SETUP_DIR/packwiz-linux.zip"
  _packwiz_download "$_url" "$_zip"
  unzip -o -q "$_zip" -d "$_PACKWIZ_SETUP_DIR"
  rm -f "$_zip"
  chmod +x "$_PACKWIZ_SETUP_DIR/packwiz"
  PACKWIZ_BIN="$_PACKWIZ_SETUP_DIR/packwiz"
else
  echo "Error: packwiz not found on $(uname -s). Install packwiz and rerun." >&2
  return 1
fi

export PACKWIZ_BIN
