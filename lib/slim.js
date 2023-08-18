import isWsl from 'is-wsl';
import fg from 'fast-glob';
import { rm } from 'fs/promises';

const getStripMode = (options) => {
  if (
    options.strip === false ||
    options.strip === 'false' ||
    options.slim === false ||
    options.slim === 'false'
  ) {
    return 'skip';
  } else if (options.dockerizePip) {
    return 'docker';
  } else if (
    (!isWsl && process.platform === 'win32') ||
    process.platform === 'darwin'
  ) {
    return 'skip';
  } else {
    return 'direct';
  }
};

const getStripCommand = (options, folderPath) => [
  'find',
  folderPath,
  '-name',
  '*.so',
  '-exec',
  'strip',
  '{}',
  ';',
];

const deleteFiles = async (options, folderPath) => {
  let patterns = ['**/*.py[c|o]', '**/__pycache__*', '**/*.dist-info*'];
  if (
    options.slimPatterns &&
    Array.isArray(options.slimPatterns) &&
    options.slimPatterns.length
  ) {
    if (
      options.slimPatternsAppendDefaults === false ||
      options.slimPatternsAppendDefaults == 'false'
    ) {
      patterns = options.slimPatterns;
    } else {
      patterns = patterns.concat(options.slimPatterns);
    }
  }
  for (const pattern of patterns) {
    for await (const file of fg.globStream(`${folderPath}/${pattern}`, {
      dot: true,
    })) {
      await rm(file);
    }
  }
};

export { getStripMode, getStripCommand, deleteFiles };
