const fse = require('fs-extra');
const path = require('path');
const spawn = require('child-process-ext/spawn');
const semver = require('semver');

async function getUvVersion() {
  try {
    const res = await spawn('uv', ['--version'], {
      cwd: this.servicePath,
    });

    const stdoutBuffer =
      (res.stdoutBuffer && res.stdoutBuffer.toString().trim()) || '';

    const version = stdoutBuffer.split(' ')[1];

    if (semver.valid(version)) {
      return version;
    } else {
      throw new this.serverless.classes.Error(
        `Unable to parse uv version!`,
        'PYTHON_REQUIREMENTS_UV_VERSION_ERROR'
      );
    }
  } catch (e) {
    const stderrBufferContent =
      (e.stderrBuffer && e.stderrBuffer.toString()) || '';

    if (stderrBufferContent.includes('command not found')) {
      throw new this.serverless.classes.Error(
        `uv not found! Install it according to the uv docs.`,
        'PYTHON_REQUIREMENTS_UV_NOT_FOUND'
      );
    } else {
      throw e;
    }
  }
}

/**
 * uv to requirements.txt
 */
async function uvToRequirements() {
  if (
    !this.options.useUv ||
    !fse.existsSync(path.join(this.servicePath, 'uv.lock'))
  ) {
    return;
  }

  let generateRequirementsProgress;
  if (this.progress && this.log) {
    generateRequirementsProgress = this.progress.get(
      'python-generate-requirements-uv'
    );
    generateRequirementsProgress.update(
      'Generating requirements.txt from uv.lock'
    );
    this.log.info('Generating requirements.txt from uv.lock');
  } else {
    this.serverless.cli.log('Generating requirements.txt from uv.lock...');
  }

  try {
    await getUvVersion();
    fse.ensureDirSync(path.join(this.servicePath, '.serverless'));
    const requirementsPath = path.join(
      this.servicePath,
      '.serverless/requirements.txt'
    );
    await spawn(
      'uv',
      ['export', '--no-dev', '--frozen', '--no-hashes', '-o', requirementsPath],
      {
        cwd: this.servicePath,
      }
    );
  } finally {
    generateRequirementsProgress && generateRequirementsProgress.remove();
  }
}

module.exports = { uvToRequirements };
