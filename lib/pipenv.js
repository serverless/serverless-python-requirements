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

  this.serverless.cli.log('Generating requirements.txt from Pipfile...');

  let res;
  try {
    res = await spawn('pipenv', ['lock', '--requirements', '--keep-outdated'], {
      cwd: this.servicePath,
    });
  } catch (e) {
    if (
      e.stderrBuffer &&
      e.stderrBuffer.toString().includes('command not found')
    ) {
      throw new Error(
        `pipenv not found! Install it with 'pip install pipenv'.`
      );
    }
    throw e;
  }
  fse.ensureDirSync(path.join(this.servicePath, '.serverless'));
  fse.writeFileSync(
    path.join(this.servicePath, '.serverless/requirements.txt'),
    removeEditableFlagFromRequirementsString(res.stdoutBuffer)
  );
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
