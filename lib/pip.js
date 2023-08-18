import {
  mkdir,
  cp,
  open,
  symlink,
  writeFile,
  readFile,
  readdir,
  rename,
  stat,
  utimes,
  rm,
} from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { quote } from 'shell-quote';
import { buildImage, getBindPath, getDockerUid } from './docker.js';
import { getStripCommand, getStripMode, deleteFiles } from './slim.js';
import { isPoetryProject, pyprojectTomlToRequirements } from './poetry.js';
import {
  checkForAndDeleteMaxCacheVersions,
  sha256Path,
  getRequirementsWorkingPath,
  getUserCachePath,
  exists,
} from './shared.js';
import child from 'child_process';
import { promisify } from 'util';
const execFile = promisify(child.execFile);

/**
 * Omit empty commands.
 * In this context, a "command" is a list of arguments. An empty list or falsy value is ommitted.
 * @param {string[][]} many commands to merge.
 * @return {string[][]} a list of valid commands.
 */
function filterCommands(commands) {
  return commands.filter((cmd) => Boolean(cmd) && cmd.length > 0);
}

/**
 * Render zero or more commands as a single command for a Unix environment.
 * In this context, a "command" is a list of arguments. An empty list or falsy value is ommitted.
 *
 * @param {string[][]} many commands to merge.
 * @return {string[]} a single list of words.
 */
function mergeCommands(commands) {
  const cmds = filterCommands(commands);
  if (cmds.length === 0) {
    throw new Error('Expected at least one non-empty command');
  } else if (cmds.length === 1) {
    return cmds[0];
  } else {
    // Quote the arguments in each command and join them all using &&.
    return ['/bin/sh', '-c', cmds.map(quote).join(' && ')];
  }
}

/**
 * Just generate the requirements file in the .serverless folder
 * @param {string} requirementsPath
 * @param {string} targetFile
 * @param {Object} serverless
 * @param {string} serviceDir
 * @param {Object} options
 * @return {undefined}
 */
async function generateRequirementsFile(
  requirementsPath,
  targetFile,
  pluginInstance
) {
  const { serviceDir, options, log } = pluginInstance;
  const modulePath = dirname(requirementsPath);
  if (options.usePoetry && (await isPoetryProject(modulePath))) {
    await filterRequirementsFile(targetFile, targetFile, pluginInstance);
    log.info(`Parsed requirements.txt from pyproject.toml in ${targetFile}`);
  } else if (options.usePipenv && (await exists(join(serviceDir, 'Pipfile')))) {
    await filterRequirementsFile(
      join(serviceDir, '.serverless/requirements.txt'),
      targetFile,
      pluginInstance
    );
    log.info(`Parsed requirements.txt from Pipfile in ${targetFile}`);
  } else {
    await filterRequirementsFile(requirementsPath, targetFile, pluginInstance);
    log.info(
      `Generated requirements from ${requirementsPath} in ${targetFile}`
    );
  }
}

async function pipAcceptsSystem(pythonBin, pluginInstance) {
  // Check if pip has Debian's --system option and set it if so
  try {
    const pipTestRes = await execFile(pythonBin, [
      '-m',
      'pip',
      'help',
      'install',
    ]);
    return (
      pipTestRes.stdout && pipTestRes.stdout.toString().indexOf('--system') >= 0
    );
  } catch (e) {
    if (e.message.includes('command not found')) {
      throw new pluginInstance.serverless.classes.Error(
        `${pythonBin} not found! Install it according to the poetry docs.`,
        'PYTHON_REQUIREMENTS_PYTHON_NOT_FOUND'
      );
    }
    throw e;
  }
}

/**
 * Install requirements described from requirements in the targetFolder into that same targetFolder
 * @param {string} targetFolder
 * @param {Object} serverless
 * @param {Object} options
 * @return {undefined}
 */
