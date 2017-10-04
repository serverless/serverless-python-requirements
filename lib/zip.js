const fse = require('fs-extra');
const path = require('path');
const {zipDirectory} = require('./zipService');

/**
 * add the vendor helper to the current service tree
 * @return {Promise}
 */
function addVendorHelper() {
  if (this.options.zip) {
    this.serverless.cli.log('Adding Python requirements helper...');

    this.serverless.service.package.include.push('unzip_requirements.py');

    return fse.copyAsync(
      path.resolve(__dirname, '../unzip_requirements.py'),
      path.join(this.serverless.config.servicePath, 'unzip_requirements.py'));
  }
};

/**
 * remove the vendor helper from the current service tree
 * @return {Promise}
 */
function removeVendorHelper() {
  if (this.options.zip && this.options.cleanupZipHelper) {
    this.serverless.cli.log('Removing Python requirements helper...');
    return fse.removeAsync(path.join(this.serverless.config.servicePath, 'unzip_requirements.py'));
  }
};

/**
 * zip up .requirements
 * @return {Promise}
 */
function packRequirements() {
  if (this.options.zip) {
    this.serverless.cli.log('Zipping required Python packages...');
    this.serverless.service.package.include.push('.requirements.zip');
    return zipDirectory('.requirements', '.requirements.zip');
  }
}

module.exports = {addVendorHelper, removeVendorHelper, packRequirements};
