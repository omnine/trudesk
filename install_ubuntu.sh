#!/bin/bash

#Colors settings
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Author: Tasos Latsas

# Display an awesome 'spinner' while running your long shell commands
#
# Do *NOT* call _spinner function directly.
# Use {start,stop}_spinner wrapper functions

function _spinner() {
    # $1 start/stop
    #
    # on start: $2 display message
    # on stop : $2 process exit status
    #           $3 spinner function pid (supplied from stop_spinner)

    local on_success="DONE"
    local on_fail="FAIL"
    local white="\e[1;37m"
    local green="\e[1;32m"
    local red="\e[1;31m"
    local nc="\e[0m"

    case $1 in
        start)
            # calculate the column where spinner and status msg will be displayed
            let column=$(tput cols)-${#2}-8
            # display message and position the cursor in $column column
            echo -ne ${2}
            printf "%${column}s"

            # start spinner
            i=1
            sp='\|/-'
            delay=${SPINNER_DELAY:-0.15}

            while :
            do
                printf "\b${sp:i++%${#sp}:1}"
                sleep $delay
            done
            ;;
        stop)
            if [[ -z ${3} ]]; then
                echo "spinner is not running.."
                exit 1
            fi

            kill $3 > /dev/null 2>&1

            # inform the user uppon success or failure
            echo -en "\b["
            if [[ $2 -eq 0 ]]; then
                echo -en "${green}${on_success}${nc}"
            else
                echo -en "${red}${on_fail}${nc}"
            fi
            echo -e "]"
            ;;
        *)
            echo "invalid argument, try {start/stop}"
            exit 1
            ;;
    esac
}

function start_spinner {
    # $1 : msg to display
    _spinner "start" "${1}" &
    # set global spinner pid
    _sp_pid=$!
    disown
}

function stop_spinner {
    # $1 : command exit status
    _spinner "stop" $1 $_sp_pid
    unset _sp_pid
}

#Welcome message
clear;
echo -e " *                                               $$\                     $$\\";
echo -e " *                                               $$ |                    $$ |";
echo -e " * $$$$$$$\   $$$$$$\  $$$$$$$\   $$$$$$\   $$$$$$$ | $$$$$$\   $$$$$$$\ $$ |  $$\\";
echo -e " * $$  __$$\  \____$$\ $$  __$$\ $$  __$$\ $$  __$$ |$$  __$$\ $$  _____|$$ | $$  |";
echo -e " * $$ |  $$ | $$$$$$$ |$$ |  $$ |$$ /  $$ |$$ /  $$ |$$$$$$$$ |\$$$$$$\  $$$$$$  /";
echo -e " * $$ |  $$ |$$  __$$ |$$ |  $$ |$$ |  $$ |$$ |  $$ |$$   ____| \____$$\ $$  _$$<";
echo -e " * $$ |  $$ |\$$$$$$$ |$$ |  $$ |\$$$$$$  |\$$$$$$$ |\$$$$$$$\ $$$$$$$  |$$ | \$$\\";
echo -e " * \__|  \__| \_______|\__|  \__| \______/  \_______| \_______|\_______/ \__|  \__|";
echo -e " *  ========================================================================";
echo -e " *  Author:     Omnine";
echo -e "Welcome to Nanodesk Install Script for Ubuntu 20.04 (fresh)!
Lets make sure we have all the required packages before moving forward..."


echo -e "Setting Clock..."
# NTP=$(dpkg-query -W -f='${Status}' ntp 2>/dev/null | grep -c "ok installed")
#   if [ $(dpkg-query -W -f='${Status}' ntp 2>/dev/null | grep -c "ok installed") -eq 0 ];
#   then
#     echo -e "${YELLOW}Installing ntp${NC}"
#     apt-get install -y ntp ntpdate > /dev/null;
#     elif [ $(dpkg-query -W -f='${Status}' ntp 2>/dev/null | grep -c "ok installed") -eq 1 ];
#     then
#       echo -e "${GREEN}ntp is installed!${NC}"
#   fi
apt-get install -y ntp ntpdate > /dev/null;
systemctl stop ntp
ntpdate 0.pool.ntp.org 1.pool.ntp.org 2.pool.ntp.org
timedatectl
systemctl start ntp

#Checking packages
echo -e "${YELLOW}Checking packages...${NC}"
echo -e "List of required packages: git, wget, python, curl, nodejs, npm"

read -r -p "Do you want to check packages? [Y/n]: " response </dev/tty

case $response in
[nN]*)
  echo -e "${RED}
  Packages check is ignored!
  Please be aware that all software packages may not be installed!
  ${NC}"
  ;;

