#!/usr/bin/env node
const os = require("os");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { ncp } = require("ncp");
const commandLineArgs = require("command-line-args");
const Utils = require(path.resolve(__dirname, "../backend/libs/Utils.js"));

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

/* initial project */
const initialIndex = process.argv.indexOf("init");
const doInitial = initialIndex > -1;
if (doInitial) {
  const msg = "Initial Project";
  const projectArgv = process.argv[initialIndex + 1] || "CafecaProject";
  const projectName = path.parse(projectArgv).name;
  const basePath = process.cwd();
  const cafecaPath = path.resolve(__dirname, "../");
  const projectPath = path.resolve(basePath, projectArgv);
  console.log(`\x1b[1m\x1b[32m${msg}\x1b[0m\x1b[21m ${projectName}`);
  ncp(cafecaPath, projectPath, (err) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log("done!");
  });
  return;
}

/* update project */
const updateIndex = process.argv.indexOf("update");
const doUpdate = updateIndex > -1;
if (doUpdate) {
  const msg = "Update Project";
  const projectArgv = process.argv[updateIndex + 1] || "CafecaProject";
  const projectName = path.parse(projectArgv).name;
  const basePath = process.cwd();
  const cafecaPath = path.resolve(__dirname, "../");
  const projectPath = path.resolve(basePath, projectArgv);
  console.log(`\x1b[1m\x1b[32m${msg}\x1b[0m\x1b[21m ${projectName}`);
  ncp(
    cafecaPath,
    projectPath,
    {
      filter: (source) => {
        return (
          !/README.md$/.test(source) &&
          !/package.json$/.test(source) &&
          !/LICENSE$/.test(source)
        );
      },
    },
    (err) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log("done!");
    }
  );
  return;
}

/* normal process */
const optionDefinitions = [
  { name: "configPath", alias: "c", type: String },
  { name: "version", alias: "v", type: Boolean },
  { name: "start", alias: "s", type: Boolean },
  { name: "from", alias: "f", type: Number },
  { name: "only", alias: "o", type: Number },
  { name: "list", alias: "l", type: Boolean },
  { name: "kill", alias: "k", type: Number },
  { name: "pause", alias: "p", type: Number },
];

const argv = commandLineArgs(optionDefinitions);
const command = path.resolve(__dirname, "main.js");
const cfg = argv.configPath
  ? argv.configPath
  : path.resolve(__dirname, "../private/config.toml");

Utils.readConfig({ filePath: cfg })
  .then((config) => {
    const { packageInfo, homeFolder } = config;
    const systemHome = path.resolve(os.homedir(), packageInfo.name);
    const PIDHome = path.resolve(systemHome, "PIDs");
    return Utils.initialFolder({ homeFolder: systemHome })
      .then(() => Utils.initialFolder({ homeFolder: PIDHome }))
      .then(() => config);
  })
  .then((config) => {
    const { packageInfo, homeFolder } = config;
    console.log(
      `\x1b[1m\x1b[32m${packageInfo.name.toUpperCase()}\x1b[0m\x1b[21m v${
        packageInfo.version
      }`
    );
    if (argv.version) {
    } else if (argv.list) {
      Utils.listProcess();
    } else if (argv.kill > -1) {
      Utils.killProcess({ PID: argv.kill }).then(() => Utils.listProcess());
    } else if (argv.pause > -1) {
      Utils.killProcess({ PID: argv.pause, pause: true }).then(() =>
        Utils.listProcess()
      );
    } else if (!!argv.start) {
      const commandArgv = process.argv.slice(2);
      commandArgv.splice(commandArgv.indexOf("-s"), 1);

      Utils.initialFolder(config).then((folder) => {
        const outLog = path.resolve(folder, "out.log");
        const out = fs.openSync(outLog, "a");
        const err = fs.openSync(outLog, "a");
        spawn(command, commandArgv, {
          stdio: ["ignore", out, err],
          detached: true,
        }).unref();

        setTimeout(() => {
          Utils.listProcess({ packageInfo });
        }, 1000);
      });
    } else if (!argv.start) {
      Utils.initialAll(argv)
        .then((options) => Utils.initialBots(options))
        .then((Bots) => Utils.startBots({ Bots }))
        .catch((e) => {
          console.trace(e);
        });
    }
  })
  .catch(console.trace);

process.on("unhandledRejection", (error) => {
  // Will print "unhandledRejection err is not defined"
  console.log("unhandledRejection", error.message);
});
