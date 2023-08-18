import isWsl from 'is-wsl';
import { join } from 'path';
import { release } from 'os';
import { exists } from './shared.js';
import child from 'child_process';
import { promisify } from 'util';
const execFile = promisify(child.execFile);

/**
 * Helper function to run a docker command
 * @param {string[]} options
 * @return {Object}
 */
async function dockerCommand(options, pluginInstance) {
  const cmd = 'docker';
  try {
    return await execFile(cmd, options, { encoding: 'utf-8' });
  } catch (e) {
    if (e.message.includes('command not found')) {
      throw new pluginInstance.serverless.classes.Error(
        'docker not found! Please install it.',
        'PYTHON_REQUIREMENTS_DOCKER_NOT_FOUND'
      );
    }
    throw e;
  }
}

/**
 * Build the custom Docker image
 * @param {string} dockerFile
 * @param {string[]} extraArgs
 * @return {string} The name of the built docker image.
 */
async function buildImage(dockerFile, extraArgs, pluginInstance) {
  const imageName = 'sls-py-reqs-custom';
  const options = ['build', '-f', dockerFile, '-t', imageName];

  if (Array.isArray(extraArgs)) {
    options.push(...extraArgs);
  } else {
    throw new pluginInstance.serverless.classes.Error(
      'dockerRunCmdExtraArgs option must be an array',
      'PYTHON_REQUIREMENTS_INVALID_DOCKER_EXTRA_ARGS'
    );
  }

  options.push('.');

  await dockerCommand(options, pluginInstance);
  return imageName;
}

/**
 * Find a file that exists on all projects so we can test if Docker can see it too
 * @param {string} serviceDir
 * @return {string} file name
 */
async function findTestFile(serviceDir, pluginInstance) {
  if (await exists(join(serviceDir, 'serverless.yml'))) {
    return 'serverless.yml';
  }
  if (await exists(join(serviceDir, 'serverless.yaml'))) {
    return 'serverless.yaml';
  }
  if (await exists(join(serviceDir, 'serverless.json'))) {
    return 'serverless.json';
  }
  if (await exists(join(serviceDir, 'requirements.txt'))) {
    return 'requirements.txt';
  }
  throw new pluginInstance.serverless.classes.Error(
    'Unable to find serverless.{yml|yaml|json} or requirements.txt for getBindPath()',
    'PYTHON_REQUIREMENTS_MISSING_GET_BIND_PATH_FILE'
  );
}

/**
 * Test bind path to make sure it's working
 * @param {string} bindPath
 * @return {boolean}
 */
async function tryBindPath(bindPath, testFile, pluginInstance) {
  const { log } = pluginInstance;
  const options = [
    'run',
    '--rm',
    `-v=${bindPath}:/test`,
    'alpine',
    'ls',
    `/test/${testFile}`,
  ];
  try {
    log.debug(`Trying bindPath ${bindPath} (${options})`);
    const ps = await dockerCommand(options, pluginInstance);
    log.debug(ps.stdout.toString().trim());
    return ps.stdout.toString().trim() === `/test/${testFile}`;
  } catch (err) {
    log.debug(`Finding bindPath failed with ${err}`);
    return false;
  }
}

/**
 * Get bind path depending on os platform
 * @param {object} serverless
 * @param {string} serviceDir
 * @return {string} The bind path.
 */
async function getBindPath(serviceDir, pluginInstance) {
  // Determine bind path
  let isWsl1 = isWsl && !release().includes('microsoft-standard');
  if (process.platform !== 'win32' && !isWsl1) {
    return serviceDir;
  }

  // test docker is available
  await dockerCommand(['version'], pluginInstance);

  // find good bind path for Windows
  let bindPaths = [];
  let baseBindPath = serviceDir.replace(/\\([^\s])/g, '/$1');
  let drive;
  let path;

  bindPaths.push(baseBindPath);
  if (baseBindPath.startsWith('/mnt/')) {
    // cygwin "/mnt/C/users/..."
    baseBindPath = baseBindPath.replace(/^\/mnt\//, '/');
  }
  if (baseBindPath[1] == ':') {
    // normal windows "c:/users/..."
    drive = baseBindPath[0];
    path = baseBindPath.substring(3);
  } else if (baseBindPath[0] == '/' && baseBindPath[2] == '/') {
    // gitbash "/c/users/..."
    drive = baseBindPath[1];
    path = baseBindPath.substring(3);
  } else {
    throw new Error(`Unknown path format ${baseBindPath.substr(10)}...`);
  }

  bindPaths.push(`/${drive.toLowerCase()}/${path}`); // Docker Toolbox (seems like Docker for Windows can support this too)
  bindPaths.push(`${drive.toLowerCase()}:/${path}`); // Docker for Windows
  // other options just in case
  bindPaths.push(`/${drive.toUpperCase()}/${path}`);
  bindPaths.push(`/mnt/${drive.toLowerCase()}/${path}`);
  bindPaths.push(`/mnt/${drive.toUpperCase()}/${path}`);
  bindPaths.push(`${drive.toUpperCase()}:/${path}`);

  const testFile = await findTestFile(serviceDir, pluginInstance);

  for (let i = 0; i < bindPaths.length; i++) {
    const bindPath = bindPaths[i];
    if (await tryBindPath(bindPath, testFile, pluginInstance)) {
      return bindPath;
    }
  }

  throw new Error('Unable to find good bind path format');
}

/**
 * Find out what uid the docker machine is using
 * @param {string} bindPath
 * @return {boolean}
 */
async function getDockerUid(bindPath, pluginInstance) {
  const options = [
    'run',
    '--rm',
    `-v=${bindPath}:/test`,
    'alpine',
    'stat',
    '-c',
    '%u',
    '/bin/sh',
  ];
  const ps = await dockerCommand(options, pluginInstance);
  return ps.stdout.toString().trim();
}

export { buildImage, getBindPath, getDockerUid };
