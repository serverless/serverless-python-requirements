/* jshint ignore:start */
'use strict';

const BbPromise = require('bluebird');
const fse = require('fs-extra');
const {
  addVendorHelper,
  removeVendorHelper,
  packRequirements
} = require('./lib/zip');
const { injectAllRequirements } = require('./lib/inject');
const { installAllRequirements } = require('./lib/pip');
const { pipfileToRequirements } = require('./lib/pipenv');
const { cleanup } = require('./lib/clean');

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
    const options = Object.assign(
      {
        slim: false,
        zip: false,
        cleanupZipHelper: true,
        invalidateCaches: false,
        fileName: 'requirements.txt',
        usePipenv: true,
        pythonBin: this.serverless.service.provider.runtime || 'python',
        dockerizePip: false,
        dockerSsh: false,
        dockerImage: null,
        dockerFile: null,
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
          'setuptools'
        ],
        vendor: ''
      },
      (this.serverless.service.custom &&
        this.serverless.service.custom.pythonRequirements) ||
        {}
    );
    if (options.dockerizePip === 'non-linux') {
      options.dockerizePip = process.platform !== 'linux';
    }
    if (
      !options.dockerizePip &&
      (options.dockerSsh || options.dockerImage || options.dockerFile)
    ) {
      if (!this.warningLogged) {
        this.serverless.cli.log(
          'WARNING: You provided a docker related option but dockerizePip is set to false.'
        );
        this.warningLogged = true;
      }
    }
    if (options.dockerImage && options.dockerFile) {
      throw new Error(
        'Python Requirements: you can provide a dockerImage or a dockerFile option, not both.'
      );
    } else if (!options.dockerFile) {
      // If no dockerFile is provided, use default image
      const defaultImage = `lambci/lambda:build-${
        this.serverless.service.provider.runtime
      }`;
      options.dockerImage = options.dockerImage || defaultImage;
    }
    return options;
  }

  /**
   * The plugin constructor
   * @param {Object} serverless
   * @param {Object} options
   * @return {undefined}
   */
  constructor(serverless) {
    this.serverless = serverless;
    this.servicePath = this.serverless.config.servicePath;
    this.warningLogged = false;

    this.commands = {
      requirements: {
        commands: {
          clean: {
            usage: 'Remove .requirements and requirements.zip',
            lifecycleEvents: ['clean']
          },
          install: {
            usage: 'install requirements manually',
            lifecycleEvents: ['install']
          }
        }
      }
    };

    const before = () => {
      if (
        arguments[1].functionObj &&
        arguments[1].functionObj.runtime &&
        !arguments[1].functionObj.runtime.startsWith('python')
      )
        return;
      return BbPromise.bind(this)
        .then(pipfileToRequirements)
        .then(addVendorHelper)
        .then(installAllRequirements)
        .then(packRequirements);
    };

    const after = () => {
      if (
        arguments[1].functionObj &&
        arguments[1].functionObj.runtime &&
        !arguments[1].functionObj.runtime.startsWith('python')
      )
        return;
      return BbPromise.bind(this)
        .then(removeVendorHelper)
        .then(() =>
          injectAllRequirements.bind(this)(
            arguments[1].functionObj &&
              arguments[1].functionObj.package.artifact
          )
        );
    };

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
      'requirements:install:install': () =>
        BbPromise.bind(this)
          .then(pipfileToRequirements)
          .then(addVendorHelper)
          .then(installAllRequirements)
          .then(packRequirements),
      'requirements:clean:clean': () =>
        BbPromise.bind(this)
          .then(cleanup)
          .then(removeVendorHelper)
    };
  }
}

module.exports = ServerlessPythonRequirements;
