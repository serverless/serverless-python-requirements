const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');

const tomlParse = require('@iarna/toml/parse-string');

function pyprojectTomlToRequirements(modulePath, pluginInstance) {
  const { serverless, servicePath, options, log, progress } = pluginInstance;

  const moduleProjectPath = path.join(servicePath, modulePath);
  if (!options.usePyProject || !isPyProjectProject(moduleProjectPath)) {
    return;
  }

  let generateRequirementsProgress;
  if (progress && log) {
    generateRequirementsProgress = progress.get(
      'python-generate-requirements-toml'
    );
  } else {
    serverless.cli.log('Generating requirements.txt from pyproject.toml');
  }

  try {
    const pyprojectPath = path.join(servicePath, 'pyproject.toml');
    const pyprojectToml = fs.readFileSync(pyprojectPath);
    const pyproject = tomlParse(pyprojectToml);

    const dependencies = pyproject['project']['dependencies'];

    if (options.pyprojectWithGroups) {
      for (const optionalDep of options.pyprojectWithGroups) {
        try {
          dependencies.push(
            ...pyproject['project']['optional-dependencies'][optionalDep]
          );
        } catch (e) {
          if (log) {
            log.warn(
              'Optional dependency (%s) not found in pyproject.toml',
              optionalDep
            );
          }
        }
      }
    }

    fse.ensureDirSync(path.join(servicePath, '.serverless'));
    fse.writeFileSync(
      path.join(servicePath, '.serverless/requirements.txt'),
      dependencies.join('\n')
    );
  } finally {
    generateRequirementsProgress && generateRequirementsProgress.remove();
  }
}

function isPyProjectProject(servicePath) {
  const pyprojectPath = path.join(servicePath, 'pyproject.toml');

  if (!fse.existsSync(pyprojectPath)) {
    return false;
  }

  const pyprojectToml = fs.readFileSync(pyprojectPath);
  const pyproject = tomlParse(pyprojectToml);

  if (pyproject['project'] && pyproject['project']['dependencies']) {
    return true;
  }

  return false;
}

module.exports = { pyprojectTomlToRequirements, isPyProjectProject };
