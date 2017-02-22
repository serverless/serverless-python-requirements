'use strict';
// ripped from serverless and adapted for simpler use
// https://github.com/serverless/serverless/blob/b0df37673bd3a1fac11ccbfa3eb48e3626c0acb1/lib/plugins/package/lib/zipService.js

const archiver = require('archiver');
const BbPromise = require('bluebird');
const path = require('path');
const fs = require('fs');
const glob = require('glob-all');

module.exports = {
  zipDirectory(dirPath, artifactFilePath) {
    const patterns = ['**'];

    const zip = archiver.create('zip');

    const output = fs.createWriteStream(artifactFilePath);

    output.on('open', () => {
      zip.pipe(output);

      const files = glob.sync(patterns, {
        cwd: dirPath,
        dot: true,
        silent: true,
        follow: true,
      });

      files.forEach((filePath) => {
        const fullPath = path.resolve(
          dirPath,
          filePath
        );

        const stats = fs.statSync(fullPath);

        if (!stats.isDirectory(fullPath)) {
          zip.append(fs.createReadStream(fullPath), {
            name: filePath,
            mode: stats.mode,
          });
        }
      });

      zip.finalize();
    });

    return new BbPromise((resolve, reject) => {
      output.on('close', () => resolve(artifactFilePath));
      zip.on('error', (err) => reject(err));
    });
  },
};
