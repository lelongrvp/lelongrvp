#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
regular="$(base64 < "$root/scripts/fonts/JetBrainsMono-Regular.woff2" | tr -d '\n')"
bold="$(base64 < "$root/scripts/fonts/JetBrainsMono-Bold.woff2" | tr -d '\n')"

export FONT_FACES="@font-face{font-family:'JetBrains Mono';font-weight:400;src:url(data:font/woff2;base64,${regular}) format('woff2')}@font-face{font-family:'JetBrains Mono';font-weight:700;src:url(data:font/woff2;base64,${bold}) format('woff2')}"

for source in "$root"/assets/src/*.svg; do
  perl -pe 's/\{\{FONT_FACES\}\}/$ENV{FONT_FACES}/g' "$source" > "$root/assets/$(basename "$source")"
done
