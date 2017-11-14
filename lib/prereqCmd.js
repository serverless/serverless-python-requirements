const fse = require('fs-extra');
const path = require('path');
const {spawnSync} = require('child_process');

/**
 * run a prerequisite script if provided
 * @return {Promise}
 */
function runPrereqCmd() {
  const {prereqCmd} = this.options;
  if (!prereqCmd)
    return;
  this.serverless.cli.log(`Running prerequisite script: ${prereqCmd}`);
  let options = [];
  if (this.options.dockerizePip) {
    cmd = 'docker';
    options = [
      'run', '--rm',
      '-v', `${this.servicePath}:/var/task:z`,
      prereqCmd,
    ];
    if (process.platform === 'linux')
      options.push('-u', `${process.getuid()}:${process.getgid()}`);
    options.push(this.options.dockerImage);
    options.push(...pipCmd);
  } else {
    cmd = prereqCmd;
  }
  const res = spawnSync(cmd, options, {cwd: this.servicePath});
  if (res.error) {
    if (res.error.code === 'ENOENT') {
      if (this.options.dockerizePip) {
        throw new Error('docker not found! Please install it.');
      } else {
        throw new Error(`${prereqCmd} not found!`);
      }
    }
    throw new Error(res.error);
  }
  if (res.status != 0)
    throw new Error(res.stderr);
};

module.exports = {runPrereqCmd};
