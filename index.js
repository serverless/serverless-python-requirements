/* jshint ignore:start */
'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const fse = require('fs-extra');
const child_process = require('child_process');
const zipDirectory = require('./zipService').zipDirectory;

BbPromise.promisifyAll(fse);

class ServerlessPythonRequirements {
  addVendorHelper() {
    if (this.custom.zip) {
      this.serverless.cli.log('Removing Python requirements helper...');

      return fse.copyAsync(
        path.resolve(__dirname, 'unzip_requirements.py'),
        path.join(this.serverless.config.servicePath, 'unzip_requirements.py'));
    }
  };

  removeVendorHelper() {
    if (this.custom.zip) {
      this.serverless.cli.log('Adding Python requirements helper...');
      return fse.removeAsync('unzip_requirements.py');
    }
  };

  installRequirements() {
    if (!fse.existsSync(path.join(this.serverless.config.servicePath, 'requirements.txt'))) {
      return BbPromise.resolve();
    }

    this.serverless.cli.log('Installing required Python packages...');

    return new BbPromise((resolve, reject) => {
      let cmd, options;
      const pipCmd = [
        'pip', '--isolated', 'install',
        '-t', '.requirements', '-r', 'requirements.txt',
      ];
      const dockerCmd = [
        'docker', 'run', '--rm',
        '-v', `${this.serverless.config.servicePath}:/var/task:z`,
        'lambci/lambda:build-python2.7',
        'bash', '-c',
      ];
      if (this.custom.dockerizePip) {
        cmd = dockerCmd[0];
        options = dockerCmd.slice(1);
        pipCmd.unshift('pip install --upgrade pip &&')
        options.push(pipCmd.join(' '))
      } else {
        cmd = pipCmd[0];
        options = pipCmd.slice(1);
      }
      const res = child_process.spawnSync(cmd, options);
      if (res.error) {
        return reject(res.error);
      }
      if (res.status != 0) {
        return reject(res.stderr);
      }
      resolve();
    });
  };

  packRequirements() {
    return this.installRequirements().then(() => {
      if (this.custom.zip) {
        this.serverless.cli.log('Zipping required Python packages...');
        return zipDirectory('.requirements', '.requirements.zip');
      }
    });
  }

  linkRequirements() {
    if (!this.custom.zip) {
      this.serverless.cli.log('Linking required Python packages...');
      fse.readdirSync('.requirements').map(file =>
        fse.symlinkSync(`.requirements/${file}`, `./${file}`));
    }
  }

  unlinkRequirements() {
    if (!this.custom.zip) {
      this.serverless.cli.log('Unlinking required Python packages...');
      fse.readdirSync('.requirements').map(file => fse.unlinkSync(file));
    }
  }

  cleanup() {
    const artifacts = ['.requirements'];
    if (this.custom.zip) {
      artifacts.push('.requirements.zip');
      artifacts.push('unzip_requirements.py');
    }

    return BbPromise.all(_.map(artifacts, (artifact) =>
      fse.removeAsync(path.join(this.serverless.config.servicePath, artifact))));;
  };

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.custom = Object.assign({
      zip: false,
    }, this.serverless.service.custom &&
    this.serverless.service.custom.pythonRequirements || {});

    if (!_.has(this.serverless.service, ['package', 'exclude']))
      _.set(this.serverless.service, ['package', 'exclude'], []);
    this.serverless.service.package.exclude.push('.requirements/**');

    this.commands = {
      'requirements': {
        commands: {
          'clean': {
            usage: 'Remove .requirements and requirements.zip',
            lifecycleEvents: [
              'clean',
            ],
          },
          'install': {
            usage: 'install requirements manually',
            lifecycleEvents: [
              'install',
            ],
          },
        },
      },
    };

    this.hooks = {
      'before:deploy:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.addVendorHelper)
        .then(this.packRequirements)
        .then(this.linkRequirements),

      'after:deploy:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.removeVendorHelper)
        .then(this.unlinkRequirements),

      'requirements:install:install': () => BbPromise.bind(this)
        .then(this.addVendorHelper)
        .then(this.packRequirements),

      'requirements:clean:clean': () => BbPromise.bind(this)
        .then(this.cleanup)
        .then(this.unlinkRequirements),
    };
  }
}

module.exports = ServerlessPythonRequirements;
