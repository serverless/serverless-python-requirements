const fse = require('fs-extra');
const path = require('path');
const spawn = require('child-process-ext/spawn');
const { EOL } = require('os');
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

  let res;

  try {
    await getUvVersion();
    res = await spawn('uv', ['export', '--no-dev', '--frozen', '--no-hashes'], {
      cwd: this.servicePath,
    });

    fse.ensureDirSync(path.join(this.servicePath, '.serverless'));
    fse.writeFileSync(
      path.join(this.servicePath, '.serverless/requirements.txt'),
      removeEditableFlagFromRequirementsString(res.stdoutBuffer)
    );
  } finally {
    generateRequirementsProgress && generateRequirementsProgress.remove();
  }
}

/**
 *
 * @param requirementBuffer
 * @returns Buffer with editable flags remove
 */
function removeEditableFlagFromRequirementsString(requirementBuffer) {
  const flagStr = '-e ';
  const commentLine = '#';
  const lines = requirementBuffer.toString('utf8').split(EOL);
  const newLines = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(flagStr)) {
      newLines.push(lines[i].substring(flagStr.length));
    }
    if (lines[i].startsWith(commentLine)) {
      continue;
    }
  }
  return Buffer.from(newLines.join(EOL));
}

module.exports = { uvToRequirements };
