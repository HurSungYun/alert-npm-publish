'use strict';

const cron = require('node-cron');
const fs = require('fs');
const { exec } = require('child_process');

console.log('started');

cron.schedule('*/5 * * * * *', () => {
  fs.readFile('./data.json', 'utf8', function (err, contents) {
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
      fs.writeFile('./data.json', jsonPrettified, (err) => err ? logErrorAndExit(err) : null);
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