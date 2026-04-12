#!/bin/bash
mkdir -p ~/.ssh
printf "%s" "$SSH_KEY" > ~/.ssh/key.pem
chmod 400 ~/.ssh/key.pem
