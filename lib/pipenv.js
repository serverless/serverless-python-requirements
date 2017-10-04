const BbPromise = require('bluebird');
const fse = require('fs-extra');
const path = require('path');
const {spawnSync} = require('child_process');

BbPromise.promisifyAll(fse);


/**
  * pipenv install
  * @return {Promise}
  */
function pipfileToRequirements() {
  if (!fse.existsSync(path.join(this.serverless.config.servicePath,
                                'Pipfile'))) {
    return BbPromise.resolve();
  }

  this.serverless.cli.log('Generating requirements.txt from Pipfile...');

  return new BbPromise((resolve, reject) => {
    const res = spawnSync('pipenv', ['lock', '--requirements']);
    if (res.error) {
      if (res.error.code === 'ENOENT')
        return reject(
          `pipenv not found! Install it with 'pip install pipenv'.`);
      return reject(res.error);
    }
    if (res.status != 0)
      return reject(res.stderr);
    fse.writeFileSync('.serverless/requirements.txt', res.stdout);
    resolve();
  });
};

module.exports = {pipfileToRequirements};
