### native compilation example
Uses `dockerizePip` to deploy numpy-scipy-sklearn demo.

### test
As in other examples, use node version >= 6.

```
cd example_native_deps
npm install --prefix . serverless-python-requirements
sls deploy --verbose
sls invoke -f hello --verbose --log
```

...expected result:

```
{
    "numpy": "1.13.3",
    "scipy": "1.0.0",
    "sklearn": "0.19.1"
}
```
