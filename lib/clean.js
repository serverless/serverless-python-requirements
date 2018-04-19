const BbPromise = require('bluebird');
const fse = require('fs-extra');
const path = require('path');
const values = require('lodash.values');

BbPromise.promisifyAll(fse);

/**
 * clean up .requirements and .requirements.zip and unzip_requirements.py
 * @return {Promise}
 */
function cleanup() {
  const artifacts = ['.requirements'];
  if (this.options.zip) {
    if (this.serverless.service.package.individually) {
      values(this.serverless.service.functions).forEach(f => {
        artifacts.push(path.join(f.module, '.requirements.zip'));
        artifacts.push(path.join(f.module, 'unzip_requirements.py'));
      });
    } else {
      artifacts.push('.requirements.zip');
      artifacts.push('unzip_requirements.py');
    }
  }

  return BbPromise.all(
    artifacts.map(artifact =>
      fse.removeAsync(path.join(this.servicePath, artifact))
    )
  );
}

module.exports = { cleanup };
