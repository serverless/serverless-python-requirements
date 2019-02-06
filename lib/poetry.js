const fse = require('fs-extra');
const path = require('path');
const { spawnSync } = require('child_process');

/**
 * poetry install
 */
function pyprojectTomlToRequirements() {
  if (
    !this.options.usePoetry ||
    !fse.existsSync(path.join(this.servicePath, 'pyproject.toml'))
  ) {
    return;
  }

  this.serverless.cli.log('Generating requirements.txt from pyproject.toml...');

  const res = spawnSync(
    'poetry',
    ['export', '--without-hashes', '-f', 'requirements.txt'],
    {
      cwd: this.servicePath
    }
  );
  if (res.error) {
    if (res.error.code === 'ENOENT') {
      throw new Error(
        `poetry not found! Install it according to the poetry docs.`
      );
    }
    throw new Error(res.error);
  }
  if (res.status !== 0) {
    throw new Error(res.stderr);
  }
  fse.ensureDirSync(path.join(this.servicePath, '.serverless'));
  fse.moveSync(
    path.join(this.servicePath, 'requirements.txt'),
    path.join(this.servicePath, '.serverless', 'requirements.txt')
  );
}

module.exports = { pyprojectTomlToRequirements };
