const fse = require('fs-extra');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * pipenv install
 */
function pipfileToRequirements() {
  if (
    !this.options.usePipenv ||
    !fse.existsSync(path.join(this.servicePath, 'Pipfile'))
  ) {
    return;
  }

  this.serverless.cli.log('Generating requirements.txt from Pipfile...');

  const res = spawnSync(
    'pipenv',
    ['lock', '--requirements', '--keep-outdated'],
    {
      cwd: this.servicePath
    }
  );
  if (res.error) {
    if (res.error.code === 'ENOENT') {
      throw new Error(
        `pipenv not found! Install it with 'pip install pipenv'.`
      );
    }
    throw new Error(res.error);
  }
  if (res.status !== 0) {
    throw new Error(res.stderr);
  }
  fse.ensureDirSync(path.join(this.servicePath, '.serverless'));
  fse.writeFileSync(
    path.join(this.servicePath, '.serverless/requirements.txt'),
    res.stdout
  );
}

module.exports = { pipfileToRequirements };
