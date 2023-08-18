import AdmZip from 'adm-zip';
import ZipFile from 'adm-zip/zipFile.js';
import { mkdir, chmod, rm, cp, writeFile, stat } from 'fs/promises';
import { quote } from 'shell-quote';
import { join, dirname } from 'path';
import { exists, getUserCachePath, sha256Path } from './lib/shared.js';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import child from 'child_process';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execFile = promisify(child.execFile);

function randomString(length) {
  return randomBytes(length).toString('hex');
}

const mkCommand =
  (cmd, defaultArgs = []) =>
  async (args, options = {}) => {
    options['env'] = Object.assign(
      Object.assign({}, process.env),
      options['env']
    );
    try {
      const ps = await execFile(cmd, defaultArgs.concat(args), options);
      return {
        stdout: ps.stdout.toString().trim(),
        stderr: ps.stderr.toString().trim(),
      };
    } catch (e) {
      if (!options['noThrow']) {
        console.error(
          `Error running: ${quote([cmd, ...args])}\n${
            e.stdout
          }\n${e.toString()}`
        ); // eslint-disable-line no-console
        throw e;
      }
      return {
        stdout: e.stdout,
        stderr: e.stderr,
      };
    }
  };

const sls = mkCommand('sls');
const npm = mkCommand('npm');

let location;

beforeEach(async () => {
  location = join(__dirname, 'results', randomString(10));
  const opts = { recursive: true, force: true };
  await rm(location, opts);
  await rm(getUserCachePath(), opts);
  await mkdir(dirname(location), { recursive: true });
  await cp(join(__dirname, 'tests'), location, { recursive: true });
});

afterEach(async () => {
  const opts = { recursive: true, force: true };
  await rm(location, opts);
  await rm(getUserCachePath(), opts);
});

const availablePythons = async () => {
  const binaries = [];
  const mapping = {};
  if (process.env.USE_PYTHON) {
    binaries.push(
      ...process.env.USE_PYTHON.split(',').map((v) => v.toString().trim())
    );
  } else {
    // For running outside of CI
    binaries.push('python3');
  }
  const exe = process.platform === 'win32' ? '.exe' : '';
  for (const bin of binaries) {
    const python = `${bin}${exe}`;
    try {
      const ps = await execFile(python, [
        '-c',
        'import sys; sys.stdout.write(".".join(map(str, sys.version_info[:2])))',
      ]);
      const ver = ps.stdout && ps.stdout.toString().trim();
      if (ver) {
        for (const recommend of [ver, ver.split('.')[0]]) {
          if (!mapping[recommend]) {
            mapping[recommend] = python;
          }
        }
      }
    } catch (e) {
      continue;
    }
  }
  if (!Object.entries(mapping).length) {
    throw new Error('No pythons found');
  }
  return mapping;
};

const getPythonBin = async (version) => {
  const bin = (await availablePythons())[String(version)];
  if (!bin) throw new Error(`No python version ${version} available`);
  return bin;
};

const listZipFiles = function (filename) {
  var files = [];
  new AdmZip(filename).getEntries().forEach((entry) => {
    files.push(entry.entryName);
  });
  return files;
};

const listZipFilesWithMetaData = function (filename) {
  var files = {};
  new AdmZip(filename).getEntries().forEach((entry) => {
    files[entry.entryName] = entry;
  });
  return files;
};

const listRequirementsZipFiles = function (filename) {
  var files = [];
  const reqsEntry = new AdmZip(filename).getEntry('.requirements.zip');
  new ZipFile(reqsEntry.getData()).forEach((entry) => {
    files.push(entry.entryName);
  });
  return files;
};

const canUseDocker = async () => {
  try {
    await execFile('docker', ['ps']);
    return true;
  } catch (e) {
    return false;
  }
};

const testIf = (condition, ...args) =>
  condition ? test(...args) : test.skip(...args);

testIf(
  canUseDocker() && process.platform !== 'win32',
  'dockerPrivateKey option correctly resolves docker command',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    const output = (
      await sls(
        ['package'],
        Object.assign(execOpts, {
          noThrow: true,
          env: {
            SLS_LOG_DEBUG: '*',
            dockerizePip: true,
            dockerSsh: true,
            dockerPrivateKey: join(location, 'custom_ssh'),
            dockerImage: 'python:3.8',
          },
        })
      )
    ).stderr;
    expect(output).toEqual(
      expect.stringContaining(
        `-v\\=${join(location, 'custom_ssh')}\\:/root/.ssh/custom_ssh\\:z`
      )
    );
  }
);

testIf(
  true,
  'default pythonBin can package flask with default options',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(['package'], Object.assign(execOpts, { env: {} }));
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([
        join('flask', '__init__.py'),
        join('boto3', '__init__.py'),
      ])
    );
  }
);

testIf(true, 'py3.8 packages have the files list', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(['package'], Object.assign(execOpts, { env: {} }));
  const beforeZipFiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  await sls(['package'], Object.assign(execOpts, { env: {} }));
  expect(
    listZipFiles(join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip'))
  ).toEqual(beforeZipFiles);
});

