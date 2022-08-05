pm2 kill
cd /home/okex/workspace/TideBitEx/ && pm2 start bin/main.js
echo "I, [$(date +\%FT\%T.\%6N)] INFO -- : "restart… >> /home/okex/workspace/TideBitEx/shell/restart.log
