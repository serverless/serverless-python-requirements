/* jshint ignore:start */
'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const fse = require('fs-extra');
const child_process = require('child_process');
const Zip = require('adm-zip');

BbPromise.promisifyAll(fse);

class ServerlessPythonRequirements {
  packVendorHelper() {
    this.serverless.cli.log('Packaging Python requirements helper...');

    return fse.copyAsync(
      path.resolve(__dirname, 'requirements.py'),
      path.join(this.serverless.config.servicePath, 'requirements.py'));
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
      return new BbPromise((resolve, reject) => {
        if (this.custom.zipImport) {
          this.serverless.cli.log('Zipping required Python packages...');
          const zip = new Zip();
          zip.addLocalFolder('.requirements', '');
          zip.writeZip('.requirements.zip');
          fse.remove('.requirements', (err) => err?reject():resolve());
        } else resolve();
      });
    });
  }

  linkRequirements() {
    if (!this.custom.zipImport && this.custom.link) {
      this.serverless.cli.log('Linking required Python packages...');
      fse.readdirSync('.requirements').map(file =>
        fse.symlinkSync(`.requirements/${file}`, `./${file}`));
    }
  }

  unlinkRequirements() {
    if (!this.custom.zipImport && this.custom.link) {
      this.serverless.cli.log('Unlinking required Python packages...');
      fse.readdirSync('.requirements').map(file => fse.unlinkSync(file));
    }
  }

  cleanup() {
    const artifacts = ['requirements.py'];
    if (this.custom.zipImport)
      artifacts.push('.requirements.zip')
    else
      artifacts.push('.requirements')

    return BbPromise.all(_.map(artifacts, (artifact) =>
      fse.removeAsync(path.join(this.serverless.config.servicePath, artifact))));;
  };

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.custom = Object.assign({
      zipImport: false,
      link: true,
    }, this.serverless.service.custom &&
    this.serverless.service.custom.pythonRequirements || {});

    this.commands = {
      'requirements': {
        commands: {
          'clean': {
            usage: 'Remove .requirements and requirements.py',
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
        .then(this.packVendorHelper)
        .then(this.packRequirements)
        .then(this.linkRequirements),

      'after:deploy:createDeploymentArtifacts': () => BbPromise.bind(this)
        .then(this.unlinkRequirements),

      'requirements:install:install': () => BbPromise.bind(this)
        .then(this.packVendorHelper)
        .then(this.packRequirements),

      'requirements:clean:clean': () => BbPromise.bind(this)
        .then(this.cleanup)
        .then(this.unlinkRequirements),
    };
  }
}

module.exports = ServerlessPythonRequirements;