async function installRequirements(targetFolder, pluginInstance) {
  const { options, log, progress } = pluginInstance;
  const targetRequirementsTxt = join(targetFolder, 'requirements.txt');

  log.info(`Installing requirements from "${targetRequirementsTxt}"`);
  let installProgress = progress.get('python-install');
  installProgress.update('Installing requirements');

  try {
    const dockerCmd = [];
    const pipCmd = [options.pythonBin, '-m', 'pip', 'install'];

    if (
      Array.isArray(options.pipCmdExtraArgs) &&
      options.pipCmdExtraArgs.length > 0
    ) {
      options.pipCmdExtraArgs.forEach((cmd) => {
        const parts = cmd.split(/\s+/, 2);
        pipCmd.push(...parts);
      });
    }

    const pipCmds = [pipCmd];
    const postCmds = [];
    // Check if we're using the legacy --cache-dir command...
    if (options.pipCmdExtraArgs.indexOf('--cache-dir') > -1) {
      if (options.dockerizePip) {
        throw new pluginInstance.serverless.classes.Error(
          'You cannot use --cache-dir with Docker any more, please use the new option useDownloadCache instead. Please see: https://github.com/UnitedIncome/serverless-python-requirements#caching for more details.',
          'PYTHON_REQUIREMENTS_CACHE_DIR_DOCKER_INVALID'
        );
      } else {
        log.warning(
          'You are using a deprecated --cache-dir inside\n' +
            '            your pipCmdExtraArgs which may not work properly, please use the\n' +
            '            useDownloadCache option instead.  Please see: \n' +
            '            https://github.com/UnitedIncome/serverless-python-requirements#caching'
        );
      }
    }

    if (!options.dockerizePip) {
      // Push our local OS-specific paths for requirements and target directory
      pipCmd.push(
        '-t',
        dockerPathForWin(targetFolder),
        '-r',
        dockerPathForWin(targetRequirementsTxt)
      );
      // If we want a download cache...
      if (options.useDownloadCache) {
        const downloadCacheDir = join(
          getUserCachePath(options),
          'downloadCacheslspyc'
        );
        log.info(`Using download cache directory ${downloadCacheDir}`);
        await mkdir(downloadCacheDir, { recursive: true });
        pipCmd.push('--cache-dir', downloadCacheDir);
      }

      if (await pipAcceptsSystem(options.pythonBin, pluginInstance)) {
        pipCmd.push('--system');
      }
    }

    // If we are dockerizing pip
    if (options.dockerizePip) {
      // Push docker-specific paths for requirements and target directory
      pipCmd.push('-t', '/var/task/', '-r', '/var/task/requirements.txt');

      // Build docker image if required
      let dockerImage;
      if (options.dockerFile) {
        let buildDockerImageProgress = progress.get(
          'python-install-build-docker'
        );
        buildDockerImageProgress.update(
          `Building custom docker image from ${options.dockerFile}`
        );
        try {
          dockerImage = await buildImage(
            options.dockerFile,
            options.dockerBuildCmdExtraArgs,
            pluginInstance
          );
        } finally {
          buildDockerImageProgress && buildDockerImageProgress.remove();
        }
      } else {
        dockerImage = options.dockerImage;
      }
      log.info(`Docker Image: ${dockerImage}`);

      // Prepare bind path depending on os platform
      const bindPath = dockerPathForWin(
        await getBindPath(targetFolder, pluginInstance)
      );

      dockerCmd.push('docker', 'run', '--rm', `-v=${bindPath}:/var/task:z`);
      if (options.dockerSsh) {
        const homePath = homedir();
        const sshKeyPath =
          options.dockerPrivateKey || `${homePath}/.ssh/id_rsa`;

        // Mount necessary ssh files to work with private repos
        dockerCmd.push(
          `-v=${sshKeyPath}:/root/.ssh/${
            sshKeyPath.split('/').splice(-1)[0]
          }:z`,
          `-v=${homePath}/.ssh/known_hosts:/root/.ssh/known_hosts:z`,
          `-v=${process.env.SSH_AUTH_SOCK}:/tmp/ssh_sock:z`,
          `-e=SSH_AUTH_SOCK=/tmp/ssh_sock`
        );
      }

      // If we want a download cache...
      const dockerDownloadCacheDir = '/var/useDownloadCache';
      if (options.useDownloadCache) {
        const downloadCacheDir = join(
          getUserCachePath(options),
          'downloadCacheslspyc'
        );
        log.info(`Using download cache directory ${downloadCacheDir}`);
        await mkdir(downloadCacheDir, { recursive: true });
        // This little hack is necessary because getBindPath requires something inside of it to test...
        // Ugh, this is so ugly, but someone has to fix getBindPath in some other way (eg: make it use
        // its own temp file)
        await (
          await open(join(downloadCacheDir, 'requirements.txt'), 'w')
        ).close();
        const windowsized = await getBindPath(downloadCacheDir, pluginInstance);
        // And now push it to a volume mount and to pip...
        dockerCmd.push(`-v=${windowsized}:${dockerDownloadCacheDir}:z`);
        pipCmd.push(`--cache-dir=${dockerDownloadCacheDir}`);
      }

      if (options.dockerEnv) {
        // Add environment variables to docker run cmd
        options.dockerEnv.forEach(function (item) {
          dockerCmd.push('-e', item);
        });
      }

      if (process.platform === 'linux') {
        // Use same user so requirements folder is not root and so --cache-dir works
        dockerCmd.push(`-u=${process.getuid()}:${process.getgid()}`);
      } else {
        // Use same user so --cache-dir works
        dockerCmd.push(`-u=${await getDockerUid(bindPath, pluginInstance)}`);
      }

      for (let path of options.dockerExtraFiles) {
        pipCmds.push(['cp', path, '/var/task/']);
      }

      if (Array.isArray(options.dockerRunCmdExtraArgs)) {
        dockerCmd.push(...options.dockerRunCmdExtraArgs);
      } else {
        throw new pluginInstance.serverless.classes.Error(
          'dockerRunCmdExtraArgs option must be an array',
          'PYTHON_REQUIREMENTS_INVALID_DOCKER_EXTRA_ARGS'
        );
      }

      dockerCmd.push(dockerImage);
    }

    // If enabled slimming, strip so files
    switch (getStripMode(options)) {
      case 'docker':
        pipCmds.push(getStripCommand(options, '/var/task'));
        break;
      case 'direct':
        postCmds.push(getStripCommand(options, dockerPathForWin(targetFolder)));
        break;
    }

    let mainCmds = [];
    if (dockerCmd.length) {
      dockerCmd.push(...mergeCommands(pipCmds));
      mainCmds = [dockerCmd];
    } else {
      mainCmds = pipCmds;
    }
    mainCmds.push(...postCmds);

    log.info(`Running ${quote(dockerCmd)}...`);

    for (const [cmd, ...args] of mainCmds) {
      try {
        await execFile(cmd, args);
      } catch (e) {
        if (e.message.includes('command not found')) {
          const advice =
            cmd.indexOf('python') > -1
              ? 'Try the pythonBin option'
              : 'Please install it';
          throw new pluginInstance.serverless.classes.Error(
            `${cmd} not found! ${advice}`,
            'PYTHON_REQUIREMENTS_COMMAND_NOT_FOUND'
          );
        }

        if (cmd === 'docker') {
          throw new pluginInstance.serverless.classes.Error(
            `Running "${cmd} ${args.join(' ')}" failed with: "${e.message}"`,
            'PYTHON_REQUIREMENTS_DOCKER_COMMAND_FAILED'
          );
        }

        throw e;
      }
    }
    // If enabled slimming, delete files in slimPatterns
    if (options.slim === true || options.slim === 'true') {
      await deleteFiles(options, targetFolder);
    }
  } finally {
    installProgress.remove();
  }
}

