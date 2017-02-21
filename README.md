# Serverless Python Requirements

[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)

[![npm](https://nodei.co/npm/serverless-python-requirements.png?downloads=true&downloadRank=true)](https://www.npmjs.com/package/serverless-python-requirements)

A Serverless v1.0 plugin to automatically bundle dependencies from 
`requirements.txt` and makes them available in your `PYTHONPATH`.


## Install

```
npm install --save serverless-python-requirements
```

Add the plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-python-requirements
```


## How serverless-python-requirements adds the dependencies to `sys.path`

`serverless-python-requirements` adds a module called `sitecustomize` to your
puck, which is imported automatically by Python's `site` module.

## Cross compiling!
Compiling non-pure-Python modules is supported on MacOS via the use of Docker
and the [docker-lambda](https://github.com/lambci/docker-lambda) image.
To enable docker usage, add the following to your `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    dockerizePip: true
```

## ZipImport!
To help deal with potentially large dependencies (for example: `numpy`, `scipy`
and `scikit-learn`) there is support for having python import using
[zipimport](https://docs.python.org/2.7/library/zipimport.html). To enable this
add the following to your  `serverless.yml`:
```yaml
custom:
  pythonRequirements:
    zipImport: true
```


## Limitations
 * if using the `package` directive in `serverless.yml` ensure that
`sitecustomize.py` is are included as well as `.requirements` or
`.requirements.zip` if using [ZipImport](#zipimport).


## Manual invocations

The `.requirements` and `sitecustomize.py` files are left behind to speed up
subsequent deployments. To clean them up, run `sls requirements clean`. You can
also install them manually with `sls requirements install`.

## Credit
This plugin is influenced by
[serverless-wsgi](https://github.com/logandk/serverless-wsgi) from
[@logandk](https://github.com/logandk). I however wanted a simpler pip install
process. It now also supports bundling packages without the wsgi handler.
