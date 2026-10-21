#!/bin/bash
# Renders the five TV mascot loops and encodes them for public/monitor/mascot/.
# Owner's pick (21 Oct 2026): vinyl mascot on the navy "C" studio stage.
#
#   BLENDER=/path/to/blender ./scripts/mascot/render-loops.sh            # all poses
#   BLENDER=/path/to/blender ./scripts/mascot/render-loops.sh wave point # some
#
# Blender 4.2 LTS, Cycles on CPU: about 20 s a frame, 48 frames a pose.
# Each loop is 2 s at 24 fps and seamless (every motion is periodic in t),
# written 4× into the file so the TV restarts the video less often.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
B="${BLENDER:-blender}"
out="${OUT:-/tmp/pr-os-mascot}"
dst="$root/public/monitor/mascot"
poses=("$@"); [ ${#poses[@]} -eq 0 ] && poses=(idle wave announce point celebrate)
mkdir -p "$dst"
for p in "${poses[@]}"; do
  "$B" -b --python "$here/mascot.py" -- --style vinyl --pose "$p" --stage --w 700 --h 450 \
    --anim --frames 48 --samples 16 --out "$out/$p/"
  ffmpeg -loglevel error -y -stream_loop 3 -framerate 24 -i "$out/$p/%04d.png" \
    -c:v libx264 -profile:v main -level 4.0 -pix_fmt yuv420p -crf 21 -preset slow -g 48 \
    -movflags +faststart -an "$dst/$p.mp4"
  ffmpeg -loglevel error -y -stream_loop 3 -framerate 24 -i "$out/$p/%04d.png" \
    -c:v libvpx-vp9 -b:v 0 -crf 33 -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p -g 48 -an "$dst/$p.webm"
  ffmpeg -loglevel error -y -i "$out/$p/0000.png" -q:v 3 "$dst/$p.jpg"
  echo "done $p"
done