/**
 * Convert path from Windows style to Linux style, if needed.
 * @param {string} path
 * @return {string}
 */
function dockerPathForWin(path) {
  if (process.platform === 'win32') {
    return path.replace(/\\/g, '/');
  } else {
    return path;
  }
}

/**
 * get requirements from requirements.txt
 * @param {string} source
 * @return {string[]}
 */
async function getRequirements(source) {
  const requirements = (await readFile(source, { encoding: 'utf-8' }))
    .replace(/\\\n/g, ' ')
    .split(/\r?\n/);

  return await requirements.reduce(async (accPromise, req) => {
    req = req.trim();
    const acc = await accPromise;
    if (!req.startsWith('-r')) {
      return [...acc, req];
    }
    source = join(dirname(source), req.replace(/^-r\s+/, ''));
    return [...acc, ...(await getRequirements(source))];
  }, Promise.resolve([]));
}

/** create a filtered requirements.txt without anything from noDeploy
 *  then remove all comments and empty lines, and sort the list which
 *  assist with matching the static cache.  The sorting will skip any
 *  lines starting with -- as those are typically ordered at the
 *  start of a file ( eg: --index-url / --extra-index-url ) or any
 *  lines that start with -c, -e, -f, -i or -r,  Please see:
 * https://pip.pypa.io/en/stable/reference/pip_install/#requirements-file-format
 * @param {string} source requirements
 * @param {string} target requirements where results are written
 * @param {Object} options
 */
