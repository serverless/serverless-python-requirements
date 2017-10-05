const fse = require('fs-extra');
const path = require('path');
const {spawnSync} = require('child_process');

/**
  * pip install the requirements to the .requirements directory
  * @return {Promise}
  */
function installRequirements() {
  let fileName = this.options.fileName;
  if (fse.existsSync(path.join(this.servicePath, 'Pipfile'))) {
    fileName = '.serverless/requirements.txt';
  }

  if (!fse.existsSync(path.join(this.servicePath, fileName)))
    return;

  this.serverless.cli.log(`Installing required Python packages with ${this.options.pythonBin}...`);

  let cmd;
  let options;
  const pipCmd = [
    this.options.pythonBin, '-m', 'pip', '--isolated', 'install',
    '-t', '.requirements', '-r', fileName,
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

    options = [
      'run', '--rm',
      '-v', `${this.servicePath}:/var/task:z`,
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
      } else {
        throw new Error(`${this.options.pythonBin} not found! Try the pythonBin option.`);
      }
    }
    throw new Error(res.error);
  }
  if (res.status != 0)
    throw new Error(res.stderr);
};

module.exports = {installRequirements};
