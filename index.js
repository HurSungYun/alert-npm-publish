'use strict';

const cron = require('node-cron');
const fs = require('fs');
const https = require('https');
const alerts = require('./alerts/index');

const cronSchedule = {
  h: '0 0 * * * *',
  d: '0 0 0 * * *',
};

const argv = require('minimist')(process.argv.slice(2)); // type(t), cron(c), file(f)

const webhookURL = process.env.WEBHOOK_URL || '';
const webhookType = argv.type || argv.t || '';

const alertFunc = alerts[webhookType];

if (!alertFunc) {
  console.error('webhookType is invalid: ' + webhookType);
  process.exit(1);
}

const schedule = cronSchedule[argv.cron] || cronSchedule[argv.c] || argv.cron || argv.c || cronSchedule.h;
const dataPath = argv.file || argv.f || './example/watchlist.json';

let raceFlag = false;

const cronHandler = () => {
  if (raceFlag) {
    console.error('skip due to race: ' + Date.now());
    return;
  }
  raceFlag = true;
  fs.readFile(dataPath, 'utf8', async (err, contents) => {
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
    for (const pkgName in pkgMap) {
      const pkgVersion = pkgMap[pkgName];
      await new Promise((resolve, reject) => {
        const req = https.request({
          host: 'registry.npmjs.org',
          path: '/-/package/' + pkgName + '/dist-tags',
          method: 'GET',
        }, (res) => {
          if (res.statusCode !== 200) {
            logErrorAndExit('problem with package: ' + pkgName);
          }
          res.setEncoding('utf8');
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            let obj = {};
            try {
              obj = JSON.parse(body);
            } catch (e) {
              logErrorAndExit(err);
              return;
            }
            const latestVersion = obj.latest;
            if (latestVersion !== pkgVersion) {
              alertFunc(webhookURL, pkgName, latestVersion);
              pkgMap[pkgName] = latestVersion;
            }
            resolve();
          });
        });
        req.on('error', (e) => {
          console.log('problem with request: ' + e.message);
          reject(e);
        });
        req.end();
      });
    }
    console.log('end at ' + Date.now());
    const jsonPrettified = JSON.stringify(pkgMap, null, 2);
    fs.writeFile(dataPath, jsonPrettified, (err) => err ? logErrorAndExit(err) : null);
    raceFlag = false;
  });
}

function logErrorAndExit(err) {
  console.error(err);
  process.exit(1);
}

//

cronHandler();

cron.schedule(schedule, cronHandler);

console.log('started');