async function filterRequirementsFile(source, target, { options, log }) {
  const noDeploy = new Set(options.noDeploy || []);
  const requirements = await getRequirements(source);
  var prepend = [];
  const filteredRequirements = requirements.filter((req) => {
    req = req.trim();
    if (req.startsWith('#')) {
      // Skip comments
      return false;
    } else if (
      req.startsWith('--') ||
      req.startsWith('-c') ||
      req.startsWith('-e') ||
      req.startsWith('-f') ||
      req.startsWith('-i') ||
      req.startsWith('-r')
    ) {
      if (req.startsWith('-e')) {
        // strip out editable flags
        // not required inside final archive and avoids pip bugs
        // see https://github.com/UnitedIncome/serverless-python-requirements/issues/240
        req = req.split('-e')[1].trim();
        log.warning(`Stripping -e flag from requirement ${req}`);
      }

      // Keep options for later
      prepend.push(req);
      return false;
    } else if (req === '') {
      return false;
    }
    return !noDeploy.has(req.split(/[=<> \t]/)[0].trim());
  });
  filteredRequirements.sort(); // Sort remaining alphabetically
  // Then prepend any options from above in the same order
  for (let item of prepend.reverse()) {
    if (item && item.length > 0) {
      filteredRequirements.unshift(item);
    }
  }
  await writeFile(target, filteredRequirements.join('\n') + '\n');
}

/**
 * Copy everything from vendorFolder to targetFolder
 * @param {string} vendorFolder
 * @param {string} targetFolder
 * @param {Object} serverless
 * @return {undefined}
 */
async function copyVendors(vendorFolder, targetFolder, { log }) {
  // Create target folder if it does not exist
  await mkdir(targetFolder, { recursive: true });

  log.info(`Copying vendor libraries from ${vendorFolder} to ${targetFolder}`);

  (await readdir(vendorFolder)).map(async (file) => {
    let source = join(vendorFolder, file);
    let dest = join(targetFolder, file);
    await rm(dest, { recursive: true, force: true });
    await cp(source, dest, { recursive: true });
  });
}

/**
 * This checks if requirements file exists.
 * @param {string} serviceDir
 * @param {Object} options
 * @param {string} fileName
 */
async function requirementsFileExists(serviceDir, options, fileName) {
  if (options.usePoetry && (await isPoetryProject(dirname(fileName)))) {
    return true;
  }

  if (options.usePipenv && (await exists(join(serviceDir, 'Pipfile')))) {
    return true;
  }

  return await exists(fileName);
}

/**
 * This evaluates if requirements are actually needed to be installed, but fails
 * gracefully if no req file is found intentionally.  It also assists with code
 * re-use for this logic pertaining to individually packaged functions
 * @param {string} serviceDir
 * @param {string} modulePath
 * @param {Object} options
 * @param {Object} funcOptions
 * @param {Object} serverless
 * @return {string}
 */
