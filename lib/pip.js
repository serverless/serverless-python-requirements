const fse = require('fs-extra');
const path = require('path');
const {spawnSync} = require('child_process');

/**
 * pip install the requirements to the .serverless/requirements directory
 * @return {Promise}
 */
function installRequirements() {
  const dotSlsReqs = '.serverless/requirements.txt';
  let fileName = this.options.fileName;
  if (this.options.usePipenv && fse.existsSync(path.join(this.servicePath, 'Pipfile'))) {
    fileName = dotSlsReqs;
  }

  if (!fse.existsSync(path.join(this.servicePath, fileName)))
    return;

  this.serverless.cli.log(`Installing required Python packages with ${this.options.pythonBin}...`);

  // In case the requirements file is a symlink, copy it to .serverless/requirements.txt
  // if using docker to avoid errors
  if (this.options.dockerizePip && fileName !== dotSlsReqs) {
    fse.copySync(fileName, dotSlsReqs);
    fileName = dotSlsReqs;
  }

  let cmd;
  let options;
  const pipCmd = [
    this.options.pythonBin, '-m', 'pip', '--isolated', 'install',
    '-t', '.serverless/requirements', '-r', fileName,
    ...this.options.pipCmdExtraArgs,
  ];
  if (!this.options.dockerizePip) {
    // Check if pip has Debian's --system option and set it if so
    const pipTestRes = spawnSync(
      this.options.pythonBin, ['-m', 'pip', 'help', 'install']);
    if (pipTestRes.error) {
      if (pipTestRes.error.code === 'ENOENT')
        throw new Error(`${this.options.pythonBin} not found! ` +
                      'Try the pythonBin option.');
      throw new Error(pipTestRes.error);
    }
    if (pipTestRes.stdout.toString().indexOf('--system') >= 0)
      pipCmd.push('--system');
  }
  if (this.options.dockerizePip) {
    cmd = 'docker';

    this.serverless.cli.log(`Docker Image: ${this.options.dockerImage}`);

    // Check docker server os type from 'docker version'
    let volPath;
    options = [
      'version', '--format', '{{with .Server}}{{.Os}}{{end}}'
    ];
    const ps = spawnSync(cmd, options, {'timeout': 2000, 'encoding': 'utf-8'});
    if (ps.error) {
      if (ps.error.code === 'ENOENT') {
        throw new Error('docker not found! Please install it.');
      }
      throw new Error(ps.error);
    }
    if (ps.status !== 0) {
      throw new Error(ps.stderr);
    } else if (ps.stdout.trim() === 'windows') {
      volPath = this.servicePath.replace(/\\/g, '/').replace(/^\/mnt\//, '/');
    } else {
      volPath = this.servicePath;
    }

    options = [
      'run', '--rm',
      '-v', `${volPath}:/var/task:z`,
    ];
    if (process.platform === 'linux')
      options.push('-u', `${process.getuid()}:${process.getgid()}`);
    options.push(this.options.dockerImage);
    options.push(...pipCmd);
  } else {
    cmd = pipCmd[0];
    options = pipCmd.slice(1);
  }
  const res = spawnSync(cmd, options, {cwd: this.servicePath});
  if (res.error) {
    if (res.error.code === 'ENOENT') {
      if (this.options.dockerizePip) {
        throw new Error('docker not found! Please install it.');
      }
      throw new Error(`${this.options.pythonBin} not found! Try the pythonBin option.`);
    }
    throw new Error(res.error);
  }
  if (res.status !== 0)
    throw new Error(res.stderr);
};

module.exports = {installRequirements};
