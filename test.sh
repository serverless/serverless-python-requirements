#!/bin/bash

set -e
export SLS_DEBUG=t

cd example

npm i ..

# test packaging
sls package

# check that the puck contains requests library
unzip .serverless/sls-py-req-test.zip -d puck > /dev/null && ls puck/requests

#cleanup
sls requirements clean
rm -r puck node_modules