async function installRequirementsIfNeeded(
  modulePath,
  funcOptions,
  pluginInstance
) {
  const { serviceDir, options, serverless } = pluginInstance;
  // Our source requirements, under our service path, and our module path (if specified)
  const fileName = join(serviceDir, modulePath, options.fileName);

  await pyprojectTomlToRequirements(modulePath, pluginInstance);

  // Skip requirements generation, if requirements file doesn't exist
  if (!(await requirementsFileExists(serviceDir, options, fileName))) {
    return false;
  }

  let requirementsTxtDirectory;
  // Copy our requirements to another path in .serverless (incase of individually packaged)
  if (modulePath && modulePath !== '.') {
    requirementsTxtDirectory = join(serviceDir, '.serverless', modulePath);
  } else {
    requirementsTxtDirectory = join(serviceDir, '.serverless');
  }
  await mkdir(requirementsTxtDirectory, { recursive: true });
  const slsReqsTxt = join(requirementsTxtDirectory, 'requirements.txt');

  await generateRequirementsFile(fileName, slsReqsTxt, pluginInstance);

  // If no requirements file or an empty requirements file, then do nothing
  if (!(await exists(slsReqsTxt)) || (await stat(slsReqsTxt)).size == 0) {
    pluginInstance.log.info(
      `Skipping empty output requirements.txt file from ${slsReqsTxt}`
    );
    return false;
  }

  // Then generate our MD5 Sum of this requirements file to determine where it should "go" to and/or pull cache from
  const reqChecksum = await sha256Path(slsReqsTxt);

  // Then figure out where this cache should be, if we're caching, if we're in a module, etc
  const workingReqsFolder = getRequirementsWorkingPath(
    reqChecksum,
    requirementsTxtDirectory,
    options,
    serverless
  );

  // Check if our static cache is present and is valid
  if (await exists(workingReqsFolder)) {
    if (
      (await exists(join(workingReqsFolder, '.completed_requirements'))) &&
      workingReqsFolder.endsWith('_slspyc')
    ) {
      pluginInstance.log.info(
        `Using static cache of requirements found at ${workingReqsFolder}`
      );
      // We'll "touch" the folder, as to bring it to the start of the FIFO cache
      await utimes(workingReqsFolder, new Date(), new Date());
      return workingReqsFolder;
    }
    // Remove our old folder if it didn't complete properly, but _just incase_ only remove it if named properly...
    if (
      workingReqsFolder.endsWith('_slspyc') ||
      workingReqsFolder.endsWith('.requirements')
    ) {
      await rm(workingReqsFolder, { recursive: true, force: true });
    }
  }

  // Ensuring the working reqs folder exists
  await mkdir(workingReqsFolder, { recursive: true });

  // Copy our requirements.txt into our working folder...
  await cp(slsReqsTxt, join(workingReqsFolder, 'requirements.txt'));

  // Then install our requirements from this folder
  await installRequirements(workingReqsFolder, pluginInstance);

  // Copy vendor libraries to requirements folder
  if (options.vendor) {
    await copyVendors(options.vendor, workingReqsFolder, pluginInstance);
  }
  if (funcOptions.vendor) {
    await copyVendors(funcOptions.vendor, workingReqsFolder, pluginInstance);
  }

  // Then touch our ".completed_requirements" file so we know we can use this for static cache
  if (options.useStaticCache) {
    await (
      await open(join(workingReqsFolder, '.completed_requirements'), 'w')
    ).close();
  }
  return workingReqsFolder;
}

/**
 * pip install the requirements to the requirements directory
 * @return {undefined}
 */
async function installAllRequirements() {
  // await mkdir(join(this.serviceDir, '.serverless'), {recursive: true});
  // First, check and delete cache versions, if enabled
  await checkForAndDeleteMaxCacheVersions(this);

  // Then if we're going to package functions individually...
  if (this.serverless.service.package.individually) {
    let doneModules = [];
    const filteredFuncs = this.targetFuncs.filter((func) =>
      (func.runtime || this.serverless.service.provider.runtime).match(
        /^python.*/
      )
    );

    for (const f of filteredFuncs) {
      if (!f?.module) {
        f.module = '.';
      }

      // If we didn't already process a module (functions can re-use modules)
      if (!doneModules.includes(f.module)) {
        const reqsInstalledAt = await installRequirementsIfNeeded(
          f.module,
          f,
          this
        );
        // Add modulePath into .serverless for each module so it's easier for injecting and for users to see where reqs are
        let modulePath = join(
          this.serviceDir,
          '.serverless',
          `${f.module}`,
          'requirements'
        );
        // Only do if we didn't already do it
        if (
          reqsInstalledAt &&
          !(await exists(modulePath)) &&
          reqsInstalledAt != modulePath
        ) {
          if (this.options.useStaticCache) {
            // Windows can't symlink so we have to copy on Windows,
            // it's not as fast, but at least it works
            if (process.platform == 'win32') {
              await cp(reqsInstalledAt, modulePath, { recursive: true });
            } else {
              await symlink(reqsInstalledAt, modulePath);
            }
          } else {
            if (await exists(reqsInstalledAt)) {
              await rename(reqsInstalledAt, modulePath);
            }
          }
        }
        doneModules.push(f.module);
      }
    }
  } else {
    const reqsInstalledAt = await installRequirementsIfNeeded('', {}, this);
    // Add symlinks into .serverless for so it's easier for injecting and for users to see where reqs are
    let symlinkPath = join(this.serviceDir, '.serverless', `requirements`);
    // Only do if we didn't already do it
    if (
      reqsInstalledAt &&
      !(await exists(symlinkPath)) &&
      reqsInstalledAt != symlinkPath
    ) {
      // Windows can't symlink so we have to use junction on Windows
      if (process.platform == 'win32') {
        await symlink(reqsInstalledAt, symlinkPath, 'junction');
      } else {
        await symlink(reqsInstalledAt, symlinkPath);
      }
    }
  }
}

export { installAllRequirements };
