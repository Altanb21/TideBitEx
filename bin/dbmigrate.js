#!/usr/bin/env node
const path = require("path");
const Utils = require(path.resolve(__dirname, "../backend/libs/Utils.js"));
const dbMigrationFolder = path.resolve(__dirname, "../dbmigrations");
const { Sequelize } = require("sequelize");

const cfg = path.resolve(__dirname, "../private/config.toml");

(async () => {
  const config = await Utils.readConfig({ filePath: cfg });
  // console.log(`config`,config)
  const initDBSequelize = new Sequelize(
    config.database.dbName,
    config.database.user,
    config.database.password,
    {
      dialect: "mysql",
      host: config.database.host,
      pool: {
        max: 20,
        min: 0,
        acquire: 60000,
        idle: 10000,
      },
    }
  );
  await initDBSequelize.authenticate();
  // scanFolder
  const files = await Utils.scanFolder({ folder: dbMigrationFolder });
  const jobs = files
    .filter((filePath) => filePath.includes(".sql"))
    .sort()
    .map(
      (filePath) => () =>
        Utils.readFile({
          filePath,
        })
    );
  // console.log(`jobs`, jobs);
  const contents = await new Promise(async (resolve, reject) => {
    Utils.waterfallPromise(jobs, 1000).then((contentBuffer) => {
      // console.log(`contentBuffer`, contentBuffer);
      const queries = contentBuffer.reduce((prev, curr) => {
        const content = curr.toString().split(";");
        prev = prev.concat(content);
        return prev;
      }, []);
      resolve(queries);
    });
  });
  // console.log(`contents`, contents);
  const queries = contents
    .filter((content) => content.trim().length > 0)
    .map(
      (content) => () =>
        initDBSequelize.query({ query: `${content};` }).catch(console.log)
    );
  // console.log(`queries`, queries);
  await Utils.waterfallPromise(queries, 1000);
})();