*)
start_spinner "Performing ${GREEN}apt-get update${NC}";
apt-get update > /dev/null;
stop_spinner $?;
WGET=$(dpkg-query -W -f='${Status}' wget 2>/dev/null | grep -c "ok installed")
  if [ $(dpkg-query -W -f='${Status}' wget 2>/dev/null | grep -c "ok installed") -eq 0 ];
  then
    start_spinner "${YELLOW}Installing wget${NC}"
    apt-get install wget --yes > /dev/null;
    stop_spinner $?
    elif [ $(dpkg-query -W -f='${Status}' wget 2>/dev/null | grep -c "ok installed") -eq 1 ];
    then
      echo -e "${GREEN}wget is installed!${NC}"
  fi
PYTHON=$(dpkg-query -W -f='${Status}' python 2>/dev/null | grep -c "ok installed")
  if [ $(dpkg-query -W -f='${Status}' python 2>/dev/null | grep -c "ok installed") -eq 0 ];
  then
    start_spinner "${YELLOW}Installing python${NC}"
    apt-get install python --yes > /dev/null;
    stop_spinner $?
    elif [ $(dpkg-query -W -f='${Status}' python 2>/dev/null | grep -c "ok installed") -eq 1 ];
    then
      echo -e "${GREEN}python is installed!${NC}"
  fi
CURL=$(dpkg-query -W -f='${Status}' curl 2>/dev/null | grep -c "ok installed")
  if [ $(dpkg-query -W -f='${Status}' curl 2>/dev/null | grep -c "ok installed") -eq 0 ];
  then
    start_spinner "${YELLOW}Installing curl${NC}"
    apt-get install curl --yes > /dev/null;
    stop_spinner $?
    elif [ $(dpkg-query -W -f='${Status}' curl 2>/dev/null | grep -c "ok installed") -eq 1 ];
    then
      echo -e "${GREEN}curl is installed!${NC}"
  fi
GIT=$(dpkg-query -W -f='${Status}' git 2>/dev/null | grep -c "ok installed")
  if [ $(dpkg-query -W -f='${Status}' git 2>/dev/null | grep -c "ok installed") -eq 0 ];
  then
    start_spinner "${YELLOW}Installing git${NC}"
    apt-get install git --yes > /dev/null;
    stop_spinner $?
    elif [ $(dpkg-query -W -f='${Status}' git 2>/dev/null | grep -c "ok installed") -eq 1 ];
    then
      echo -e "${GREEN}git is installed!${NC}"
  fi
NODEJS=$(dpkg-query -W -f='${Status}' nodejs 2>/dev/null | grep -c "ok installed")
  if [ $(dpkg-query -W -f='${Status}' nodejs 2>/dev/null | grep -c "ok installed") -eq 0 ];
  then
#https://github.com/nodesource/distributions/blob/master/README.md
# for development we need to install essential
# https://expeditedsecurity.com/blog/deploy-node-on-linux/  
    start_spinner "${YELLOW}Installing nodejs${NC}"
    curl -sL https://deb.nodesource.com/setup_lts.x | sudo -E bash > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1;
    apt-get install -y build-essential > /dev/null 2>&1;
    stop_spinner $?
    elif [ $(dpkg-query -W -f='${Status}' nodejs 2>/dev/null | grep -c "ok installed") -eq 1 ];
    then
      echo -e "${GREEN}nodejs is installed!${NC}"
  fi

  ;;
esac

echo -e ""

read -r -p "Do you want to install Nginx locally? [y/N]: " response </dev/tty

case $response in
[yY]*)
  start_spinner "${YELLOW}Installing Nginx${NC}"
  apt-get update > /dev/null;
  apt-get install nginx
  stop_spinner $?
  ;;
esac


read -r -p "Do you want to install Typesensesearch locally? [y/N]: " response </dev/tty

case $response in
[yY]*)
  start_spinner "${YELLOW}Installing Typesensesearch${NC}"
  apt-get update > /dev/null;

  wget https://dl.typesense.org/releases/0.20.0/typesense-server-0.20.0-amd64.deb > /dev/null 2>&1;
  dpkg -i typesense-server-0.20.0-amd64.deb > /dev/null;
  rm -rf typesense-server-0.20.0-amd64.deb  
  
  stop_spinner $?
  ;;
esac


read -r -p "Do you want to install Elasticsearch locally? [y/N]: " response </dev/tty

case $response in
[yY]*)
  start_spinner "${YELLOW}Installing Elasticsearch${NC}"
# https://linuxize.com/post/how-to-install-elasticsearch-on-ubuntu-20-04/
# sudo apt install apt-transport-https ca-certificates wget  
  wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo apt-key add - > /dev/null 2>&1
  
