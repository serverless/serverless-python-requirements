const _ = require('lodash');

/**
 * Inject '.requirements' folder into serverless package exclude list.
 */
function excludeRequirementsFolder() {
  if (!_.get(this.serverless.service, 'package.exclude'))
    _.set(this.serverless.service, ['package', 'exclude'], []);
  this.serverless.service.package.exclude.push('.requirements/**');
  if (!_.get(this.serverless.service, 'package.include'))
    _.set(this.serverless.service, ['package', 'include'], []);
}

module.exports = {excludeRequirementsFolder};
