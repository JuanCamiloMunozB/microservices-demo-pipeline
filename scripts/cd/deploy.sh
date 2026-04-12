#!/bin/bash
user=ec2-user
ssh_key_location=~/.ssh/key.pem
app_directory=/home/ec2-user/microservices
worker_directory=$app_directory/worker
result_directory=$app_directory/result
vote_directory=$app_directory/vote

scp -o StrictHostKeyChecking=no -i $ssh_key_location ./docker-compose-deploy.yml $user@$IP:$app_directory

ssh -o StrictHostKeyChecking=no -i "$ssh_key_location" "$user@$IP" "
set -e

for dir in '$worker_directory' '$vote_directory' '$result_directory'; do
  mkdir -p \"\$dir\"
done

printf '%s' \"$ENV_WORKER\" > \"$worker_directory/.env\"
printf '%s' \"$ENV_VOTE\" > \"$vote_directory/.env\"
printf '%s' \"$ENV_RESULT\" > \"$result_directory/.env\"
"

ssh -o StrictHostKeyChecking=no -i $ssh_key_location $user@$IP "cd $app_directory && docker compose -f $app_directory/docker-compose-deploy.yml up -d --build"

