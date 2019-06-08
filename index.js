'use strict';

const cron = require('node-cron');
const fs = require('fs');
const https = require('https');
const url = require('url');
const { exec } = require('child_process');

const cronSchedule = {
  m: '0 * * * * *',
  h: '0 0 * * * *',
  d: '0 0 0 * * *',
};

const webhookURL = process.env.WEBHOOK_URL || '';
const webhookType = process.env.WEBHOOK_TYPE || 'discord';

const schedule = cronSchedule[process.argv[2]] || cronSchedule.h;
const dataPath = process.argv[3] || './data.json';

const cronHandler = () => {
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
              alert(pkgName, latestVersion);
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
  });
}

function alert(pkgName, latestVersion) {
  const content = 'NEW VERSION RELEASED: ' + pkgName + ', version: ' + latestVersion;
  // assume discord now
  const body = JSON.stringify({
    content: content,
  });
  const urlInfo = url.parse(webhookURL);
  const req = https.request({
    host: urlInfo.host,
    path: urlInfo.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    }
  }, (res) => {
    console.log('Status: ' + res.statusCode);
    console.log('Headers: ' + JSON.stringify(res.headers));
  });
  req.on('error', (e) => {
    console.log('problem with request: ' + e.message);
  });
  req.write(body);
  req.end();
}

function logErrorAndExit(err) {
  console.error(err);
  process.exit(1);
}

//

cronHandler();

cron.schedule(schedule, cronHandler);

console.log('started');