/* jshint ignore:start */
'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const fse = require('fs-extra');
const {spawnSync} = require('child_process');
const zipDirectory = require('./zipService').zipDirectory;

BbPromise.promisifyAll(fse);

/**
 * Plugin for Serverless 1.x that bundles python requirements!
 */
class ServerlessPythonRequirements {
  /**
   * add the vendor helper to the current service tree
   * @return {Promise}
   */
  addVendorHelper() {
    if (this.custom().zip) {
      this.serverless.cli.log('Adding Python requirements helper...');

      return fse.copyAsync(
        path.resolve(__dirname, 'unzip_requirements.py'),
        path.join(this.serverless.config.servicePath, 'unzip_requirements.py'));
    }
  };

  /**
   * remove the vendor helper from the current service tree
   * @return {Promise}
   */
  removeVendorHelper() {
    if (this.custom().zip && this.custom().cleanupZipHelper) {
      this.serverless.cli.log('Removing Python requirements helper...');
      return fse.removeAsync('unzip_requirements.py');
    }
  };

  /**
   * parse requirements.txt into .requirements.txt, leaving out #no-deploy lines
   * @return {true}
   */
  parseRequirements() {
    if (!fse.existsSync(path.join(this.serverless.config.servicePath,
                                  'requirements.txt'))) {
      return true;
    }

    this.serverless.cli.log(
      `Parsing Python requirements.txt`);

    const reqs = fse.readFileSync('requirements.txt').toString().split('\n');

    let newReqs = '';
    for (const req of reqs) {
      if (req.indexOf('#no-deploy') === -1) {
          newReqs += `${req}\n`;
        }
    }
    if (!fse.existsSync('.serverless'))
      fse.mkdirSync('.serverless');
    fse.writeFileSync('.serverless/requirements.txt', newReqs, 'utf8');

    return true;
  };

  /**
   * pip install the requirements to the .requirements directory
   * @return {Promise}
   */
  installRequirements() {
    if (!fse.existsSync(path.join(this.serverless.config.servicePath,
                                  '.serverless/requirements.txt'))) {
      return BbPromise.resolve();
    }

    const runtime = this.serverless.service.provider.runtime;
    this.serverless.cli.log(
      `Installing required Python packages for runtime ${runtime}...`);

    return new BbPromise((resolve, reject) => {
      let cmd;
      let options;
      const pipCmd = [
        runtime, '-m', 'pip', '--isolated', 'install',
        '-t', '.requirements', '-r', '.serverless/requirements.txt',
      ];
      if (!this.custom().dockerizePip) {
        const pipTestRes = spawnSync(runtime, ['-m', 'pip', 'help', 'install']);
        if (pipTestRes.stdout.toString().indexOf('--system') >= 0)
          pipCmd.push('--system');
      }
      if (this.custom().dockerizePip) {
        cmd = 'docker';

        const image = this.custom().dockerImage
         || `lambci/lambda:build-${runtime}`;
        this.serverless.cli.log(`Docker Image: ${image}`);

        options = [
          'run', '--rm',
          '-u', process.getuid() + ':' + process.getgid(),
          '-v', `${this.serverless.config.servicePath}:/var/task:z`,
          `${image}`,
        ];
        options.push(...pipCmd);
      } else {
        cmd = pipCmd[0];
        options = pipCmd.slice(1);
      }
      const res = spawnSync(cmd, options);
      if (res.error) {
        return reject(res.error);
      }
      if (res.status != 0) {
        return reject(res.stderr);
      }
      resolve();
    });
  };

  /**
   * zip up .requirements
   * @return {Promise}
   */
  packRequirements() {
    return this.installRequirements().then(() => {
      if (this.custom().zip) {
        this.serverless.cli.log('Zipping required Python packages...');
        return zipDirectory('.requirements', '.requirements.zip');
      }
    });
  }

  /**
   * link all the files in .requirements to the service directory root
   * @return {undefined}
   */
  linkRequirements() {
    if (!this.custom().zip) {
      this.serverless.cli.log('Linking required Python packages...');
      fse.readdirSync('.requirements').map((file) => {
          this.serverless.service.package.include.push(file);
          this.serverless.service.package.include.push(`${file}/**`);
        try {
          fse.symlinkSync(`.requirements/${file}`, `./${file}`);
        } catch (exception) {
          let linkDest = null;
          try {
            linkDest = fse.readlinkSync(`./${file}`);
          } catch (e) {}
          if (linkDest !== `.requirements/${file}`)
            throw new Error(`Unable to link dependency '${file}' because a file
                             by the same name exists in this service`);
        }
      }
        );
    }
  }

  /**
   * unlink all the files in .requirements from the service directory root
   * @return {undefined}
   */
  unlinkRequirements() {
    if (!this.custom().zip) {
      this.serverless.cli.log('Unlinking required Python packages...');
      fse.readdirSync('.requirements').map((file) => fse.unlinkSync(file));
    }
  }

  /**
   * clean up .requirements and .requirements.zip and unzip_requirements.py
   * @return {Promise}
   */
  cleanup() {
    const artifacts = ['.requirements'];
    if (this.custom().zip) {
      artifacts.push('.requirements.zip');
      artifacts.push('unzip_requirements.py');
    }

    return BbPromise.all(_.map(artifacts, (artifact) => fse.removeAsync(
      path.join(this.serverless.config.servicePath, artifact))));
  };

  /**
   * get the custom.pythonRequirements contents, with defaults set
   * @return {Object}
   */
  custom() {
    return Object.assign({
      zip: false,
      cleanupZipHelper: true,
    }, this.serverless.service.custom &&
    this.serverless.service.custom.pythonRequirements || {});
  }

  /**
   * The plugin constructor
   * @param {Object} serverless
   * @param {Object} options
   * makes
   * @return {undefined}
   */
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
        .then(this.parseRequirements)
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
        .then(this.parseRequirements)
        .then(this.packRequirements),
      'requirements:clean:clean': () => BbPromise.bind(this)
        .then(this.cleanup)
        .then(this.removeVendorHelper),
    };
  }
}

module.exports = ServerlessPythonRequirements;
