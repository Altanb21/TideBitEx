pm2 kill
cd /home/ubuntu/workspace/TideBitEx/ && pm2 start /home/ubuntu/workspace/TideBitEx/bin/main.js
echo "I, [$(date +\%FT\%T.\%6N)] INFO -- : "restart… >> /home/ubuntu/workspace/TideBitEx/shell/restart.log
