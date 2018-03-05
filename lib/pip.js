const fse = require('fs-extra');
const path = require('path');
const get = require('lodash.get');
const set = require('lodash.set');
const {spawnSync} = require('child_process');
const {quote} = require('shell-quote');
const values = require('lodash.values');
const {buildImage, getBindPath} = require('./docker');

/**
 * Install requirements described in requirementsPath to targetPath
 * @param {string} requirementsPath
 * @param {string} targetFolder
 * @param {Object} serverless
 * @param {string} servicePath
 * @param {Object} options
 * @return {undefined}
 */
function installRequirements(requirementsPath, targetFolder, serverless, servicePath, options) {
  // Create target folder if it does not exist
  const targetRequirementsFolder = path.join(targetFolder, 'requirements');
  fse.ensureDirSync(targetRequirementsFolder);

  const dotSlsReqs = path.join(targetFolder, 'requirements.txt');
  if (options.usePipenv && fse.existsSync(path.join(servicePath, 'Pipfile'))) {
    generateRequirementsFile(dotSlsReqs, dotSlsReqs, options);
  } else {
    generateRequirementsFile(requirementsPath, dotSlsReqs, options);
  }

  serverless.cli.log(`Installing requirements of ${requirementsPath} in ${targetFolder}...`);

  let cmd;
  let cmdOptions;
  let pipCmd = [
    options.pythonBin, '-m', 'pip', '--isolated', 'install',
    '-t', dockerPathForWin(options, targetRequirementsFolder),
    '-r', dockerPathForWin(options, dotSlsReqs),
    ...options.pipCmdExtraArgs,
  ];
  if (!options.dockerizePip) {
    // Check if pip has Debian's --system option and set it if so
    const pipTestRes = spawnSync(
      options.pythonBin, ['-m', 'pip', 'help', 'install']);
    if (pipTestRes.error) {
      if (pipTestRes.error.code === 'ENOENT') {
        throw new Error(
          `${options.pythonBin} not found! ` +
          'Try the pythonBin option.');
      }
      throw pipTestRes.error;
    }
    if (pipTestRes.stdout.toString().indexOf('--system') >= 0) {
      pipCmd.push('--system');
    }
  }
  if (options.dockerizePip) {
    cmd = 'docker';

    // Build docker image if required
    let dockerImage;
    if (options.dockerFile) {
      serverless.cli.log(`Building custom docker image from ${options.dockerFile}...`);
      dockerImage = buildImage(options.dockerFile);
    } else {
      dockerImage = options.dockerImage;
    }
    serverless.cli.log(`Docker Image: ${dockerImage}`);

    // Prepare bind path depending on os platform
    const bindPath = getBindPath(servicePath);

    cmdOptions = [
      'run', '--rm',
      '-v', `${bindPath}:/var/task:z`,
    ];
    if (options.dockerSsh) {
      // Mount necessary ssh files to work with private repos
      cmdOptions.push('-v', `${process.env.HOME}/.ssh/id_rsa:/root/.ssh/id_rsa:z`);
      cmdOptions.push('-v', `${process.env.HOME}/.ssh/known_hosts:/root/.ssh/known_hosts:z`);
      cmdOptions.push('-v', `${process.env.SSH_AUTH_SOCK}:/tmp/ssh_sock:z`);
      cmdOptions.push('-e', 'SSH_AUTH_SOCK=/tmp/ssh_sock');
    }
    if (process.platform === 'linux') {
      // Set the ownership of the .serverless/requirements folder to current user
      pipCmd = quote(pipCmd);
      const chownCmd = quote([
        'chown', '-R', `${process.getuid()}:${process.getgid()}`,
        targetRequirementsFolder,
      ]);
      pipCmd = ['/bin/bash', '-c', '"' + pipCmd + ' && ' + chownCmd + '"'];
      // const stripCmd = quote([
      //   'find', targetRequirementsFolder,
      //   '-name', '"*.so"',
      //   '-exec', 'strip', '{}', '\;',
      // ]);
      // pipCmd = ['/bin/bash', '-c', '"' + pipCmd + ' && ' + stripCmd + ' && ' + chownCmd + '"'];
    }
    cmdOptions.push(dockerImage);
    cmdOptions.push(...pipCmd);
  } else {
    cmd = pipCmd[0];
    cmdOptions = pipCmd.slice(1);
  }
  const res = spawnSync(cmd, cmdOptions, {cwd: servicePath, shell: true});
  if (res.error) {
    if (res.error.code === 'ENOENT') {
      if (options.dockerizePip) {
        throw new Error('docker not found! Please install it.');
      }
      throw new Error(`${options.pythonBin} not found! Try the pythonBin option.`);
    }
    throw res.error;
  }
  if (res.status !== 0) {
    throw new Error(res.stderr);
  }
};

/**
 * convert path from Windows style to Linux style, if needed
 * @param {Object} options
 * @param {string} path
 * @return {string}
 */
function dockerPathForWin(options, path) {
  if (process.platform === 'win32' && options.dockerizePip) {
    return path.replace('\\', '/');
  }
  return path;
}

/** create a filtered requirements.txt without anything from noDeploy
 * @param {string} source requirements
 * @param {string} target requirements where results are written
 * @param {Object} options
 */
function generateRequirementsFile(source, target, options) {
  const noDeploy = new Set(options.noDeploy || []);
  const requirements = fse.readFileSync(source, {encoding: 'utf-8'}).split(/\r?\n/);
  const filteredRequirements = requirements.filter((req) => {
    return !noDeploy.has(req.split(/[=<> \t]/)[0].trim());
  });
  fse.writeFileSync(target, filteredRequirements.join('\n'));
}

/**
 * pip install the requirements to the .serverless/requirements directory
 * @return {undefined}
 */
function installAllRequirements() {
  fse.ensureDirSync(path.join(this.servicePath, '.serverless'));
  if (this.serverless.service.package.individually) {
    let doneModules = [];
    values(this.serverless.service.functions)
      .forEach((f) => {
        if (!get(f, 'module')) {
          set(f, ['module'], '.');
        }
        if (!doneModules.includes(f.module)) {
          installRequirements(
            path.join(f.module, this.options.fileName),
            path.join('.serverless', f.module),
            this.serverless,
            this.servicePath,
            this.options
          );
          doneModules.push(f.module);
        }
      });
  } else {
    installRequirements(
      this.options.fileName,
      '.serverless',
      this.serverless,
      this.servicePath,
      this.options
    );
  }
};

module.exports = {installAllRequirements};
