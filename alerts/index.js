'use strict';

const alerts = {
  discord: require('./discord'),
  slack: require('./slack'),
};

module.exports = alerts;