const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const spawn = require('child-process-ext/spawn');
const tomlParse = require('@iarna/toml/parse-string');

/**
 * poetry install
 */
async function pyprojectTomlToRequirements() {
  if (!this.options.usePoetry || !isPoetryProject(this.servicePath)) {
    return;
  }

  this.serverless.cli.log('Generating requirements.txt from pyproject.toml...');

  try {
    await spawn(
      'poetry',
      [
        'export',
        '--without-hashes',
        '-f',
        'requirements.txt',
        '-o',
        'requirements.txt',
        '--with-credentials',
      ],
      {
        cwd: this.servicePath,
      }
    );
  } catch (e) {
    if (
      e.stderrBuffer &&
      e.stderrBuffer.toString().includes('command not found')
    ) {
      throw new Error(
        `poetry not found! Install it according to the poetry docs.`
      );
    }
    throw e;
  }

  const editableFlag = new RegExp(/^-e /gm);
  const sourceRequirements = path.join(this.servicePath, 'requirements.txt');
  const requirementsContents = fse.readFileSync(sourceRequirements, {
    encoding: 'utf-8',
  });

  if (requirementsContents.match(editableFlag)) {
    this.serverless.cli.log(
      'The generated file contains -e flags, removing them...'
    );
    fse.writeFileSync(
      sourceRequirements,
      requirementsContents.replace(editableFlag, '')
    );
  }

  fse.ensureDirSync(path.join(this.servicePath, '.serverless'));
  fse.moveSync(
    sourceRequirements,
    path.join(this.servicePath, '.serverless', 'requirements.txt'),
    { overwrite: true }
  );
}

/**
 * Check if pyproject.toml file exists and is a poetry project.
 */
function isPoetryProject(servicePath) {
  const pyprojectPath = path.join(servicePath, 'pyproject.toml');

  if (!fse.existsSync(pyprojectPath)) {
    return false;
  }

  const pyprojectToml = fs.readFileSync(pyprojectPath);
  const pyproject = tomlParse(pyprojectToml);

  const buildSystemReqs =
    (pyproject['build-system'] && pyproject['build-system']['requires']) || [];

  for (var i = 0; i < buildSystemReqs.length; i++) {
    if (buildSystemReqs[i].startsWith('poetry')) {
      return true;
    }
  }

  return false;
}

module.exports = { pyprojectTomlToRequirements, isPoetryProject };
