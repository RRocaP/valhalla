#!/bin/bash
# OATHWOOD asset pipeline (lead-owned). Rerunnable. Sources in ~/Downloads.
# Crops chosen by eye from the originals; ffmpeg crop=w:h:x:y.
set -euo pipefail
cd "$(dirname "$0")/.."
DL=/Users/ramon/Downloads
mkdir -p assets/jarls

port() { # src, crop, outfile, width, q
  ffmpeg -y -hide_banner -loglevel error -i "$1" -vf "crop=$2,scale=$4:-2" -q:v "$5" "$3"
  printf '%-28s %s bytes\n' "$(basename "$3")" "$(stat -f%z "$3")"
}

port "$DL/507A4F22-82A0-42A1-9355-3BF4922D8DE7.PNG" "851:1094:0:230"   assets/jarls/bourj.jpg    700 7
port "$DL/8CB438D6-1370-4F78-B9A6-4CCD19614026.PNG" "1023:1316:0:40"   assets/jarls/rois.jpg     700 7
port "$DL/812BFAD7-1693-4B70-876E-C96ED234AB6C.PNG" "780:1002:240:30"  assets/jarls/andreas.jpg  700 7
port "$DL/IMG_7992.PNG"                             "1125:1446:0:495"  assets/jarls/folklore.jpg 700 7
port "$DL/3543D667-D8AA-4FF6-BDCA-001F117A49BA 2.PNG" "1086:1396:0:30" assets/jarls/arya.jpg     700 7
port "$DL/B52E1379-02C0-46D9-BEA5-DEB1E267F20F.PNG" "941:1660:0:6"     assets/tebi.jpg           760 6
port "$DL/D5EA0854-92D0-495C-9997-C7592EAB7DD4.PNG" "1086:1396:0:20"   assets/ramon.jpg          520 7
# Jarl Ålanø — second treasure (storm zipline; uniform grey bars y<445, y>1985)
port "$DL/Ruthless Viking Character.png"            "1125:1540:0:445"  assets/alano.jpg          700 7
# Ålanø forest variant — sticker pool only
port "$DL/C28AECF2-E8DB-449B-A4D2-FE02243A76C0.PNG" "1086:1448:0:0"    assets/alanof.jpg         640 7

# Music: gameplay loop = Frostbound Lullaby (measured: clean master, steady RMS);
# credits = Hjá Vindi. 128k CBR, 44.1k.
ffmpeg -y -hide_banner -loglevel error -i "$DL/Frostbound Lullaby.mp3" -codec:a libmp3lame -b:a 128k -ar 44100 music.mp3
ffmpeg -y -hide_banner -loglevel error -i "$DL/Hjá Vindi.mp3"          -codec:a libmp3lame -b:a 128k -ar 44100 credits.mp3
ls -la music.mp3 credits.mp3 | awk '{print $NF, $5" bytes"}'
