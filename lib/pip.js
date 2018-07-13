const fse = require('fs-extra');
const rimraf = require('rimraf');
const path = require('path');
const get = require('lodash.get');
const set = require('lodash.set');
const { spawnSync } = require('child_process');
const { buildImage, getBindPath, getDockerUid } = require('./docker');
const { getSlimPackageCommands } = require('./slim');

/**
 * Install requirements described in requirementsPath to targetFolder
 * @param {string} requirementsPath
 * @param {string} targetFolder
 * @return {undefined}
 */
function installRequirements(requirementsPath, targetFolder) {
  // Create target folder if it does not exist
  const targetRequirementsFolder = path.join(targetFolder, 'requirements');
  fse.ensureDirSync(targetRequirementsFolder);

  const dotSlsReqs = path.join(targetFolder, 'requirements.txt');
  if (
    this.options.usePipenv &&
    fse.existsSync(path.join(this.servicePath, 'Pipfile'))
  ) {
    generateRequirementsFile(dotSlsReqs, dotSlsReqs);
  } else {
    generateRequirementsFile(requirementsPath, dotSlsReqs);
  }

  this.serverless.cli.log(
    `Installing requirements of ${requirementsPath} in ${targetFolder}...`
  );

  let cmd;
  let cmdOptions;
  let pipCmd = [
    this.options.pythonBin,
    '-m',
    'pip',
    'install',
    '-t',
    dockerPathForWin(targetRequirementsFolder),
    '-r',
    dockerPathForWin(dotSlsReqs),
    ...this.options.pipCmdExtraArgs
  ];
  if (!this.options.dockerizePip) {
    // Check if pip has Debian's --system option and set it if so
    const pipTestRes = spawnSync(this.options.pythonBin, [
      '-m',
      'pip',
      'help',
      'install'
    ]);
    if (pipTestRes.error) {
      if (pipTestRes.error.code === 'ENOENT') {
        throw new Error(
          `${this.options.pythonBin} not found! ` + 'Try the pythonBin option.'
        );
      }
      throw pipTestRes.error;
    }
    if (pipTestRes.stdout.toString().indexOf('--system') >= 0) {
      pipCmd.push('--system');
    }
  }
  if (this.options.dockerizePip) {
    cmd = 'docker';

    // Build docker image if required
    let dockerImage;
    if (this.options.dockerFile) {
      this.serverless.cli.log(
        `Building custom docker image from ${this.options.dockerFile}...`
      );
      dockerImage = buildImage(this.options.dockerFile);
    } else {
      dockerImage = this.options.dockerImage;
    }
    this.serverless.cli.log(`Docker Image: ${dockerImage}`);

    // Prepare bind path depending on os platform
    const bindPath = getBindPath(this.servicePath);

    cmdOptions = ['run', '--rm', '-v', `"${bindPath}:/var/task:z"`];
    if (this.options.dockerSsh) {
      // Mount necessary ssh files to work with private repos
      cmdOptions.push(
        '-v',
        `${process.env.HOME}/.ssh/id_rsa:/root/.ssh/id_rsa:z`
      );
      cmdOptions.push(
        '-v',
        `${process.env.HOME}/.ssh/known_hosts:/root/.ssh/known_hosts:z`
      );
      cmdOptions.push('-v', `${process.env.SSH_AUTH_SOCK}:/tmp/ssh_sock:z`);
      cmdOptions.push('-e', 'SSH_AUTH_SOCK=/tmp/ssh_sock');
    }
    if (process.platform === 'linux') {
      // Use same user so requirements folder is not root and so --cache-dir works
      cmdOptions.push('-u', `${process.getuid()}`);
      // const stripCmd = quote([
      //   'find', targetRequirementsFolder,
      //   '-name', '"*.so"',
      //   '-exec', 'strip', '{}', '\;',
      // ]);
      // pipCmd = ['/bin/bash', '-c', '"' + pipCmd + ' && ' + stripCmd + ' && ' + chownCmd + '"'];
    } else {
      // Use same user so --cache-dir works
      cmdOptions.push('-u', getDockerUid(bindPath));
    }
    cmdOptions.push(dockerImage);
    cmdOptions.push(...pipCmd);
  } else {
    cmd = pipCmd[0];
    cmdOptions = pipCmd.slice(1);
  }

  // If enabled slimming, strip out the caches, tests and dist-infos
  if (this.options.slim === true || this.options.slim === 'true') {
    const preparedPath = dockerPathForWin(targetRequirementsFolder);
    const slimCmd = getSlimPackageCommands(preparedPath);
    cmdOptions.push(...slimCmd);
  }

  const res = spawnSync(cmd, cmdOptions, {
    cwd: this.servicePath,
    shell: true
  });
  if (res.error) {
    if (res.error.code === 'ENOENT') {
      if (this.options.dockerizePip) {
        throw new Error('docker not found! Please install it.');
      }
      throw new Error(
        `${this.options.pythonBin} not found! Try the pythonBin option.`
      );
    }
    throw res.error;
  }
  if (res.status !== 0) {
    throw new Error(res.stderr);
  }
}