testIf(true, 'py3.8 can package flask with default options', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, { env: { pythonBin: await getPythonBin(3) } })
  );
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining([
      join('flask', '__init__.py'),
      join('boto3', '__init__.py'),
    ])
  );
});

testIf(
  process.platform === 'win32',
  'py3.8 can package flask with hashes',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: {
          fileName: 'requirements-w-hashes.txt',
          pythonBin: await getPythonBin(3),
        },
      })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
  }
);

testIf(true, 'py3.8 can package flask with nested', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, {
      env: {
        fileName: 'requirements-w-nested.txt',
        pythonBin: await getPythonBin(3),
      },
    })
  );
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining([
      join('flask', '__init__.py'),
      join('boto3', '__init__.py'),
    ])
  );
});

testIf(true, 'py3.8 can package flask with zip option', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, {
      env: { zip: 'true', pythonBin: await getPythonBin(3) },
    })
  );
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining(['.requirements.zip', 'unzip_requirements.py'])
  );
  expect(zipfiles).toEqual(
    expect.not.arrayContaining([join('flask', '__init__.py')])
  );
});

testIf(true, 'py3.8 can package flask with slim option', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, {
      env: { slim: 'true', pythonBin: await getPythonBin(3) },
    })
  );
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining([join('flask', '__init__.py')])
  );
  expect(zipfiles.filter((filename) => filename.endsWith('.pyc'))).toHaveLength(
    0
  );
  expect(
    zipfiles.filter((filename) => filename.endsWith('__main__.py')).length > 0
  ).toBe(true);
});

testIf(
  true,
  'py3.8 can package flask with slim & slimPatterns options',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: { slimPatterns: 'default', slim: 'true' },
      })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
    expect(
      zipfiles.filter((filename) => filename.endsWith('.pyc'))
    ).toHaveLength(0);
    expect(
      zipfiles.filter((filename) => filename.endsWith('__main__.py'))
    ).toHaveLength(0);
  }
);

testIf(true, 'py3.8 doesnt package bottle with noDeploy option', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, {
      env: { noDeploy: 'bottle', pythonBin: await getPythonBin(3) },
    })
  );
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(expect.not.arrayContaining(['bottle.py']));
  expect(zipfiles).toEqual(
    expect.arrayContaining([join('flask', '__init__.py')])
  );
});

testIf(true, 'py3.8 can package boto3 with editable', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, {
      env: {
        fileName: 'requirements-w-editable.txt',
        pythonBin: await getPythonBin(3),
      },
    })
  );
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining([
      join('boto3', '__init__.py'),
      join('botocore', '__init__.py'),
    ])
  );
});

testIf(
  canUseDocker() && process.platform !== 'win32',
  'py3.8 can package flask with dockerizePip option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { dockerizePip: 'true' } })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([
        join('flask', '__init__.py'),
        join('boto3', '__init__.py'),
      ])
    );
  }
);

testIf(
  canUseDocker() && process.platform !== 'win32',
  'py3.8 can package flask with slim & dockerizePip option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { dockerizePip: 'true', slim: 'true' } })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
    expect(
      zipfiles.filter((filename) => filename.endsWith('.pyc'))
    ).toHaveLength(0);
    expect(
      zipfiles.filter((filename) => filename.endsWith('__main__.py')).length > 0
    ).toBe(true);
  }
);

testIf(
  canUseDocker() && process.platform !== 'win32',
  'py3.8 can package flask with slim & dockerizePip & slimPatterns options',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: { dockerizePip: 'true', slim: 'true', slimPatterns: 'default' },
      })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
    expect(
      zipfiles.filter((filename) => filename.endsWith('.pyc'))
    ).toHaveLength(0);
    expect(
      zipfiles.filter((filename) => filename.endsWith('__main__.py'))
    ).toHaveLength(0);
  }
);

testIf(
  canUseDocker() && process.platform !== 'win32',
  'py3.8 can package flask with zip & dockerizePip option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { dockerizePip: 'true', zip: 'true' } })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    const zippedReqs = listRequirementsZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining(['.requirements.zip', 'unzip_requirements.py'])
    );
    expect(zipfiles).toEqual(
      expect.not.arrayContaining([join('flask', '__init__.py')])
    );
    expect(zippedReqs).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
  }
);

testIf(
  canUseDocker() && process.platform !== 'win32',
  'py3.8 can package flask with zip & slim & dockerizePip option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: { dockerizePip: 'true', zip: 'true', slim: 'true' },
      })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    const zippedReqs = listRequirementsZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining(['.requirements.zip', 'unzip_requirements.py'])
    );
    expect(zipfiles).toEqual(
      expect.not.arrayContaining([join('flask', '__init__.py')])
    );
    expect(zippedReqs).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
  }
);

testIf(
  true,
  'pipenv py3.8 can package flask with default options',
  async () => {
    const execOpts = { cwd: join(location, 'pipenv') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(['package'], Object.assign(execOpts, { env: {} }));
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([
        join('flask', '__init__.py'),
        join('boto3', '__init__.py'),
      ])
    );
    expect(zipfiles).toEqual(
      expect.not.arrayContaining([join('pytest', '__init__.py')])
    );
  }
);

