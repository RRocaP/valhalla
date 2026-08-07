#!/bin/bash
# Hero-image batch via Codex CLI's built-in gpt-image-2 (ChatGPT subscription).
# Usage: scripts/gen-heroes-codex.sh [ids...]   (default: all missing)
set -uo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/gen

BIBLE="Museum-grade prop photography, single warm hearth key light from upper left, deep black shadow falloff, carved dark oak with near-black recesses, worn gold leaf surviving on proud ridges, traces of old blood-red, fjord-blue and pine-green pigment deep in the carving grooves, Viking Age craftsmanship in Oseberg and Urnes style, photorealistic, dark background, no text, no letters, no watermark, no people."

gen() {
  local id="$1"; shift
  local prompt="$1"; shift
  [ -s "assets/gen/${id}.png" ] && { echo "skip ${id} (exists)"; return 0; }
  echo "=== ${id}"
  timeout 420 codex exec --sandbox workspace-write --cd "$(pwd)" \
    "Generate an image: ${prompt} ${BIBLE} Save the image file to assets/gen/${id}.png (PNG). Do nothing else." \
    > "artifacts/wip-magic/gen-${id}.log" 2>&1
  [ -s "assets/gen/${id}.png" ] && echo "ok ${id}" || echo "FAILED ${id}"
}

want() { [ $# -eq 0 ] && return 0; for w in "$@"; do [ "$w" = "$CUR" ] && return 0; done; return 1; }

for CUR in chest prow chart stones silver tafl ring rose bench; do
  if want "$@"; then
    case "$CUR" in
      chest) gen chest "A massive closed Viking sea-chest facing the camera straight on, portrait orientation, curved oak lid, three broad riveted iron straps, fifteen small round bronze lock medallions arranged in three arcs across the front, carved interlace borders, standing on stone flags in a dark mead-hall, ember glow pooling on the floor." ;;
      prow) gen prow "A carved wooden dragon figurehead from a Viking longship, side profile facing right, swept-back horns, rows of chip-carved scales down the recurved neck, snarling parted jaw with carved teeth, tight spiral snout, portrait orientation." ;;
      chart) gen chart "A captain's chart table seen top-down, landscape orientation: an aged vellum map of a Norse fjord coast with inked coastlines and tiny rock hatchings, brass dividers, a scored whalebone compass rose disc, a coil of tarred cord, all on dark oak." ;;
      stones) gen stones "Nine weathered rune-stones standing in a shallow arc on trampled dusk moorland, landscape orientation, each carved with runic bands, lichen and age, one taller law-rock at center, two distant torches, cold twilight with warm torchlight rims." ;;
      silver) gen silver "A Viking silver-court seen top-down, landscape orientation: twelve hack-silver fragments - cut coins, chopped ingots, bent arm-ring pieces - laid on dark wool cloth, a small hanging balance scale with bronze pans at rest above them, hammered textures, cold sheen." ;;
      tafl) gen tafl "A carved hnefatafl game board, 7x7 grid of inlaid squares worn smooth at the center, turned bone and dark tar-stained wooden pieces standing on it, a carved king piece, photographed at a shallow angle, landscape orientation." ;;
      ring) gen ring "A twisted gold Viking oath arm-ring, macro photograph, two thick gold rods twisted together with hammer facets, fourteen small sockets worked into the twist, one iron rivet, resting on a round oak plinth, square composition." ;;
      rose) gen rose "A scored whalebone compass disc, macro, 32-point wind rose construction scribed into aged bone, major points bold, cardinal marks carved as runes, salt rime at the edge, square composition." ;;
      bench) gen bench "A woodcarver's bench top-down, landscape orientation: a partly carved oak knotwork panel held by iron clamps, mallet and three chisels resting beside it, pale wood shavings, chalk stub, whetstone." ;;
    esac
  fi
done
echo BATCH-DONE
