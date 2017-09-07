# Serverless Python Requirements

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![circleci](https://img.shields.io/circleci/project/github/RedSparr0w/node-csgo-parser/master.svg)](https://circleci.com/gh/UnitedIncome/serverless-python-requirements)
[![npm](https://nodei.co/npm/serverless-python-requirements.png?mini=true)](https://www.npmjs.com/package/serverless-python-requirements)

A Serverless v1.x plugin to automatically bundle dependencies from
`requirements.txt` and make them available in your `PYTHONPATH`.

**Requires Serverless >= v1.12**

**NOTE:** This the documentation of the v3 beta. For stable 2.5.0 docs see the
[2.5.0 docs](https://github.com/UnitedIncome/serverless-python-requirements/tree/v2.5.0)
or install the beta: `npm i serverless-python-requirements@beta`

## Install

```
npm install serverless-python-requirements
```

Add the plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-python-requirements
package: # this section is optional, but suggested. It reduces deploy size
  exclude:
    - node_modules/**  # Omit JavaScript dependencies, you're using Python!!
    - venv/**  # Omit your virtualenv if you've created one locally for development
```


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
To utilize your own Docker container instead of the default, add the following to your `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    dockerImage: <image name>:tag
```
This must be the full image name and tag to use, including the runtime specific tag if applicable.


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
import unzip_requirements
```

If you want to be able to use `sls invoke local` and don't have a check for
lambda or a `try`/`except ImportError` around that import, you can use the
following option to make this plugin not delete the `unzip_requirements`
helper:
```yaml
custom:
  pythonRequirements:
    cleanupZipHelper: false
```

## Omitting Packages 
You can omit a package from deployment with the `noDeploy` option. Note that
dependencies of omitted packages must explicitly be omitted too.
By default, this will not install the AWS SDKs that are already installed on
Lambda:
```yaml
custom:
  pythonRequirements:
    noDeploy:
      - boto3
      - botocore
      - docutils
      - jmespath
      - python-dateutil
      - s3transfer
      - six
      - pip
      - setuptools
```

## extra pip arguments
You can specify extra arguments to be passed to pip like this:
```yaml
custom:
  pythonRequirements:
      dockerizePip: true
      pipCmdExtraArgs:
          - --cache-dir
          - .requirements-cache
```

## Customize requirements file name
[Some `pip` workflows involve using requirements files not named
`requirements.txt`](https://www.kennethreitz.org/essays/a-better-pip-workflow).
To support these, this plugin has the following option:

```yaml
custom:
  pythonRequirements:
    fileName: requirements-prod.txt
```

## Customize Python executable
Sometimes your Python executable isn't available on your `$PATH` as `python2.7`
or `python3.6` (for example, windows or using pyenv).
To support this, this plugin has the following option:
```yaml
custom:
  pythonRequirements:
    pythonBin: /opt/python3.6/bin/python
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

## Experimental Pipenv support :sparkles::cake::sparkles:
If you include a `Pipfile` and have `pipenv` installed instead of a
`requirements.txt` this will use `pipenv` to install your requirements and link
them. It doesn't currently work with either the `zip` or `dockerizePip`
options.

## Updating to python 3.6

This requires an update to your serverless.yml:

```
provider:
  name: aws
  runtime: python3.6
```

And be sure to clean up `.requirements` or `requirements.zip` if they exist as
python2.7 and python3.6 code can't coexist.


## Credit
This plugin is influenced by
[serverless-wsgi](https://github.com/logandk/serverless-wsgi) from
[@logandk](https://github.com/logandk). I however wanted a simpler pip install
process. It now also supports bundling packages without the wsgi handler.
