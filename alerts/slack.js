const url = require('url');
const https = require('https');

module.exports = function alert(webhookURL, pkgName, latestVersion) {
  const content = 'NEW VERSION RELEASED: ' + pkgName + ', version: ' + latestVersion;
  // assume discord now
  const body = JSON.stringify({
    text: content,
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
};