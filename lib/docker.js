const { spawnSync } = require('child_process');
const isWsl = require('is-wsl');

/**
 * Helper function to run a docker command
 * @param {string[]} options
 * @return {Object}
 */
function dockerCommand(options) {
  const cmd = 'docker';
  const ps = spawnSync(cmd, options, { encoding: 'utf-8' });
  if (ps.error) {
    if (ps.error.code === 'ENOENT') {
      throw new Error('docker not found! Please install it.');
    }
    throw new Error(ps.error);
  } else if (ps.status !== 0) {
    throw new Error(ps.stderr);
  }
  return ps;
}

/**
 * Build the custom Docker image
 * @param {string} dockerFile
 * @return {string} The name of the built docker image.
 */
function buildImage(dockerFile) {
  const imageName = 'sls-py-reqs-custom';
  const options = ['build', '-f', dockerFile, '-t', imageName, '.'];
  dockerCommand(options);
  return imageName;
}

/**
 * Test bind path to make sure it's working
 * @param {string} bindPath
 * @return {boolean}
 */
function tryBindPath(bindPath) {
  const options = [
    'run',
    '--rm',
    '-v',
    `${bindPath}:/test`,
    'alpine',
    'ls',
    '/test/serverless.yml'
  ];
  try {
    const ps = dockerCommand(options);
    return ps.stdout.trim() === '/test/serverless.yml';
  } catch (err) {
    return false;
  }
}

/**
 * Get bind path depending on os platform
 * @param {string} servicePath
 * @return {string} The bind path.
 */
function getBindPath(servicePath) {
  // Determine bind path
  if (process.platform !== 'win32' && !isWsl) {
    return servicePath;
  }

  // test docker is available
  dockerCommand(['version']);

  // find good bind path for Windows
  let bindPaths = [];
  let baseBindPath = servicePath.replace(/\\([^\s])/g, '/$1');
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

  bindPaths.push(`/${drive.toLowerCase()}/${path}`);
  bindPaths.push(`/${drive.toUpperCase()}/${path}`);
  bindPaths.push(`/mnt/${drive.toLowerCase()}/${path}`);
  bindPaths.push(`/mnt/${drive.toUpperCase()}/${path}`);
  bindPaths.push(`${drive.toLowerCase()}:/${path}`);
  bindPaths.push(`${drive.toUpperCase()}:/${path}`);

  for (let i = 0; i < bindPaths.length; i++) {
    const bindPath = bindPaths[i];
    if (tryBindPath(bindPath)) {
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
function getDockerUid(bindPath) {
  const options = [
    'run',
    '--rm',
    '-v',
    `${bindPath}:/test`,
    'alpine',
    'stat',
    '-c',
    '%u',
    '/test/.serverless'
  ];
  const ps = dockerCommand(options);
  return ps.stdout.trim();
}

module.exports = { buildImage, getBindPath, getDockerUid };
