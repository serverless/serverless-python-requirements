#!/usr/bin/env bats


setup() {
    export SLS_DEBUG=t
    export LC_ALL=C.UTF-8
    export LANG=C.UTF-8

    cd example

    npm i ..
}

teardown() {
    sls requirements clean
    rm -rf puck node_modules
    if [ -f serverless.yml.bak ]; then mv serverless.yml.bak serverless.yml; fi
}

@test "py3.6 can package flask with default options" {
    cp serverless.yml serverless.yml.bak  # fake backup since we don't sed
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
}

@test "py3.6 can package flask with zip option" {
    sed -i'.bak' -e 's/zip: *false/zip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "py3.6 doesn't package boto3 by default" {
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ! ls puck/boto3
}

@test "py3.6 doesn't package hug with noDeploy option" {
    sed -i'.bak' -re 's/(pythonRequirements:$)/\1\n    noDeploy: [hug]/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ! ls puck/hug
}

@test "py3.6 can package flask with zip & dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    sed -i'.bak' -e 's/dockerizePip: *false/dockerizePip: true/' -e 's/zip: *false/zip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "py3.6 can package flask with dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    sed -i'.bak' -e 's/dockerizePip: *false/dockerizePip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
}

@test "py2.7 can package flask with default options" {
    sed -i'.bak' -e 's/runtime: *python3.6/runtime: python2.7/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
}

@test "py2.7 can package flask with zip option" {
    sed -i'.bak' -e 's/runtime: *python3.6/runtime: python2.7/' -e 's/zip: *false/zip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "py2.7 doesn't package boto3 by default" {
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ! ls puck/boto3
}

@test "py2.7 doesn't package hug with noDeploy option" {
    sed -i'.bak' -e 's/runtime: *python3.6/runtime: python2.7/' -re 's/(pythonRequirements:$)/\1\n    noDeploy: [hug]/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ! ls puck/hug
}

@test "py2.7 can package flask with zip & dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    sed -i'.bak' -e 's/dockerizePip: *false/dockerizePip: true/' -e 's/runtime: *python3.6/runtime: python2.7/' -e 's/zip: *false/zip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "py2.7 can package flask with dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    sed -i'.bak' -e 's/runtime: *python3.6/runtime: python2.7/' -e 's/dockerizePip: *false/dockerizePip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
}

@test "pipenv py3.6 can package flask with default options" {
    cd ../pipenv-example
    npm i ..
    cp serverless.yml serverless.yml.bak  # fake backup since we don't sed
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
}

@test "pipenv py3.6 can package flask with zip option" {
    cd ../pipenv-example
    npm i ..
    sed -i'.bak' -e 's/zip: *false/zip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "pipenv py3.6 doesn't package boto3 by default" {
    cd ../pipenv-example
    npm i ..
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ! ls puck/boto3
}

@test "pipenv py3.6 doesn't package hug with noDeploy option" {
    cd ../pipenv-example
    npm i ..
    sed -i'.bak' -re 's/(pythonRequirements:$)/\1\n    noDeploy: [hug]/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ! ls puck/hug
}
