import { readFile, mkdir, writeFile, rename } from 'fs/promises';
import { join } from 'path';
import { exists } from './shared.js';
import tomlParse from '@iarna/toml/parse-string.js';
import child from 'child_process';
import { promisify } from 'util';
const execFile = promisify(child.execFile);

/**
 * poetry install
 */
async function pyprojectTomlToRequirements(modulePath, pluginInstance) {
  const { serverless, serviceDir, options, log, progress } = pluginInstance;

  const moduleProjectPath = join(serviceDir, modulePath);
  if (!options.usePoetry || !(await isPoetryProject(moduleProjectPath))) {
    return;
  }

  let generateRequirementsProgress = progress.get(
    'python-generate-requirements-toml'
  );

  const emitMsg = (msg) => {
    generateRequirementsProgress.update(msg);
    log.info(msg);
  };

  if (await exists('poetry.lock')) {
    emitMsg('Generating requirements.txt from poetry.lock');
  } else {
    if (options.requirePoetryLockFile) {
      throw new serverless.classes.Error(
        'poetry.lock file not found - set requirePoetryLockFile to false to ' +
          'disable this error',
        'MISSING_REQUIRED_POETRY_LOCK'
      );
    }
    emitMsg('Generating poetry.lock and requirements.txt from pyproject.toml');
  }

  try {
    await execFile(
      'poetry',
      [
        'export',
        '--without-hashes',
        '--format=requirements.txt',
        '--output=requirements.txt',
        '--with-credentials',
        ...(options.poetryWithGroups.length
          ? [`--with=${options.poetryWithGroups.join(',')}`]
          : []),
        ...(options.poetryWithoutGroups.length
          ? [`--without=${options.poetryWithoutGroups.join(',')}`]
          : []),
        ...(options.poetryOnlyGroups.length
          ? [`--only=${options.poetryOnlyGroups.join(',')}`]
          : []),
      ],
      {
        cwd: moduleProjectPath,
      }
    );
    const editableFlag = new RegExp(/^-e /gm);
    const sourceRequirements = join(moduleProjectPath, 'requirements.txt');
    const requirementsContents = await readFile(sourceRequirements, {
      encoding: 'utf-8',
    });

    if (requirementsContents.match(editableFlag)) {
      log.info('The generated file contains -e flags, removing them');
      await writeFile(
        sourceRequirements,
        requirementsContents.replace(editableFlag, '')
      );
    }

    await mkdir(join(serviceDir, '.serverless', modulePath), {
      recursive: true,
    });
    await rename(
      sourceRequirements,
      join(serviceDir, '.serverless', modulePath, 'requirements.txt')
    );
  } catch (e) {
    if (e.message.includes('command not found')) {
      throw new serverless.classes.Error(
        `poetry not found! Install it according to the poetry docs.`,
        'PYTHON_REQUIREMENTS_POETRY_NOT_FOUND'
      );
    }
    throw e;
  } finally {
    generateRequirementsProgress.remove();
  }
}

/**
 * Check if pyproject.toml file exists and is a poetry project.
 */
async function isPoetryProject(serviceDir) {
  const pyprojectPath = join(serviceDir, 'pyproject.toml');

  if (!(await exists(pyprojectPath))) {
    return false;
  }

  const pyprojectToml = await readFile(pyprojectPath);
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

export { pyprojectTomlToRequirements, isPoetryProject };
