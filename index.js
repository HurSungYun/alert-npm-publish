'use strict';

const cron = require('node-cron');
const fs = require('fs');
const { exec } = require('child_process');

const cronSchedule = {
  m: '0 * * * * *',
  h: '0 0 * * * *',
  d: '0 0 0 * * *',
};

const schedule = cronSchedule[process.argv[2]] || cronSchedule.h;
const dataPath = process.argv[3] || './data.json';

console.log('started');

cron.schedule(schedule, () => {
  fs.readFile(dataPath, 'utf8', function (err, contents) {
    if (err) {
      logErrorAndExit(err);
    }
    let parsedData = '';
    try {
      parsedData = JSON.parse(contents);
    } catch (err) {
      logErrorAndExit(err);
      return;
    }
    const pkgMap = {};
    for (const pkgName in parsedData) {
      pkgMap[pkgName] = parsedData[pkgName];
    }
    const promises = [];
    for (const pkgName in pkgMap) {
      const pkgVersion = pkgMap[pkgName];
      const p = new Promise((resolve, reject) => {
        exec('npm dist-tag ls ' + pkgName, (err, stdout) => {
          if (err) {
            // node couldn't execute the command
            reject(err);
            return;
          }
          const tagAndVersions = stdout.split('\n').map(elem => elem.split(': '));
          const latestVersion = tagAndVersions.find(elem => elem[0] === 'latest')[1];
          if (latestVersion !== pkgVersion) {
            alert(pkgName, latestVersion);
            pkgMap[pkgName] = latestVersion;
          }
          resolve();
        });
      });
      promises.push(p);
    }
    Promise.all(promises).then(() => {
      const jsonPrettified = JSON.stringify(pkgMap, null, 2);
      fs.writeFile(dataPath, jsonPrettified, (err) => err ? logErrorAndExit(err) : null);
    }).catch(err => logErrorAndExit(err));
  })
});

function alert(pkgName, latestVersion) {
  console.log('NEW VERSION RELEASED: ' + pkgName + ', version: ' + latestVersion);
  // TODO: slack alarm
}

function logErrorAndExit(err) {
  console.error(err);
  process.exit(1);
}