testIf(true, 'pipenv py3.8 can package flask with slim option', async () => {
  const execOpts = { cwd: join(location, 'pipenv') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(['package'], Object.assign(execOpts, { env: { slim: 'true' } }));
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining([join('flask', '__init__.py')])
  );
  expect(zipfiles.filter((filename) => filename.endsWith('.pyc'))).toHaveLength(
    0
  );
  expect(
    zipfiles.filter((filename) => filename.endsWith('__main__.py')).length > 0
  ).toBe(true);
});

testIf(
  true,
  'pipenv py3.8 can package flask with slim & slimPatterns options',
  async () => {
    const execOpts = { cwd: join(location, 'pipenv') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: { slimPatterns: 'default', slim: 'true' },
      })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
    expect(
      zipfiles.filter((filename) => filename.endsWith('.pyc'))
    ).toHaveLength(0);
    expect(
      zipfiles.filter((filename) => filename.endsWith('__main__.py'))
    ).toHaveLength(0);
  }
);

testIf(true, 'pipenv py3.8 can package flask with zip option', async () => {
  const execOpts = { cwd: join(location, 'pipenv') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, {
      env: { zip: 'true', pythonBin: await getPythonBin(3) },
    })
  );
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining(['.requirements.zip', 'unzip_requirements.py'])
  );
  expect(zipfiles).toEqual(
    expect.not.arrayContaining([join('flask', '__init__.py')])
  );
});

testIf(
  true,
  'pipenv py3.8 doesnt package bottle with noDeploy option',
  async () => {
    const execOpts = { cwd: join(location, 'pipenv') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { noDeploy: 'bottle' } })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
    expect(zipfiles).toEqual(expect.not.arrayContaining(['bottle.py']));
  }
);

testIf(true, 'non build pyproject.toml uses requirements.txt', async () => {
  const execOpts = { cwd: join(location, 'non_build_pyproject') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(['package'], Object.assign(execOpts, { env: {} }));
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining([
      join('flask', '__init__.py'),
      join('boto3', '__init__.py'),
    ])
  );
});

testIf(
  true,
  'non poetry pyproject.toml without requirements.txt packages handler only',
  async () => {
    const execOpts = { cwd: join(location, 'poetry') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(['package'], Object.assign(execOpts, { env: {} }));
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(expect.arrayContaining(['handler.py']));
  }
);

testIf(
  true,
  'poetry py3.8 can package flask with default options',
  async () => {
    const execOpts = { cwd: join(location, 'poetry') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(['package'], Object.assign(execOpts, { env: {} }));
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([
        join('flask', '__init__.py'),
        join('boto3', '__init__.py'),
        'bottle.py',
      ])
    );
  }
);

testIf(true, 'poetry py3.8 can package flask with slim option', async () => {
  const execOpts = { cwd: join(location, 'poetry') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(['package'], Object.assign(execOpts, { env: { slim: 'true' } }));
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining([join('flask', '__init__.py')])
  );
  expect(zipfiles.filter((filename) => filename.endsWith('.pyc'))).toHaveLength(
    0
  );
  expect(
    zipfiles.filter((filename) => filename.endsWith('__main__.py')).length > 0
  ).toBe(true);
});

testIf(
  true,
  'poetry py3.8 can package flask with slim & slimPatterns options',
  async () => {
    const execOpts = { cwd: join(location, 'poetry') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: { slimPatterns: 'default', slim: 'true' },
      })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
    expect(
      zipfiles.filter((filename) => filename.endsWith('.pyc'))
    ).toHaveLength(0);
    expect(
      zipfiles.filter((filename) => filename.endsWith('__main__.py'))
    ).toHaveLength(0);
  }
);

testIf(true, 'poetry py3.8 can package flask with zip option', async () => {
  const execOpts = { cwd: join(location, 'poetry') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, {
      env: { zip: 'true', pythonBin: await getPythonBin(3) },
    })
  );
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining(['.requirements.zip', 'unzip_requirements.py'])
  );
  expect(zipfiles).toEqual(
    expect.not.arrayContaining([join('flask', '__init__.py')])
  );
});

testIf(
  true,
  'poetry py3.8 doesnt package bottle with noDeploy option',
  async () => {
    const execOpts = { cwd: join(location, 'poetry') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { noDeploy: 'bottle' } })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
    expect(zipfiles).toEqual(expect.not.arrayContaining(['bottle.py']));
  }
);

testIf(
  true,
  'py3.8 can package flask with zip option and no explicit include',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { patterns: 'implicit', zip: 'true' } })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining(['.requirements.zip', 'unzip_requirements.py'])
    );
    expect(zipfiles).toEqual(
      expect.not.arrayContaining([join('flask', '__init__.py')])
    );
  }
);

testIf(
  true,
  'py3.8 can package lambda-decorators using vendor option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { vendor: './vendor' } })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([
        join('flask', '__init__.py'),
        join('boto3', '__init__.py'),
        `lambda_decorators.py`,
      ])
    );
  }
);

