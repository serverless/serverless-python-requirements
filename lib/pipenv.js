const fse = require('fs-extra');
const path = require('path');
const spawn = require('child-process-ext/spawn');
const { EOL } = require('os');

/**
 * pipenv install
 */
async function pipfileToRequirements() {
  if (
    !this.options.usePipenv ||
    !fse.existsSync(path.join(this.servicePath, 'Pipfile'))
  ) {
    return;
  }

  let generateRequirementsProgress;
  if (this.progress && this.log) {
    generateRequirementsProgress = this.progress.get(
      'python-generate-requirements-pipfile'
    );
    generateRequirementsProgress.update(
      'Generating requirements.txt from Pipfile'
    );
    this.log.info('Generating requirements.txt from Pipfile');
  } else {
    this.serverless.cli.log('Generating requirements.txt from Pipfile...');
  }

  try {
    try {
      await spawn('pipenv', ['lock', '--keep-outdated'], {
        cwd: this.servicePath,
      });
    } catch (e) {
      const stderrBufferContent =
        (e.stderrBuffer && e.stderrBuffer.toString()) || '';

      if (stderrBufferContent.includes('must exist to use')) {
        // No previous Pipfile.lock, we will try to generate it here
        await spawn('pipenv', ['lock'], {
          cwd: this.servicePath,
        });
      } else if (stderrBufferContent.includes('command not found')) {
        throw new this.serverless.classes.Error(
          `pipenv not found! Install it according to the poetry docs.`,
          'PYTHON_REQUIREMENTS_PIPENV_NOT_FOUND'
        );
      } else {
        throw e;
      }
    }
    const res = await spawn('pipenv', ['requirements'], {
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
  const lines = requirementBuffer.toString('utf8').split(EOL);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(flagStr)) {
      lines[i] = lines[i].substring(flagStr.length);
    }
  }
  return Buffer.from(lines.join(EOL));
}

module.exports = { pipfileToRequirements };
