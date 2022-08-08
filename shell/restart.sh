pm2 kill
cd ./workspace/TideBitEx/ && pm2 start bin/main.js
echo "I, [$(date +\%FT\%T.\%6N)] INFO -- : "restart… >> ./workspace/TideBitEx/shell/restart.log