testIf(process.platform === 'win32', 'Dont nuke execute perms', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  const perm = 0o755;
  await writeFile(`foobar`, '');
  await chmod(`foobar`, perm);
  await sls(
    ['package'],
    Object.assign(execOpts, { env: { vendor: './vendor', patterns: 'foobar' } })
  );
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining([
      join('flask', '__init__.py'),
      join('boto3', '__init__.py'),
      'lambda_decorators.py',
      'foobar',
    ])
  );

  const zipfiles_with_metadata = listZipFilesWithMetaData(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect((zipfiles_with_metadata['foobar'].attr >>> 16) ^ 0x8000).toBe(perm);

  const flaskPerm = (
    await stat(
      join(execOpts.cwd, '.serverless', 'requirements', 'bin', 'flask')
    )
  ).mode;
  expect(zipfiles_with_metadata[join('bin', 'flask')].attr >>> 16).toBe(
    flaskPerm
  );
});

testIf(
  true,
  'py3.8 can package flask in a project with a space in it',
  async () => {
    const execOpts = { cwd: join(location, 'base with a space') };
    await cp(join(location, 'base'), join(execOpts.cwd), { recursive: true });
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(['package'], Object.assign(execOpts, { env: {} }));
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([
        join('flask', '__init__.py'),
        join('boto3', '__init__.py'),
      ])
    );
  }
);

testIf(
  canUseDocker() && process.platform !== 'win32',
  'py3.8 can package flask in a project with a space in it with docker',
  async () => {
    const execOpts = { cwd: join(location, 'base with a space') };
    await cp(join(location, 'base'), join(execOpts.cwd), { recursive: true });
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { dockerizePip: 'true' } })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([
        join('flask', '__init__.py'),
        join('boto3', '__init__.py'),
      ])
    );
  }
);

testIf(
  true,
  'py3.8 supports custom file name with fileName option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await writeFile(join(execOpts.cwd, 'puck'), 'requests');
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { fileName: 'puck' } })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('requests', '__init__.py')])
    );
    expect(zipfiles.includes(join('flask', '__init__.py'))).toBe(false);
    expect(zipfiles.includes(join('boto3', '__init__.py'))).toBe(false);
  }
);

testIf(true, 'py3.8 doesnt package bottle with zip option', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, {
      env: {
        noDeploy: 'bottle',
        zip: 'true',
        pythonBin: await getPythonBin(3),
      },
    })
  );
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  const zippedReqs = listRequirementsZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining(['.requirements.zip', 'unzip_requirements.py'])
  );
  expect(zippedReqs).toEqual(
    expect.arrayContaining([join('flask', '__init__.py')])
  );
  expect(zipfiles.includes(join('flask', '__init__.py'))).toBe(false);
  expect(zippedReqs.includes(`bottle.py`)).toBe(false);
});

testIf(
  true,
  'py3.8 can package flask with slim, slimPatterns & slimPatternsAppendDefaults=false options',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: {
          slimPatterns: 'default',
          slim: 'true',
          slimPatternsAppendDefaults: 'false',
        },
      })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
    expect(
      zipfiles.filter((filename) => filename.endsWith('.pyc')).length >= 1
    ).toBe(true);
    expect(
      zipfiles.filter((filename) => filename.endsWith('__main__.py'))
    ).toHaveLength(0);
  }
);

testIf(
  canUseDocker() && process.platform !== 'win32',
  'py3.8 can package flask with slim & dockerizePip & slimPatterns & slimPatternsAppendDefaults=false options',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: {
          dockerizePip: 'true',
          slim: 'true',
          slimPatterns: 'default',
          slimPatternsAppendDefaults: 'false',
        },
      })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
    expect(
      zipfiles.filter((filename) => filename.endsWith('.pyc')).length >= 1
    ).toBe(true);
    expect(
      zipfiles.filter((filename) => filename.endsWith('__main__.py'))
    ).toHaveLength(0);
  }
);

testIf(
  true,
  'pipenv py3.8 can package flask with slim & slimPatterns & slimPatternsAppendDefaults=false  option',
  async () => {
    const execOpts = { cwd: join(location, 'pipenv') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: {
          slimPatterns: 'default',
          slim: 'true',
          slimPatternsAppendDefaults: 'false',
        },
      })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
    expect(
      zipfiles.filter((filename) => filename.endsWith('.pyc')).length >= 1
    ).toBe(true);
    expect(
      zipfiles.filter((filename) => filename.endsWith('__main__.py'))
    ).toHaveLength(0);
  }
);

testIf(
  true,
  'poetry py3.8 can package flask with slim & slimPatterns & slimPatternsAppendDefaults=false option',
  async () => {
    const execOpts = { cwd: join(location, 'poetry') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: {
          slimPatterns: 'default',
          slim: 'true',
          slimPatternsAppendDefaults: 'false',
        },
      })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
    expect(
      zipfiles.filter((filename) => filename.endsWith('.pyc')).length >= 1
    ).toBe(true);
    expect(
      zipfiles.filter((filename) => filename.endsWith('__main__.py'))
    ).toHaveLength(0);
  }
);

