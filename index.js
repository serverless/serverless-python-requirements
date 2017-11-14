/* jshint ignore:start */
'use strict';

const BbPromise = require('bluebird');
const fse = require('fs-extra');
const {addVendorHelper, removeVendorHelper, packRequirements} = require('./lib/zip');
const {installRequirements} = require('./lib/pip');
const {pipfileToRequirements} = require('./lib/pipenv');
const {linkRequirements, unlinkRequirements} = require('./lib/link');
const {cleanup} = require('./lib/clean');

BbPromise.promisifyAll(fse);

/**
 * Plugin for Serverless 1.x that bundles python requirements!
 */
class ServerlessPythonRequirements {
  /**
   * get the custom.pythonRequirements contents, with defaults set
   * @return {Object}
   */
  get options() {
    const options = Object.assign({
      zip: false,
      cleanupZipHelper: true,
      invalidateCaches: false,
      fileName: 'requirements.txt',
      usePipenv: true,
      pythonBin: this.serverless.service.provider.runtime || 'python',
      dockerizePip: false,
      dockerImage: `lambci/lambda:build-${this.serverless.service.provider.runtime}`,
      pipCmdExtraArgs: [],
      noDeploy: [
        'boto3',
        'botocore',
        'docutils',
        'jmespath',
        'python-dateutil',
        's3transfer',
        'six',
        'pip',
        'setuptools',
      ],
    }, this.serverless.service.custom && this.serverless.service.custom.pythonRequirements || {});
    if (options.dockerizePip === 'non-linux')
      options.dockerizePip = process.platform !== 'linux';
    return options;
  }

  /**
   * The plugin constructor
   * @param {Object} serverless
   * @param {Object} options
   * @return {undefined}
   */
  constructor(serverless, options) {
    this.serverless = serverless;
    this.servicePath = this.serverless.config.servicePath;

    this.commands = {
      requirements: {
        commands: {
          clean: {
            usage: 'Remove .requirements and requirements.zip',
            lifecycleEvents: [
              'clean',
            ],
          },
          install: {
            usage: 'install requirements manually',
            lifecycleEvents: [
              'install',
            ],
          },
        },
      },
    };

    const before = () => BbPromise.bind(this)
      .then(pipfileToRequirements)
      .then(addVendorHelper)
      .then(installRequirements)
      .then(packRequirements)
      .then(linkRequirements);

    const after = () => BbPromise.bind(this)
      .then(removeVendorHelper)
      .then(unlinkRequirements);

    const invalidateCaches = () => {
      if (this.options.invalidateCaches) {
        return BbPromise.bind(this)
          .then(cleanup)
          .then(removeVendorHelper);
      }
      return BbPromise.resolve();
    };

    this.hooks = {
      'after:package:cleanup': invalidateCaches,
      'before:package:createDeploymentArtifacts': before,
      'after:package:createDeploymentArtifacts': after,
      'before:deploy:function:packageFunction': before,
      'after:deploy:function:packageFunction': after,
      'requirements:install:install': () => BbPromise.bind(this)
        .then(pipfileToRequirements)
        .then(addVendorHelper)
        .then(installRequirements)
        .then(packRequirements),
      'requirements:clean:clean': () => BbPromise.bind(this)
        .then(cleanup)
        .then(removeVendorHelper),
    };
  }
}

module.exports = ServerlessPythonRequirements;
