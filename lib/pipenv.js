import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { EOL } from 'os';
import semver from 'semver';
import child from 'child_process';
import { exists } from './shared.js';
import { promisify } from 'util';
const execFile = promisify(child.execFile);

const LEGACY_PIPENV_VERSION = '2022.8.5';

async function getPipenvVersion(serviceDir) {
  try {
    const res = await execFile('pipenv', ['--version'], {
      cwd: serviceDir,
    });

    const stdout = (res.stdout && res.stdout.toString().trim()) || '';

    const version = stdout.split(' ')[2];

    if (semver.valid(version)) {
      return version;
    } else {
      throw new this.serverless.classes.Error(
        `Unable to parse pipenv version!`,
        'PYTHON_REQUIREMENTS_PIPENV_VERSION_ERROR'
      );
    }
  } catch (e) {
    if (e.message.includes('command not found')) {
      throw new this.serverless.classes.Error(
        `pipenv not found! Install it according to the pipenv docs.`,
        'PYTHON_REQUIREMENTS_PIPENV_NOT_FOUND'
      );
    } else {
      throw e;
    }
  }
}

/**
 * pipenv install
 */
async function pipfileToRequirements() {
  if (
    !this.options.usePipenv ||
    !(await exists(join(this.serviceDir, 'Pipfile')))
  ) {
    return;
  }

  let generateRequirementsProgress = this.progress.get(
    'python-generate-requirements-pipfile'
  );
  generateRequirementsProgress.update(
    'Generating requirements.txt from Pipfile'
  );
  this.log.info('Generating requirements.txt from Pipfile');

  try {
    // Get and validate pipenv version
    this.log.info('Getting pipenv version');
    const pipenvVersion = await getPipenvVersion(this.serviceDir);
    let res;

    if (semver.gt(pipenvVersion, LEGACY_PIPENV_VERSION)) {
      // Using new pipenv syntax ( >= 2022.8.13)
      // Generate requirements from existing lock file.
      // See: https://pipenv.pypa.io/en/latest/advanced/#generating-a-requirements-txt
      try {
        res = await execFile('pipenv', ['requirements'], {
          cwd: this.serviceDir,
        });
      } catch (e) {
        if (e.message.includes('FileNotFoundError')) {
          // No previous Pipfile.lock, we will try to generate it here
          this.log.warning(
            'No Pipfile.lock found! Review https://pipenv.pypa.io/en/latest/pipfile/ for recommendations.'
          );
          await execFile('pipenv', ['lock'], {
            cwd: this.serviceDir,
          });
          res = await execFile('pipenv', ['requirements'], {
            cwd: this.serviceDir,
          });
        } else {
          throw e;
        }
      }
    } else {
      // Falling back to legacy pipenv syntax
      res = await execFile('pipenv', ['lock', '--requirements'], {
        cwd: this.serviceDir,
      });
    }

    await mkdir(join(this.serviceDir, '.serverless'), { recursive: true });
    await writeFile(
      join(this.serviceDir, '.serverless/requirements.txt'),
      removeEditableFlagFromRequirementsString(res.stdout)
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

export { pipfileToRequirements };