testIf(
  true,
  'poetry py3.8 can package flask with package individually option',
  async () => {
    const execOpts = { cwd: join(location, 'poetry_individually') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);

    await sls(['package'], Object.assign(execOpts, { env: {} }));
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'module1-sls-py-req-test-dev-hello.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([
        join('flask', '__init__.py'),
        join('boto3', '__init__.py'),
        'bottle.py',
      ])
    );
  }
);

testIf(
  true,
  'py3.8 can package flask with package individually option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { individually: 'true' } })
    );
    const zipfiles_hello = listZipFiles(
      join(execOpts.cwd, '.serverless', 'hello.zip')
    );
    expect(zipfiles_hello).toEqual(
      expect.arrayContaining(['handler.py', join('flask', '__init__.py')])
    );
    expect(zipfiles_hello.includes(join('fn2', '__init__.py'))).toBe(false);
    expect(zipfiles_hello.includes(`dataclasses.py`)).toBe(false);

    const zipfiles_hello2 = listZipFiles(
      join(execOpts.cwd, '.serverless', 'hello2.zip')
    );
    expect(zipfiles_hello2).toEqual(
      expect.arrayContaining(['handler.py', join('flask', '__init__.py')])
    );
    expect(zipfiles_hello2.includes(join('fn2', '__init__.py'))).toBe(false);
    expect(zipfiles_hello2.includes(`dataclasses.py`)).toBe(false);

    const zipfiles_hello3 = listZipFiles(
      join(execOpts.cwd, '.serverless', 'hello3.zip')
    );
    expect(zipfiles_hello3).toEqual(expect.arrayContaining(['handler.py']));
    expect(zipfiles_hello3.includes(join('fn2', '__init__.py'))).toBe(false);
    expect(zipfiles_hello3.includes(`dataclasses.py`)).toBe(false);
    expect(zipfiles_hello3.includes(join('flask', '__init__.py'))).toBe(false);

    const zipfiles_hello4 = listZipFiles(
      join(execOpts.cwd, '.serverless', 'fn2-sls-py-req-test-dev-hello4.zip')
    );
    expect(zipfiles_hello4).toEqual(
      expect.arrayContaining(['fn2_handler.py', 'dataclasses.py'])
    );
    expect(zipfiles_hello4.includes(join('fn2', '__init__.py'))).toBe(false);
    expect(zipfiles_hello4.includes(join('flask', '__init__.py'))).toBe(false);
  }
);

testIf(
  true,
  'py3.8 can package flask with package individually & slim option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { individually: 'true', slim: 'true' } })
    );
    const zipfiles_hello = listZipFiles(
      join(execOpts.cwd, '.serverless', 'hello.zip')
    );
    expect(zipfiles_hello).toEqual(
      expect.arrayContaining(['handler.py', join('flask', '__init__.py')])
    );
    expect(
      zipfiles_hello.filter((filename) => filename.endsWith('.pyc'))
    ).toHaveLength(0);
    expect(zipfiles_hello.includes(`dataclasses.py`)).toBe(false);

    const zipfiles_hello2 = listZipFiles(
      join(execOpts.cwd, '.serverless', 'hello2.zip')
    );
    expect(zipfiles_hello).toEqual(
      expect.arrayContaining(['handler.py', join('flask', '__init__.py')])
    );
    expect(
      zipfiles_hello2.filter((filename) => filename.endsWith('.pyc'))
    ).toHaveLength(0);
    expect(zipfiles_hello2.includes(`dataclasses.py`)).toBe(false);

    const zipfiles_hello3 = listZipFiles(
      join(execOpts.cwd, '.serverless', 'hello3.zip')
    );
    expect(zipfiles_hello3).toEqual(expect.arrayContaining(['handler.py']));
    expect(
      zipfiles_hello3.filter((filename) => filename.endsWith('.pyc'))
    ).toHaveLength(0);
    expect(zipfiles_hello3.includes(join('flask', '__init__.py'))).toBe(false);

    const zipfiles_hello4 = listZipFiles(
      join(execOpts.cwd, '.serverless', 'fn2-sls-py-req-test-dev-hello4.zip')
    );
    expect(zipfiles_hello4).toEqual(
      expect.arrayContaining(['fn2_handler.py', 'dataclasses.py'])
    );
    expect(zipfiles_hello4.includes(join('flask', '__init__.py'))).toBe(false);
    expect(
      zipfiles_hello4.filter((filename) => filename.endsWith('.pyc'))
    ).toHaveLength(0);
  }
);

