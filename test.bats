#!/usr/bin/env bats


setup() {
    export SLS_DEBUG=t

    cd example

    npm i ..
}

teardown() {
    sls requirements clean
    rm -rf puck node_modules
    if [ -f serverless.yml.bak ]; then mv serverless.yml.bak serverless.yml; fi
}

@test "py3.6 can package requests with default options" {
    cp serverless.yml serverless.yml.bak  # fake backup since we don't sed
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/requests
}

@test "py3.6 can package requests with zip option" {
    sed -i'.bak' -e 's/zip: *false/zip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "py3.6 can package requests with zip & dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    sed -i'.bak' -e 's/dockerizePip: *false/dockerizePip: true/' -e 's/zip: *false/zip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "py3.6 can package requests with dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    sed -i'.bak' -e 's/dockerizePip: *false/dockerizePip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/requests
}

@test "py2.7 can package requests with default options" {
    sed -i'.bak' -e 's/runtime: *python3.6/runtime: python2.7/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/requests
}

@test "py2.7 can package requests with zip option" {
    sed -i'.bak' -e 's/runtime: *python3.6/runtime: python2.7/' -e 's/zip: *false/zip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "py2.7 can package requests with zip & dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    sed -i'.bak' -e 's/dockerizePip: *false/dockerizePip: true/' -e 's/runtime: *python3.6/runtime: python2.7/' -e 's/zip: *false/zip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "py2.7 can package requests with dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    sed -i'.bak' -e 's/runtime: *python3.6/runtime: python2.7/' -e 's/dockerizePip: *false/dockerizePip: true/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/requests
}
