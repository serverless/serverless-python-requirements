const {spawnSync} = require('child_process');
const isWsl = require('is-wsl');

/**
 * Helper function to run a docker command
 * @param {string[]} options
 * @return {Object}
 */
function dockerCommand(options) {
  const cmd = 'docker';
  const ps = spawnSync(cmd, options, {'encoding': 'utf-8'});
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
  const options = [
    'build', '-f', dockerFile, '-t', imageName, '.',
  ];
  dockerCommand(options);
  return imageName;
};

/**
 * Get bind path depending on os platform
 * @param {string} servicePath
 * @return {string} The bind path.
 */
function getBindPath(servicePath) {
  // Determine os platform of docker CLI from 'docker version'
  const options = ['version', '--format', '{{with .Client}}{{.Os}}{{end}}'];
  const ps = dockerCommand(options);
  const cliPlatform = ps.stdout.trim();

  // Determine bind path
  let bindPath;
  if (process.platform === 'win32') {
    bindPath = servicePath.replace(/\\([^\s])/g, '/$1');
    if (cliPlatform === 'windows') {
      bindPath = bindPath.replace(/^\/(\w)\//i, '$1:/');
    }
  } else if (isWsl) {
    bindPath = servicePath.replace(/^\/mnt\//, '/');
    if (cliPlatform === 'windows') {
      bindPath = bindPath.replace(/^\/(\w)\//i, '$1:/');
    }
  } else {
    bindPath = servicePath;
  }

  return bindPath;
};

module.exports = {buildImage, getBindPath};