testIf(true, 'py3.8 can package only requirements of module', async () => {
  const execOpts = { cwd: join(location, 'individually') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(['package'], Object.assign(execOpts, { env: {} }));
  const zipfiles_hello = listZipFiles(
    join(
      execOpts.cwd,
      '.serverless',
      'module1-sls-py-req-test-indiv-dev-hello1.zip'
    )
  );
  expect(zipfiles_hello).toEqual(
    expect.arrayContaining([
      'handler1.py',
      join('pyaml', '__init__.py'),
      join('boto3', '__init__.py'),
    ])
  );
  expect(zipfiles_hello.includes('handler2.py')).toBe(false);
  expect(zipfiles_hello.includes(join('flask', '__init__.py'))).toBe(false);

  const zipfiles_hello2 = listZipFiles(
    join(
      execOpts.cwd,
      '.serverless',
      'module2-sls-py-req-test-indiv-dev-hello2.zip'
    )
  );
  expect(zipfiles_hello2).toEqual(
    expect.arrayContaining(['handler2.py', join('flask', '__init__.py')])
  );
  expect(zipfiles_hello2.includes('handler1.py')).toBe(false);
  expect(zipfiles_hello2.includes(join('pyaml', '__init__.py'))).toBe(false);
  expect(zipfiles_hello2.includes(join('boto3', '__init__.py'))).toBe(false);
});

testIf(
  true,
  'py3.8 can package lambda-decorators using vendor and invidiually option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: { individually: 'true', vendor: './vendor' },
      })
    );
    const zipfiles_hello = listZipFiles(
      join(execOpts.cwd, '.serverless', 'hello.zip')
    );
    expect(zipfiles_hello).toEqual(
      expect.arrayContaining([
        'handler.py',
        join('flask', '__init__.py'),
        'lambda_decorators.py',
      ])
    );
    expect(zipfiles_hello.includes(`dataclasses.py`)).toBe(false);

    const zipfiles_hello2 = listZipFiles(
      join(execOpts.cwd, '.serverless', 'hello2.zip')
    );
    expect(zipfiles_hello2).toEqual(
      expect.arrayContaining([
        'handler.py',
        join('flask', '__init__.py'),
        'lambda_decorators.py',
      ])
    );
    expect(zipfiles_hello2.includes(`dataclasses.py`)).toBe(false);

    const zipfiles_hello3 = listZipFiles(
      join(execOpts.cwd, '.serverless', 'hello3.zip')
    );
    expect(zipfiles_hello3).toEqual(expect.arrayContaining(['handler.py']));
    expect(zipfiles_hello3.includes(join('flask', '__init__.py'))).toBe(false);
    expect(zipfiles_hello3.includes(`lambda_decorators.py`)).toBe(false);
    expect(zipfiles_hello3.includes(`dataclasses.py`)).toBe(false);

    const zipfiles_hello4 = listZipFiles(
      join(execOpts.cwd, '.serverless', 'fn2-sls-py-req-test-dev-hello4.zip')
    );
    expect(zipfiles_hello4).toEqual(
      expect.arrayContaining(['fn2_handler.py', 'dataclasses.py'])
    );
    expect(zipfiles_hello4.includes(join('flask', '__init__.py'))).toBe(false);
  }
);

testIf(
  process.platform === 'win32',
  'Dont nuke execute perms when using individually',
  async () => {
    const execOpts = { cwd: join(location, 'individually') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    const perm = 0o755;
    await writeFile(join(execOpts.cwd, 'module1', 'foobar'), '');
    await chmod(join(execOpts.cwd, 'module1', 'foobar'), perm);
    await sls(['package'], Object.assign(execOpts, { env: {} }));
    const zipfiles_hello1 = listZipFilesWithMetaData(
      join(execOpts.cwd, '.serverless', 'hello1.zip')
    );

    expect(
      (zipfiles_hello1[join('module1', 'foobar')].attr >>> 16) ^ 0x8000
    ).toBe(perm);

    const zipfiles_hello2 = listZipFilesWithMetaData(
      join(
        execOpts.cwd,
        '.serverless',
        'module2-sls-py-req-test-indiv-dev-hello2.zip'
      )
    );
    const flaskPerm = (
      await stat(
        join(
          execOpts.cwd,
          '.serverless',
          'module2',
          'requirements',
          'bin',
          'flask'
        )
      )
    ).mode;

    expect(zipfiles_hello2[join('bin', 'flask')].attr >>> 16).toBe(flaskPerm);
  }
);

testIf(
  canUseDocker() && process.platform !== 'win32',
  'Dont nuke execute perms when using individually w/docker',
  async () => {
    const execOpts = { cwd: join(location, 'individually') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    const perm = 0o755;
    await writeFile(join(execOpts.cwd, 'module1', 'foobar'), '', {
      mode: perm,
    });
    await chmod(join(execOpts.cwd, 'module1', 'foobar'), perm);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { dockerizePip: 'true' } })
    );
    const zipfiles_hello = listZipFilesWithMetaData(
      join(execOpts.cwd, '.serverless', 'hello1.zip')
    );

    expect(
      (zipfiles_hello[join('module1', 'foobar')].attr >>> 16) ^ 0x8000
    ).toBe(perm);

    const zipfiles_hello2 = listZipFilesWithMetaData(
      join(
        execOpts.cwd,
        '.serverless',
        'module2-sls-py-req-test-indiv-dev-hello2.zip'
      )
    );
    const flaskPerm = (
      await stat(
        join(
          execOpts.cwd,
          '.serverless',
          'module2',
          'requirements',
          'bin',
          'flask'
        )
      )
    ).mode;

    expect(zipfiles_hello2[join('bin', 'flask')].attr >>> 16).toBe(flaskPerm);
  }
);

