#!/bin/bash
# Run as user data when the ec2 instance is initialize 

user=ec2-user
app_directory=/home/ec2-user/microservices
set -e
exec > /var/log/user-data.log 2>&1

# docker 
yum update -y
yum install -y docker
systemctl start docker 
systemctl enable docker 
usermod -a -G docker $user

# docker compose
DOCKER_CONFIG=${DOCKER_CONFIG:-/home/$user/.docker}
mkdir -p $DOCKER_CONFIG/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v5.1.2/docker-compose-linux-x86_64 -o $DOCKER_CONFIG/cli-plugins/docker-compose
chmod +x $DOCKER_CONFIG/cli-plugins/docker-compose

# app directory 
mkdir $app_directory
chown -R $user:$user $app_directory
docker --version
