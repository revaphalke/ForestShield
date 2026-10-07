#!/bin/sh
set -eu
cd /workspace
if ! curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8090/health; then
  make -C /workspace/c >/tmp/c-build.log 2>&1 || true
  if [ -x /workspace/c/forestshield ]; then /workspace/c/forestshield >>/tmp/c-server.log 2>&1 & fi
fi
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8081/; then exit 0; fi
npm run dev >>/tmp/app-startup.log 2>&1 &
