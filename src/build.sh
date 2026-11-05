#!/bin/bash
# Gabungkan potongan src/ menjadi index.html (dokumen lengkap) di root repo.
# FRAGMENT=1 ./src/build.sh  -> juga menulis dist/artifact.html (tanpa <html>/<head>, untuk Claude Artifact).
set -e
cd "$(dirname "$0")"
IMPORTMAP='<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"}}</script>'
body() {
  cat p2_anat.html p3_docs1.html p3_docs2.html
  echo "$IMPORTMAP"
  echo '<script type="module">'
  cat p4_data.js p5_three.js p6_viz.js p7_ui.js
  echo '</script>'
}
{
  echo '<!doctype html>'
  echo '<html lang="id">'
  echo '<head>'
  echo '<meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  echo '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>'
  cat p1_head.html
  echo '</head>'
  echo '<body>'
  body
  echo '</body>'
  echo '</html>'
} > ../index.html
if [ "${FRAGMENT:-0}" = "1" ]; then
  mkdir -p ../dist
  { cat p1_head.html; body; } > ../dist/artifact.html
fi
echo "index.html: $(wc -c < ../index.html) byte"