testIf(true, 'py3.8 uses download cache by default option', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(['package'], Object.assign(execOpts, { env: {} }));
  const cachepath = getUserCachePath();
  expect(await exists(join(cachepath, 'downloadCacheslspyc', 'http'))).toBe(
    true
  );
});

testIf(true, 'py3.8 uses download cache by default', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, { env: { cacheLocation: '.requirements-cache' } })
  );
  expect(
    await exists(
      join(execOpts.cwd, '.requirements-cache', 'downloadCacheslspyc', 'http')
    )
  ).toBe(true);
});

testIf(
  canUseDocker() && process.platform !== 'win32',
  'py3.8 uses download cache with dockerizePip option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { dockerizePip: 'true' } })
    );
    const cachepath = getUserCachePath();
    expect(await exists(join(cachepath, 'downloadCacheslspyc', 'http'))).toBe(
      true
    );
  }
);

testIf(
  canUseDocker() && process.platform !== 'win32',
  'py3.8 uses download cache with dockerizePip by default option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: { dockerizePip: 'true', cacheLocation: '.requirements-cache' },
      })
    );
    expect(
      await exists(
        join(execOpts.cwd, '.requirements-cache', 'downloadCacheslspyc', 'http')
      )
    ).toBe(true);
  }
);

testIf(true, 'py3.8 uses static and download cache', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(['package'], Object.assign(execOpts, { env: {} }));
  const cachepath = getUserCachePath();
  const cacheFolderHash = await sha256Path(
    join(execOpts.cwd, '.serverless', 'requirements.txt')
  );
  const arch = 'x86_64';
  expect(await exists(join(cachepath, 'downloadCacheslspyc', 'http'))).toBe(
    true
  );
  expect(
    await exists(join(cachepath, `${cacheFolderHash}_${arch}_slspyc`, 'flask'))
  ).toBe(true);
});

testIf(
  canUseDocker() && process.platform !== 'win32',
  'py3.8 uses static and download cache with dockerizePip option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { dockerizePip: 'true' } })
    );
    const cachepath = getUserCachePath();
    const cacheFolderHash = await sha256Path(
      join(execOpts.cwd, '.serverless', 'requirements.txt')
    );
    const arch = 'x86_64';
    expect(await exists(join(cachepath, 'downloadCacheslspyc', 'http'))).toBe(
      true
    );
    expect(
      await exists(
        join(cachepath, `${cacheFolderHash}_${arch}_slspyc`, 'flask')
      )
    ).toBe(true);
  }
);

testIf(true, 'py3.8 uses static cache', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(['package'], Object.assign(execOpts, { env: {} }));
  const cachepath = getUserCachePath();
  const cacheFolderHash = await sha256Path(
    join(execOpts.cwd, '.serverless', 'requirements.txt')
  );
  const arch = 'x86_64';
  expect(
    await exists(join(cachepath, `${cacheFolderHash}_${arch}_slspyc`, 'flask'))
  ).toBe(true);
  expect(
    await exists(
      join(
        cachepath,
        `${cacheFolderHash}_${arch}_slspyc`,
        '.completed_requirements'
      )
    )
  ).toBe(true);

  // py3.8 checking that static cache actually pulls from cache (by poisoning it)
  await writeFile(
    join(
      cachepath,
      `${cacheFolderHash}_${arch}_slspyc`,
      'injected_file_is_bad_form'
    ),
    'injected new file into static cache folder'
  );
  await sls(['package'], Object.assign(execOpts, { env: {} }));
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining(['injected_file_is_bad_form'])
  );
});

testIf(true, 'py3.8 uses static cache with cacheLocation option', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  const cachepath = join(execOpts.cwd, '.requirements-cache');
  await sls(
    ['package'],
    Object.assign(execOpts, { env: { cacheLocation: cachepath } })
  );
  const cacheFolderHash = await sha256Path(
    join(execOpts.cwd, '.serverless', 'requirements.txt')
  );
  const arch = 'x86_64';
  expect(
    await exists(join(cachepath, `${cacheFolderHash}_${arch}_slspyc`, 'flask'))
  ).toBe(true);
  expect(
    await exists(
      join(
        cachepath,
        `${cacheFolderHash}_${arch}_slspyc`,
        '.completed_requirements'
      )
    )
  ).toBe(true);
});

testIf(
  canUseDocker() && process.platform !== 'win32',
  'py3.8 uses static cache with dockerizePip & slim option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { dockerizePip: 'true', slim: 'true' } })
    );
    const cachepath = getUserCachePath();
    const cacheFolderHash = await sha256Path(
      join(execOpts.cwd, '.serverless', 'requirements.txt')
    );
    const arch = 'x86_64';
    expect(
      await exists(
        join(cachepath, `${cacheFolderHash}_${arch}_slspyc`, 'flask')
      )
    ).toBe(true);
    expect(
      await exists(
        join(
          cachepath,
          `${cacheFolderHash}_${arch}_slspyc`,
          '.completed_requirements'
        )
      )
    ).toBe(true);

    // py3.8 checking that static cache actually pulls from cache (by poisoning it)
    await writeFile(
      join(
        cachepath,
        `${cacheFolderHash}_${arch}_slspyc`,
        'injected_file_is_bad_form'
      ),
      'injected new file into static cache folder'
    );
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { dockerizePip: 'true', slim: 'true' } })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining(['injected_file_is_bad_form'])
    );
    expect(
      zipfiles.filter((filename) => filename.endsWith('.pyc'))
    ).toHaveLength(0);
  }
);

