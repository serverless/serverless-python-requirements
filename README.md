# Serverless Python Requirements

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![CircleCI](https://circleci.com/gh/UnitedIncome/serverless-python-requirements.svg?style=shield)](https://circleci.com/gh/UnitedIncome/serverless-python-requirements)
[![appveyor](https://ci.appveyor.com/api/projects/status/biel93xc535nxvi2?svg=true)](https://ci.appveyor.com/project/dschep/serverless-python-requirements)
[![npm](https://img.shields.io/npm/v/serverless-python-requirements.svg)](https://www.npmjs.com/package/serverless-python-requirements)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)

A Serverless v1.x plugin to automatically bundle dependencies from
`requirements.txt` and make them available in your `PYTHONPATH`.

**Requires Serverless >= v1.12**

## Install

```
sls plugin install -n serverless-python-requirements
```

[:apple::beer::snake: Mac Brew installed Python notes](#applebeersnake-mac-brew-installed-python-notes)

## Cross compiling!
Compiling non-pure-Python modules or fetching their manylinux wheels is
supported on non-linux OSs via the use of Docker and the
[docker-lambda](https://github.com/lambci/docker-lambda) image.
To enable docker usage, add the following to your `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    dockerizePip: true
```
The dockerizePip option supports a special case in addition to booleans of `'non-linux'` which makes
it dockerize only on non-linux environments.


To utilize your own Docker container instead of the default, add the following to your `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    dockerImage: <image name>:tag
```
This must be the full image name and tag to use, including the runtime specific tag if applicable.

Alternatively, you can define your Docker image in your own Dockerfile and add the following to your `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    dockerFile: ./path/to/Dockerfile
```
With `Dockerfile` the path to the Dockerfile that must be in the current folder (or a subfolder).
Please note the `dockerImage` and the `dockerFile` are mutually exclusive.

To install requirements from private git repositories, add the following to your `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    dockerizePip: true
    dockerSsh: true
```
The `dockerSsh` option will mount your `$HOME/.ssh/id_rsa` and `$HOME/.ssh/known_hosts` as a
volume in the docker container. If your SSH key is password protected, you can use `ssh-agent`
because `$SSH_AUTH_SOCK` is also mounted & the env var set.
It is important that the host of your private repositories has already been added in your
`$HOME/.ssh/known_hosts` file, as the install process will fail otherwise due to host authenticity
failure.

[:checkered_flag: Windows notes](#checkered_flag-windows-dockerizepip-notes)

## Pipenv support :sparkles::cake::sparkles:
If you include a `Pipfile` and have `pipenv` installed instead of a `requirements.txt` this will use
`pipenv lock -r` to generate them. It is fully compatible with all options such as `zip` and
`dockerizePip`. If you don't want this plugin to generate it for you, set the following option:
```yaml
custom:
  pythonRequirements:
    usePipenv: false
```


## Dealing with Lambda's size limitations
To help deal with potentially large dependencies (for example: `numpy`, `scipy`
and `scikit-learn`) there is support for compressing the libraries. This does
require a minor change to your code to decompress them.  To enable this add the
following to your  `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    zip: true
```

and add this to your handler module before any code that imports your deps:
```python
try:
  import unzip_requirements
except ImportError:
  pass
```
### Slim Package
_Works on non 'win32' environments: Docker, WSL are included_  
To remove the tests, information and caches from the installed packages, 
enable the `slim` option. This will: `strip` the `.so` files, remove `__pycache__` 
directories and `dist-info` directories.  
```yaml
custom:
  pythonRequirements:
    slim: true
```  
#### Custom Removal Patterns  
To specify additional directories to remove from the installed packages, 
define the patterns using regex as a `slimPatterns` option in serverless config:  
```yaml
custom:
  pythonRequirements:
    slim: true
    slimPatterns:
      - "*.egg-info*"
```  
This will remove all folders within the installed requirements that match 
the names in `slimPatterns`  
## Omitting Packages 
You can omit a package from deployment with the `noDeploy` option. Note that
dependencies of omitted packages must explicitly be omitted too.
By default, this will not install the AWS SDKs that are already installed on
Lambda. This example makes it instead omit pytest:
```yaml
custom:
  pythonRequirements:
    noDeploy:
      - pytest
```

## Extra Config Options
### extra pip arguments
You can specify extra arguments to be passed to pip like this:
```yaml
custom:
  pythonRequirements:
      dockerizePip: true
      pipCmdExtraArgs:
          - --cache-dir
          - .requirements-cache
```

When using `--cache-dir` don't forget to also exclude it from the package.

```yaml
package:
  exclude:
    - .requirements-cache/**
```

### Customize requirements file name
[Some `pip` workflows involve using requirements files not named
`requirements.txt`](https://www.kennethreitz.org/essays/a-better-pip-workflow).
To support these, this plugin has the following option:

```yaml
custom:
  pythonRequirements:
    fileName: requirements-prod.txt
```

### Per-function requirements
If you have different python functions, with different sets of requirements, you can avoid
including all the unecessary dependencies of your functions by using the following structure:
```
├── serverless.yml
├── function1
│      ├── requirements.txt
│      └── index.py
└── function2
       ├── requirements.txt
       └── index.py
```
With the content of your `serverless.yml` containing:
```yml
package:
  individually: true

functions:
  func1:
    handler: index.handler
    module: function1
  func2:
    handler: index.handler
    module: function2
```
The result is 2 zip archives, with only the requirements for function1 in the first one, and only
the requirements for function2 in the second one.

Quick notes on the config file:
 * The `module` field must be used to tell the plugin where to find the `requirements.txt` file for
each function.
 * The `handler` field must not be prefixed by the folder name (already known through `module`) as
the root of the zip artifact is already the path to your function.

### Customize Python executable
Sometimes your Python executable isn't available on your `$PATH` as `python2.7`
or `python3.6` (for example, windows or using pyenv).
To support this, this plugin has the following option:
```yaml
custom:
  pythonRequirements:
    pythonBin: /opt/python3.6/bin/python
```

### Vendor library directory
For certain libraries, default packaging produces too large an installation,
even when zipping. In those cases it may be necessary to tailor make a version
of the module. In that case you can store them in a directory and use the
`vendor` option, and the plugin will copy them along with all the other
dependencies to install:
```yaml
custom:
  pythonRequirements:
    vendor: ./vendored-libraries
functions:
  hello:
    handler: hello.handler
    vendor: ./hello-vendor # The option is also available at the function level
```




## Manual invocations

The `.requirements` and `requirements.zip`(if using zip support) files are left
behind to speed things up on subsequent deploys. To clean them up, run
`sls requirements clean`. You can also create them (and `unzip_requirements` if
using zip support) manually with `sls requirements install`.

## Invalidate requirements caches on package

If you are using your own Python library, you have to cleanup
`.requirements` on any update. You can use the following option to cleanup
`.requirements` everytime you package.

```
custom:
  pythonRequirements:
    invalidateCaches: true
```

## :apple::beer::snake: Mac Brew installed Python notes
[Brew wilfully breaks the `--target` option with no seeming intention to fix it](https://github.com/Homebrew/brew/pull/821)
which causes issues since this uses that option. There are a few easy workarounds for this:
* Install Python from [python.org](https://www.python.org/downloads/) and specify it with the
[`pythonBin` option](#customize-python-executable).

OR

* Create a virtualenv and activate it while using serverless.

OR

* [Install Docker](https://docs.docker.com/docker-for-mac/install/) and use the [`dockerizePip` option](#cross-compiling).

Also, [brew seems to cause issues with pipenv](https://github.com/dschep/lambda-decorators/issues/4#event-1418928080),
so make sure you install pipenv using pip.

## :checkered_flag: Windows `dockerizePip` notes
For usage of `dockerizePip` on Windows do Step 1 only if running serverless on windows, or do both Step 1 & 2 if running serverless inside WSL.

1. [Enabling shared volume in Windows Docker Taskbar settings](https://forums.docker.com/t/docker-data-volumes-and-windows-mounts/31499/2)
1. [Installing the Docker client on Windows Subsystem for Linux (Ubuntu)](https://medium.com/@sebagomez/installing-the-docker-client-on-ubuntus-windows-subsystem-for-linux-612b392a44c4)


## Contributors
 * [@dschep](https://github.com/dschep) - Lead developer & maintainer
 * [@azurelogic](https://github.com/azurelogic) - logging & documentation fixes
 * [@abetomo](https://github.com/abetomo) - style & linting
 * [@angstwad](https://github.com/angstwad) - `deploy --function` support
 * [@mather](https://github.com/mather) - the cache invalidation option
 * [@rmax](https://github.com/rmax) - the extra pip args option
 * [@bsamuel-ui](https://github.com/bsamuel-ui) - Python 3 support
 * [@suxor42](https://github.com/suxor42) - fixing permission issues with Docker on Linux
 * [@mbeltran213](https://github.com/mbeltran213) - fixing docker linux -u option bug
 * [@Tethik](https://github.com/Tethik) - adding usePipenv option
 * [@miketheman](https://github.com/miketheman) - fixing bug with includes when using zip option
 * [@wattdave](https://github.com/wattdave) - fixing bug when using `deploymentBucket`
 * [@heri16](https://github.com/heri16) - fixing Docker support in Windows
 * [@ryansb](https://github.com/ryansb) - package individually support
 * [@cgrimal](https://github.com/cgrimal) - Private SSH Repo access in Docker, `dockerFile` option
  to build a custom docker image, real per-function requirements, and the
  `vendor` option
 * [@kichik](https://github.com/kichik) - Imposed windows & `noDeploy` support,
   switched to adding files straight to zip instead of creating symlinks, and
   improved pip chache support when using docker.
 * [@dee-me-tree-or-love](https://github.com/dee-me-tree-or-love) - the `slim` package option

