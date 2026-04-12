#!/bin/bash
set -e

check() {
  PORT=$1
  echo "Testing $IP:$PORT ..."

  if curl -f --max-time 5 "$IP:$PORT/" >/dev/null; then
    echo "Port $IP is OK"
  else
    echo "Port $IP FAILED"
    exit 1
  fi
}

check 8080
check 4000
