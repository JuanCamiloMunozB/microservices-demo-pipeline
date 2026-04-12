#!/bin/bash
set -e

check() {
  PORT=$1
  echo "Testing $IP:$PORT ..."

  TIMEOUT=60
  INTERVAL=3
  END=$((SECONDS + TIMEOUT))

  while [ $SECONDS -lt $END ]; do
    if curl -f --max-time 5 "$IP:$PORT/" >/dev/null 2>&1; then
      echo "Port $PORT is OK"
      return 0
    fi

    sleep $INTERVAL
  done

  echo "Port $PORT FAILED"
  exit 1
}

check 8080
check 4000