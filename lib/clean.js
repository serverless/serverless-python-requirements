const BbPromise = require('bluebird');
const fse = require('fs-extra');
const path = require('path');
const _ = require('lodash');

BbPromise.promisifyAll(fse);


/**
  * clean up .requirements and .requirements.zip and unzip_requirements.py
  * @return {Promise}
  */
function cleanup() {
  const artifacts = ['.requirements'];
  if (this.options.zip) {
    artifacts.push('.requirements.zip');
    artifacts.push('unzip_requirements.py');
  }

  return BbPromise.all(_.map(artifacts, (artifact) => fse.removeAsync(
    path.join(this.servicePath, artifact))));
};

module.exports = {cleanup};
