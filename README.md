# TideBitEx
TideBit Exchange

## General Requirements

### remove build/index.html

- [TideBit-Legacy](https://github.com/CAFECA-IO/TideBit-Lagacy)
- Node.js: v14.17.6
- pm2

## Getting started

### setup TideBit-Legacy
- Setup [TideBit-Legacy](https://github.com/CAFECA-IO/TideBit-Lagacy)

### Node.js
TideBit-Legacy使用的Node.js版本較舊，只用於編譯UI，跑完就可以換版本了。

```sh
vi install.sh
```

```sh
#!/bin/bash

###
### Prepare Environment ###
###

### Install Library ###
sudo apt-get update
sudo apt-get install openssl libtool autoconf automake uuid-dev build-essential gcc g++ software-properties-common unzip make git libcap2-bin -y

### Setup Swap ###
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab


NODE_VERSION="v14.17.6"
NODE_FILENAME="node-$NODE_VERSION-linux-x64"
PARENT_LOCATION="/opt/nodejs"

###
### Install NodeJS & PM2 ###
###

### Download NodeJS ###
cd /usr/local/src
sudo wget -nc http://nodejs.org/dist/$NODE_VERSION/$NODE_FILENAME.tar.gz
#wget -E -H -k -K -p http:///
sudo tar zxvf $NODE_FILENAME.tar.gz
sudo mkdir -p $PARENT_LOCATION
sudo mv $NODE_FILENAME $PARENT_LOCATION/

### Link binary files ###
rm -f /usr/local/bin/node
rm -f /usr/local/bin/npm
sudo ln -s $PARENT_LOCATION/$NODE_FILENAME/bin/node /usr/local/bin
sudo ln -s $PARENT_LOCATION/$NODE_FILENAME/bin/npm /usr/local/bin

### assign 80 & 443 port ###
sudo setcap 'cap_net_bind_service=+ep' $PARENT_LOCATION/$NODE_FILENAME/bin/node

### Install PM2 ###
sudo npm i -g pm2
sudo ln -s $PARENT_LOCATION/$NODE_FILENAME/bin/pm2 /usr/local/bin

pm2 install pm2-logrotate

```

```shell
sh install.sh
rm install.sh
```

### clone Project
```sh
git clone https://github.com/CAFECA-IO/TideBitEx.git
cd TideBitEx
npm i
```

### 設定config
```sh
mkdir private
vi private/config.toml
```

可參照`default.config.toml`，略過`[api]`, `[base]`

sample:
```toml
# 請參考 https://www.okx.com/docs-v5/broker_zh/#non-disclosed-broker 申請
[okex]
domain = 'https://www.okx.com'
apiKey = 'your-api-key'
secretKey = 'your-api-secretKey'
passPhrase = 'your-api-passPhrase'
brokerId = '377bd372412fSCDE'

[peatio]
domain = 'http://127.0.0.1:3000'      # 要與TideBit-Legacy application.yml中URL_HOST相同

[redis]
domain = 'redis://127.0.0.1:6379'

[database]
protocol = 'mysql'
host = '127.0.0.1'
port = '3306'
user = 'tidebitstaging'
password = 'tidebitstaging'
dbName = 'tidebitstaging'
logging = false
ormEnable = false
  [database.dialectOptions]
  connectTimeout = 3000
  [database.pool]
  max = 10

```

### 設定 tradingview config
Sample:
in private/config
```
export const baseUrl = 'new.tidebit.com';
export const wsUrl = 'ws.tidebit.network/ws';
```
將 private/config.js 複製到 public/tradingview/config.js
```
cp private/config.js public/tradingview/config.js
```

### 設定markets
```sh
vi private/marketsSource.toml
```
可參照`default.marketsSource.toml`，所有的instId都以tb開頭
| 欄位名稱 | 解釋 |
| ---- | ---- |
| key | instId(大寫)，以`tb`開頭，ex: tbETH-USDT |
| value | 來源字串，請參考```backend/bots/constants/SupportedExchange.js``` |

需要同時有定義交易對名稱以及來源名稱

sample:
```toml
[markets]
BTCUSD = 'BTC-USD'
tbBTC-USD = 'TideBit'
```
### db migrate
```
chmod a+x bin/dbmigrate.js 
npm run dbmigrate
```
### 啟動
之後便可以使用pm2掛載
```sh
pm2 start bin/main.js
```

正常執行後會看到
```
[PM2] Spawning PM2 daemon with pm2_home=/home/ubuntu/.pm2
[PM2] PM2 Successfully daemonized
[PM2][Module] Starting NPM module pm2-logrotate
[PM2][WARN] Applications pm2-logrotate not running, starting...
[PM2] App [pm2-logrotate] launched (1 instances)
[PM2] Starting /home/ubuntu/workspace/TideBitEx/bin/main.js in fork_mode (1 instance)
[PM2] Done.
```

再執行
```
pm2 log 1
```
會看到
```
DB    tidebitstaging connect success
register options ...
...
HTTP   http://127.0.0.1:80
HTTPS  https://127.0.0.1:443
```

之後有在TidebitEX上做修改後需重啟
```
pm2 restart bin/main.js
```

組合log一起使用
```
pm2 restart bin/main.js && pm2 log 1
```

關閉掛載
```
pm2 kill
```

## trouble shoot

### ENOTFOUND
https://phoenixnap.com/kb/mysql-remote-connection

### ER_ACCESS_DENIED_ERROR
https://stackoverflow.com/questions/58107591/authentication-failure-when-connecting-to-mysql-as-non-root-user

### Redis Client Error Error: connect ECONNREFUSED
```sh
sudo service redis-server restart
sudo service redis-server status
```

