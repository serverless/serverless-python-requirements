/* jshint ignore:start */
'use strict';

import {
  addVendorHelper,
  removeVendorHelper,
  packRequirements,
} from './lib/zip.js';
import { injectAllRequirements } from './lib/inject.js';
import { layerRequirements } from './lib/layer.js';
import { installAllRequirements } from './lib/pip.js';
import { pipfileToRequirements } from './lib/pipenv.js';
import { cleanup, cleanupCache } from './lib/clean.js';

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
        slimPatterns: false,
        slimPatternsAppendDefaults: true,
        zip: false,
        layer: false,
        cleanupZipHelper: true,
        invalidateCaches: false,
        fileName: 'requirements.txt',
        usePipenv: true,
        usePoetry: true,
        pythonBin:
          process.platform === 'win32'
            ? 'python.exe'
            : this.serverless.service.provider.runtime || 'python',
        dockerizePip: false,
        dockerSsh: false,
        dockerPrivateKey: null,
        dockerImage: null,
        dockerFile: null,
        dockerEnv: false,
        dockerBuildCmdExtraArgs: [],
        dockerRunCmdExtraArgs: [],
        dockerExtraFiles: [],
        useStaticCache: true,
        useDownloadCache: true,
        cacheLocation: false,
        staticCacheMaxVersions: 0,
        pipCmdExtraArgs: [],
        noDeploy: [],
        vendor: '',
        requirePoetryLockFile: false,
        poetryWithGroups: [],
        poetryWithoutGroups: [],
        poetryOnlyGroups: [],
      },
      (this.serverless.service.custom &&
        this.serverless.service.custom.pythonRequirements) ||
        {}
    );
    if (
      options.pythonBin === this.serverless.service.provider.runtime &&
      !options.pythonBin.startsWith('python')
    ) {
      options.pythonBin = 'python';
    }

    if (options.dockerizePip === 'non-linux') {
      options.dockerizePip = process.platform !== 'linux';
    }
    if (options.dockerizePip && process.platform === 'win32') {
      options.pythonBin = 'python';
    }
    if (
      !options.dockerizePip &&
      (options.dockerSsh ||
        options.dockerImage ||
        options.dockerFile ||
        options.dockerPrivateKey)
    ) {
      if (!this.warningLogged) {
        this.log.warning(
          'You provided a docker related option but dockerizePip is set to false.'
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
      const architecture =
        this.serverless.service.provider.architecture || 'x86_64';
      const defaultImage = `public.ecr.aws/sam/build-${this.serverless.service.provider.runtime}:latest-${architecture}`;
      options.dockerImage = options.dockerImage || defaultImage;
    }
    if (options.layer) {
      // If layer was set as a boolean, set it to an empty object to use the layer defaults.
      if (options.layer === true) {
        options.layer = {};
      }
    }
    return options;
  }

  get targetFuncs() {
    let inputOpt = this.serverless.processedInput.options;
    return inputOpt.function
      ? [this.serverless.service.functions[inputOpt.function]]
      : Object.values(this.serverless.service.functions).filter(
          (func) => !func.image
        );
  }

  /**
   * The plugin constructor
   * @param {Object} serverless
   * @param {Object} options
   * @param {Object} v3Utils
   * @return {undefined}
   */
  constructor(serverless, cliOptions, v3Utils) {
    this.serverless = serverless;
    this.serviceDir = this.serverless.serviceDir;
    this.warningLogged = false;
    if (
      this.serverless.configSchemaHandler &&
      this.serverless.configSchemaHandler.defineFunctionProperties
    ) {
      this.serverless.configSchemaHandler.defineFunctionProperties('aws', {
        properties: {
          module: {
            type: 'string',
          },
        },
      });
    }

    if (v3Utils) {
      this.log = v3Utils.log;
      this.progress = v3Utils.progress;
      this.writeText = v3Utils.writeText;
    }

    this.commands = {
      requirements: {
        commands: {
          clean: {
            usage: 'Remove .requirements and requirements.zip',
            lifecycleEvents: ['clean'],
          },
          install: {
            usage: 'install requirements manually',
            lifecycleEvents: ['install'],
          },
          cleanCache: {
            usage:
              'Removes all items in the pip download/static cache (if present)',
            lifecycleEvents: ['cleanCache'],
          },
        },
      },
    };

    if (this.serverless.cli.generateCommandsHelp) {
      Object.assign(this.commands.requirements, {
        usage: 'Serverless plugin to bundle Python packages',
        lifecycleEvents: ['requirements'],
      });
    } else {
      this.commands.requirements.type = 'container';
    }

    const isFunctionRuntimePython = (args) => {
      // If functionObj.runtime is undefined, python.
      if (!args[1].functionObj || !args[1].functionObj.runtime) {
        return true;
      }
      return args[1].functionObj.runtime.startsWith('python');
    };

    const clean = async () => {
      await cleanup.bind(this)();
      await removeVendorHelper.bind(this)();
    };

    const setupArtifactPathCapturing = () => {
      // Reference:
      // https://github.com/serverless/serverless/blob/9591d5a232c641155613d23b0f88ca05ea51b436/lib/plugins/package/lib/packageService.js#L139
      // The packageService#packageFunction does set artifact path back to the function config.
      // As long as the function config's "package" attribute wasn't undefined, we can still use it
      // later to access the artifact path.
      for (const functionName in this.serverless.service.functions) {
        if (!serverless.service.functions[functionName].package) {
          serverless.service.functions[functionName].package = {};
        }
      }
    };

    const before = async () => {
      if (!isFunctionRuntimePython(arguments)) {
        return;
      }
      await pipfileToRequirements.bind(this)();
      await addVendorHelper.bind(this)();
      await installAllRequirements.bind(this)();
      await packRequirements.bind(this)();
      await setupArtifactPathCapturing.bind(this)();
    };

    const after = async () => {
      if (!isFunctionRuntimePython(arguments)) {
        return;
      }
      await removeVendorHelper.bind(this)();
      await layerRequirements.bind(this)();
      await injectAllRequirements.bind(this)(
        arguments[1].functionObj && arguments[1].functionObj.package.artifact
      );
    };

    const invalidateCaches = () => {
      if (this.options.invalidateCaches) {
        return clean;
      }
    };

    const cleanCache = async () => {
      await cleanupCache.bind(this)();
    };

    this.hooks = {
      'after:package:cleanup': invalidateCaches,
      'before:package:createDeploymentArtifacts': before,
      'after:package:createDeploymentArtifacts': after,
      'before:deploy:function:packageFunction': before,
      'after:deploy:function:packageFunction': after,
      'requirements:requirements': () => {
        this.serverless.cli.generateCommandsHelp(['requirements']);
        return Promise.resolve();
      },
      'requirements:install:install': before,
      'requirements:clean:clean': clean,
      'requirements:cleanCache:cleanCache': cleanCache,
    };
  }
}

export default ServerlessPythonRequirements;
