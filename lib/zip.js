const fse = require('fs-extra');
const path = require('path');
const get = require('lodash.get');
const set = require('lodash.set');
const zipper = require('zip-local');
const BbPromise = require('bluebird');
const values = require('lodash.values');

BbPromise.promisifyAll(fse);

/**
 * add the vendor helper to the current service tree
 * @return {Promise}
 */
function addVendorHelper() {
  if (this.options.zip) {
    let promises = [];
    if (this.serverless.service.package.individually) {
      values(this.serverless.service.functions)
        .forEach((f) => {
          this.serverless.cli.log(`Adding Python requirements helper to ${f.module}...`);

          if (!get(f, 'package.include')) {
            set(f, ['package', 'include'], []);
          }

          f.package.include.push('unzip_requirements.py');

          promises.push(fse.copyAsync(
            path.resolve(__dirname, '../unzip_requirements.py'),
            path.join(this.servicePath, f.module, 'unzip_requirements.py')
          ));
        });
      return BbPromise.all(promises);
    } else {
      this.serverless.cli.log('Adding Python requirements helper...');

      if (!get(this.serverless.service, 'package.include')) {
        set(this.serverless.service, ['package', 'include'], []);
      }

      this.serverless.service.package.include.push('unzip_requirements.py');

      return fse.copyAsync(
        path.resolve(__dirname, '../unzip_requirements.py'),
        path.join(this.servicePath, 'unzip_requirements.py')
      );
    }
  }
};

/**
 * remove the vendor helper from the current service tree
 * @return {Promise}
 */
function removeVendorHelper() {
  if (this.options.zip && this.options.cleanupZipHelper) {
    let promises = [];
    if (this.serverless.service.package.individually) {
      values(this.serverless.service.functions)
        .forEach((f) => {
          this.serverless.cli.log(`Removing Python requirements helper from ${f.module}...`);
          return fse.removeAsync(path.join(this.servicePath, f.module, 'unzip_requirements.py'));
        });
      return BbPromise.all(promises);
    } else {
      this.serverless.cli.log('Removing Python requirements helper...');
      return fse.removeAsync(path.join(this.servicePath, 'unzip_requirements.py'));
    }
  }
};

/**
 * zip up .serverless/requirements
 */
function packRequirements() {
  if (this.options.zip) {
    if (this.serverless.service.package.individually) {
      values(this.serverless.service.functions)
        .forEach((f) => {
          this.serverless.cli.log(`Zipping required Python packages for ${f.module}...`);
          f.package.include.push(`${f.module}/.requirements.zip`);
          zipper
            .sync
            .zip(`.serverless/${f.module}/requirements`)
            .compress()
            .save(`${f.module}/.requirements.zip`);
        });
    } else {
      this.serverless.cli.log('Zipping required Python packages...');
      this.serverless.service.package.include.push('.requirements.zip');
      zipper
        .sync
        .zip(path.join(this.servicePath, '.serverless/requirements'))
        .compress()
        .save(this.servicePath, '.requirements.zip');
    }
  }
}

module.exports = {addVendorHelper, removeVendorHelper, packRequirements};