testIf(
  canUseDocker() && process.platform !== 'win32',
  'py3.8 uses download cache with dockerizePip & slim option',
  async () => {
    const execOpts = { cwd: join(location, 'base') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, { env: { dockerizePip: 'true', slim: 'true' } })
    );
    const cachepath = getUserCachePath();
    expect(await exists(join(cachepath, 'downloadCacheslspyc', 'http'))).toBe(
      true
    );

    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('flask', '__init__.py')])
    );
    expect(
      zipfiles.filter((filename) => filename.endsWith('.pyc'))
    ).toHaveLength(0);
  }
);

testIf(true, 'py3.8 can ignore functions defined with `image`', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, { env: { individually: 'true' } })
  );
  expect(await exists(join(execOpts.cwd, '.serverless', 'hello.zip'))).toBe(
    true
  );
  expect(await exists(join(execOpts.cwd, '.serverless', 'hello2.zip'))).toBe(
    true
  );
  expect(await exists(join(execOpts.cwd, '.serverless', 'hello3.zip'))).toBe(
    true
  );
  expect(await exists(join(execOpts.cwd, '.serverless', 'hello4.zip'))).toBe(
    true
  );
  expect(await exists(join(execOpts.cwd, '.serverless', 'hello5.zip'))).toBe(
    false
  );
});

testIf(
  true,
  'poetry py3.8 fails packaging if poetry.lock is missing and flag requirePoetryLockFile is set to true',
  async () => {
    const execOpts = { cwd: join(location, 'base with a space') };
    await cp(join(location, 'poetry'), execOpts.cwd, { recursive: true });
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await rm(join(execOpts.cwd, 'poetry.lock'), {
      recursive: true,
      force: true,
    });
    const output = (
      await sls(
        ['package'],
        Object.assign(execOpts, {
          env: { requirePoetryLockFile: 'true', slim: 'true' },
          noThrow: true,
        })
      )
    ).stdout;
    expect(output).toEqual(
      expect.stringContaining(
        'poetry.lock file not found - set requirePoetryLockFile to false to disable this error'
      )
    );
  }
);

testIf(true, 'poetry py3.8 packages additional optional packages', async () => {
  const execOpts = { cwd: join(location, 'poetry_packages') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, {
      env: {
        poetryWithGroups: 'poetryWithGroups',
      },
    })
  );
  const zipfiles = listZipFiles(
    join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
  );
  expect(zipfiles).toEqual(
    expect.arrayContaining([
      join('boto3', '__init__.py'),
      join('flask', '__init__.py'),
      'bottle.py',
    ])
  );
});

testIf(true, 'works with provider.runtime not being python', async () => {
  const execOpts = { cwd: join(location, 'base') };
  const path = (await npm(['pack', '../../..'], execOpts)).stdout;
  await npm(['i', path], execOpts);
  await sls(
    ['package'],
    Object.assign(execOpts, {
      env: { runtime: 'nodejs18.x', pythonBin: await getPythonBin(3) },
    })
  );
  expect(
    await exists(join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip'))
  ).toBe(true);
});

testIf(
  true,
  'poetry py3.8 skips additional optional packages specified in withoutGroups',
  async () => {
    const execOpts = { cwd: join(location, 'poetry_packages') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: {
          poetryWithGroups: 'poetryWithGroups',
          poetryWithoutGroups: 'poetryWithoutGroups',
        },
      })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles).toEqual(
      expect.arrayContaining([
        join('boto3', '__init__.py'),
        join('flask', '__init__.py'),
      ])
    );
    expect(zipfiles.includes(`bottle.py`)).toBe(false);
  }
);

testIf(
  true,
  'poetry py3.8 only installs optional packages specified in onlyGroups',
  async () => {
    const execOpts = { cwd: join(location, 'poetry_packages') };
    const path = (await npm(['pack', '../../..'], execOpts)).stdout;
    await npm(['i', path], execOpts);
    await sls(
      ['package'],
      Object.assign(execOpts, {
        env: {
          poetryOnlyGroups: 'poetryOnlyGroups',
        },
      })
    );
    const zipfiles = listZipFiles(
      join(execOpts.cwd, '.serverless', 'sls-py-req-test.zip')
    );
    expect(zipfiles.includes(join('flask', '__init__.py'))).toBe(false);
    expect(zipfiles.includes(`bottle.py`)).toBe(false);
    expect(zipfiles).toEqual(
      expect.arrayContaining([join('boto3', '__init__.py')])
    );
  }
);
