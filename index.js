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
    if (this.custom().zip) {
      this.serverless.cli.log('Removing Python requirements helper...');

      return fse.copyAsync(
        path.resolve(__dirname, 'unzip_requirements.py'),
        path.join(this.serverless.config.servicePath, 'unzip_requirements.py'));
    }
  };

  removeVendorHelper() {
    if (this.custom().zip && this.custom().cleanupZipHelper) {
      this.serverless.cli.log('Adding Python requirements helper...');
      return fse.removeAsync('unzip_requirements.py');
    }
  };

  installRequirements() {
    if (!fse.existsSync(path.join(this.serverless.config.servicePath, 'requirements.txt'))) {
      return BbPromise.resolve();
    }

    const runtime = this.serverless.service.provider.runtime;
    this.serverless.cli.log(`Installing required Python packages for runtime ${runtime}...`);

    return new BbPromise((resolve, reject) => {
      let cmd, options;
      const pipCmd = [
        runtime, '-m', 'pip', '--isolated', 'install', '--system',
        '-t', '.requirements', '-r', 'requirements.txt',
      ];
      if (this.custom().dockerizePip) {
        cmd = 'docker';
        options = [
          'run', '--rm',
          '-u', process.getuid() + ':' + process.getgid(),
          '-v', `${this.serverless.config.servicePath}:/var/task:z`,
          `lambci/lambda:build-${runtime}`,
        ];
        options.push(...pipCmd)
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
      if (this.custom().zip) {
        this.serverless.cli.log('Zipping required Python packages...');
        return zipDirectory('.requirements', '.requirements.zip');
      }
    });
  }

  linkRequirements() {
    if (!this.custom().zip) {
      this.serverless.cli.log('Linking required Python packages...');
      fse.readdirSync('.requirements').map(file => {
          this.serverless.service.package.include.push(file);
          this.serverless.service.package.include.push(`${file}/**`);
        try {
          fse.symlinkSync(`.requirements/${file}`, `./${file}`)
        } catch (exception) {
          let linkDest = null;
          try {linkDest = fse.readlinkSync(`./${file}`);} catch (e) {}
          if (linkDest !== `.requirements/${file}`)
            throw new Error(`Unable to link dependency "${file}" because a file by the same name exists in this service`);
        }
      }
        );
    }
  }

  unlinkRequirements() {
    if (!this.custom().zip) {
      this.serverless.cli.log('Unlinking required Python packages...');
      fse.readdirSync('.requirements').map(file => fse.unlinkSync(file));
    }
  }

  cleanup() {
    const artifacts = ['.requirements'];
    if (this.custom().zip) {
      artifacts.push('.requirements.zip');
      artifacts.push('unzip_requirements.py');
    }

    return BbPromise.all(_.map(artifacts, (artifact) =>
      fse.removeAsync(path.join(this.serverless.config.servicePath, artifact))));;
  };
  custom() {
    return Object.assign({
      zip: false,
      cleanupZipHelper: true,
    }, this.serverless.service.custom &&
    this.serverless.service.custom.pythonRequirements || {});
  }

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;

    if (!_.get(this.serverless.service, 'package.exclude'))
      _.set(this.serverless.service, ['package', 'exclude'], []);
    this.serverless.service.package.exclude.push('.requirements/**');
    if (!_.get(this.serverless.service, 'package.include'))
      _.set(this.serverless.service, ['package', 'include'], []);

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

    let before = () => BbPromise.bind(this)
        .then(this.addVendorHelper)
        .then(this.packRequirements)
        .then(this.linkRequirements);

    let after = () => BbPromise.bind(this)
        .then(this.removeVendorHelper)
        .then(this.unlinkRequirements);

    this.hooks = {
      'before:package:createDeploymentArtifacts': before,
      'after:package:createDeploymentArtifacts': after,
      'before:deploy:function:packageFunction': before,
      'after:deploy:function:packageFunction': after,
      'requirements:install:install': () => BbPromise.bind(this)
        .then(this.addVendorHelper)
        .then(this.packRequirements),
      'requirements:clean:clean': () => BbPromise.bind(this)
        .then(this.cleanup)
        .then(this.removeVendorHelper)
        .then(this.unlinkRequirements),
    };
  }
}

module.exports = ServerlessPythonRequirements;
