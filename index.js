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

const webhookURL = process.env.webhook_url || '';
const webhookType = process.env.webhook_type || 'discord';

const schedule = cronSchedule[process.argv[2]] || cronSchedule.h;
const dataPath = process.argv[3] || './data.json';

const cronHandler = () => {
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
      console.log('end at ' + Date.now());
      const jsonPrettified = JSON.stringify(pkgMap, null, 2);
      fs.writeFile(dataPath, jsonPrettified, (err) => err ? logErrorAndExit(err) : null);
    }).catch(err => logErrorAndExit(err));
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
  req.on('error', function (e) {
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