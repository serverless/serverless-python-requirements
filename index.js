/* jshint ignore:start */
'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
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
    return Object.assign({
      zip: false,
      cleanupZipHelper: true,
      invalidateCaches: false,
      fileName: 'requirements.txt',
      pythonBin: this.serverless.service.provider.runtime,
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
    }, this.serverless.service.custom &&
    this.serverless.service.custom.pythonRequirements || {});
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

    if (!_.get(this.serverless.service, 'package.exclude'))
      _.set(this.serverless.service, ['package', 'exclude'], []);
    this.serverless.service.package.exclude.push('.requirements/**');
    if (!_.get(this.serverless.service, 'package.include'))
      _.set(this.serverless.service, ['package', 'include'], []);

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
      .then(pipfileToRequirements.bind(this))
      .then(addVendorHelper.bind(this))
      .then(installRequirements.bind(this))
      .then(packRequirements.bind(this))
      .then(linkRequirements.bind(this));

    const after = () => BbPromise.bind(this)
      .then(removeVendorHelper.bind(this))
      .then(unlinkRequirements.bind(this));

    const invalidateCaches = () => {
      if (this.options.invalidateCaches) {
        return BbPromise.bind(this)
          .then(cleanup.bind(this))
          .then(removeVendorHelper.bind(this));
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
        .then(pipfileToRequirements.bind(this))
        .then(addVendorHelper.bind(this))
        .then(installRequirements.bind(this))
        .then(packRequirements.bind(this)),
      'requirements:clean:clean': () => BbPromise.bind(this)
        .then(cleanup.bind(this))
        .then(removeVendorHelper.bind(this)),
    };
  }
}

module.exports = ServerlessPythonRequirements;