/**
 * convert path from Windows style to Linux style, if needed
 * @param {string} path
 * @return {string}
 */
function dockerPathForWin(path) {
  if (process.platform === 'win32' && this.options.dockerizePip) {
    return path.replace(/\\/g, '/');
  }
  return path;
}

/** create a filtered requirements.txt without anything from noDeploy
 * @param {string} source requirements
 * @param {string} target requirements where results are written
 */
function generateRequirementsFile(source, target) {
  const noDeploy = new Set(this.options.noDeploy || []);
  const requirements = fse
    .readFileSync(source, { encoding: 'utf-8' })
    .split(/\r?\n/);
  const filteredRequirements = requirements.filter(req => {
    return !noDeploy.has(req.split(/[=<> \t]/)[0].trim());
  });
  fse.writeFileSync(target, filteredRequirements.join('\n'));
}

/**
 * Copy everything from vendorFolder to targetFolder
 * @param {string} vendorFolder
 * @param {string} targetFolder
 * @return {undefined}
 */
function copyVendors(vendorFolder, targetFolder) {
  // Create target folder if it does not exist
  const targetRequirementsFolder = path.join(targetFolder, 'requirements');

  this.serverless.cli.log(
    `Copying vendor libraries from ${vendorFolder} to ${targetRequirementsFolder}...`
  );

  fse.readdirSync(vendorFolder).map(file => {
    let source = path.join(vendorFolder, file);
    let dest = path.join(targetRequirementsFolder, file);
    if (fse.existsSync(dest)) {
      rimraf.sync(dest);
    }
    fse.copySync(source, dest);
  });
}

/**
 * pip install the requirements to the .serverless/requirements directory
 * @return {undefined}
 */
function installAllRequirements() {
  fse.ensureDirSync(path.join(this.servicePath, '.serverless'));
  if (this.serverless.service.package.individually) {
    let doneModules = [];
    this.targetFuncs
      .filter(func =>
        (func.runtime || this.serverless.service.provider.runtime).match(
          /^python.*/
        )
      )
      .map(f => {
        if (!get(f, 'module')) {
          set(f, ['module'], '.');
        }
        if (!doneModules.includes(f.module)) {
          installRequirements(
            path.join(f.module, this.options.fileName),
            path.join('.serverless', f.module)
          );
          if (f.vendor) {
            // copy vendor libraries to requirements folder
            copyVendors(f.vendor, path.join('.serverless', f.module));
          }
          doneModules.push(f.module);
        }
      }, this);
  } else {
    installRequirements(this.options.fileName, '.serverless');
    if (this.options.vendor) {
      // copy vendor libraries to requirements folder
      copyVendors(this.options.vendor, '.serverless');
    }
  }
}

module.exports = { installAllRequirements };
