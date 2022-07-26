#!/usr/bin/env node
const path = require("path");
const os = require("os");
const Utils = require(path.resolve(__dirname, "../backend/libs/Utils.js"));
const dbMigrationFolder = path.resolve(__dirname, "../dbmigrations");
const { Sequelize } = require("sequelize");

const cfg = path.resolve(__dirname, "../private/config.toml");

(async () => {
  const config = Utils.readConfig({ filePath: cfg });
  const initDBSequelize = new Sequelize(
    config.database.dbName,
    config.database.user,
    config.database.password,
    config.database,
    {
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
    .map(async (filePath) => {
      const contentBuffer = await Utils.readFile({
        filePath,
      });
      const content = contentBuffer.toString();
      await initDBSequelize.query({ query: content });
    });
})();