# https://www.digitalocean.com/community/tutorials/how-to-install-and-configure-elasticsearch-on-ubuntu-20-04
  echo "deb https://artifacts.elastic.co/packages/7.x/apt stable main" | sudo tee -a /etc/apt/sources.list.d/elastic-7.x.list > /dev/null 2>&1
  apt-get update > /dev/null;
  apt-get install -y default-jre > /dev/null 2>&1;
  apt-get install -y apt-transport-https elasticsearch kibana > /dev/null 2>&1;
  echo "network.host: [_local_]" >> /etc/elasticsearch/elasticsearch.yml
  systemctl enable elasticsearch
  systemctl start elasticsearch
  stop_spinner $?
  ;;
esac

read -r -p "Do you want to install MongoDB locally? [y/N]: " response </dev/tty
case $response in
[yY]*)
  start_spinner "${YELLOW}Installing MongoDB 4.4${NC}"
  # https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/
  wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo apt-key add -
  echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/4.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list > /dev/null 2>&1
  apt-get update > /dev/null;
  apt-get install -y mongodb-org mongodb-org-shell > /dev/null;
  systemctl start mongod
  
  # should we install the enterprise version? https://docs.mongodb.com/manual/tutorial/install-mongodb-enterprise-on-ubuntu/
  # block comment, https://stackoverflow.com/questions/947897/block-comments-in-a-shell-script
: <<'END'
  apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 2930ADAE8CAF5059EE73BB4B58712A2291FA4AD5 > /dev/null 2>&1
  echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.6 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.6.list > /dev/null 2>&1
  apt-get update > /dev/null;
  apt-get install -y mongodb-org mongodb-org-shell > /dev/null;
cat >/lib/systemd/system/mongod.service <<EOL
[Unit]
Description=High-performance, schema-free document-oriented database
After=network.target
Documentation=https://docs.mongodb.org/manual

[Service]
User=mongodb
Group=mongodb
ExecStart=/usr/bin/mongod --quiet --config /etc/mongod.conf

[Install]
WantedBy=multi-user.target
EOL
  systemctl enable mongod
  service mongod start
END

echo -e "";
echo -e "Waiting for MongoDB to start...";
sleep 10

# what authSchema is for? https://gist.github.com/michaeltreat/d3bdc989b54cff969df86484e091fd0c
# the admin collection in v4.4 won't be changed with the following commands
cat >/etc/mongosetup.js <<EOL
db.system.users.remove({});
db.system.version.remove({});
db.system.version.insert({"_id": "authSchema", "currentVersion": 3});
EOL
  mongo /etc/mongosetup.js > /dev/null 2>&1
  service mongod restart > /dev/null 2>&1

echo "Restarting MongoDB..."
sleep 5

cat > /etc/mongosetup_trudesk.js <<EOL
db = db.getSiblingDB('trudesk');
db.createUser({"user": "trudesk", "pwd": "#TruDesk1$", "roles": ["readWrite", "dbAdmin"]});
EOL
  mongo /etc/mongosetup_trudesk.js > /dev/null 2>&1
  stop_spinner $?
  ;;
*)
  echo -e "${RED}MongoDB install skipped...${NC}"
#  start_spinner "${YELLOW}Installing MongoDB Tools...${NC}"
#  wget https://repo.mongodb.org/apt/ubuntu/dists/xenial/mongodb-org/3.6/multiverse/binary-amd64/mongodb-org-tools_3.6.9_amd64.deb > /dev/null 2>&1;
#  dpkg -i mongodb-org-tools_3.6.9_amd64.deb > /dev/null;
#  rm -rf mongodb-org-tools_3.6.9_amd64.deb
#  stop_spinner $?
  ;;
esac

start_spinner "${YELLOW}Downloading the latest version of ${NC}Nanodesk${RED}.${NC}"
cd /etc/
git clone https://github.com/omnine/trudesk > /dev/null 2>&1;
cd /etc/trudesk
touch /etc/trudesk/logs/output.log
stop_spinner $?
start_spinner "${BLUE}Building...${NC} (its going to take a few minutes)"
npm install -g yarn pm2 grunt-cli > /dev/null 2>&1;
# Lets checkout the version tag
git checkout nanomain > /dev/null 2>&1;
yarn install > /dev/null 2>&1;
sleep 3
stop_spinner $?
# This last line must be all in one command due to the exit nature of the build command.
start_spinner "${BLUE}Starting...${NC}" && NODE_ENV=production pm2 start /etc/trudesk/app.js --name trudesk -l /etc/trudesk/logs/output.log --merge-logs > /dev/null && pm2 save > /dev/null && pm2 startup > /dev/null 2>&1 && stop_spinner $? && echo -e "${GREEN}Installation Complete.${NC}"
