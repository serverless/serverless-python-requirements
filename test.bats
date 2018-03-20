#!/usr/bin/env bats


setup() {
    export SLS_DEBUG=t
    if [ -z "$CI" ]; then
        export LC_ALL=C.UTF-8
        export LANG=C.UTF-8
    fi

    cd test

    npm i ..
}

teardown() {
    sls requirements clean
    rm -rf puck puck2 puck3 node_modules .serverless .requirements.zip .requirements-cache
    if [ -f serverless.yml.bak ]; then mv serverless.yml.bak serverless.yml; fi
}

@test "py3.6 can package flask with default options" {
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
}

@test "py3.6 can package flask with zip option" {
    sls --zip=true package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
    ! ls puck/flask
}

@test "py3.6 doesn't package boto3 by default" {
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ! ls puck/boto3
}

@test "py3.6 doesn't package bottle with noDeploy option" {
    perl -p -i'.bak' -e 's/(pythonRequirements:$)/\1\n    noDeploy: [bottle]/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ! ls puck/bottle.py
    ! ls puck/__pycache__/bottle.cpython-36.pyc
}

@test "py3.6 can package flask with zip & dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    sls --dockerizePip=true --zip=true package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "py3.6 can package flask with dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    sls --dockerizePip=true package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
}

@test "py3.6 uses cache with dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    perl -p -i'.bak' -e 's/(pythonRequirements:$)/\1\n    pipCmdExtraArgs: ["--cache-dir", ".requirements-cache"]/' serverless.yml
    sls --dockerizePip=true package
    ls .requirements-cache/http
}

@test "py2.7 can package flask with default options" {
    sls --runtime=python2.7 package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
}

@test "py2.7 can package flask with zip option" {
    sls --runtime=python2.7 --zip=true package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "py2.7 doesn't package boto3 by default" {
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ! ls puck/boto3
}

@test "py2.7 doesn't package bottle with noDeploy option" {
    perl -p -i'.bak' -e 's/(pythonRequirements:$)/\1\n    noDeploy: [bottle]/' serverless.yml
    sls --runtime=python2.7 package
    unzip .serverless/sls-py-req-test.zip -d puck
    ! ls puck/bottle.py
}

@test "py2.7 can package flask with zip & dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    sls --dockerizePip=true --runtime=python2.7 --zip=true package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "py2.7 can package flask with dockerizePip option" {
    [ -z "$CIRCLE_BRANCH" ] || skip "Volumes are weird in CircleCI https://circleci.com/docs/2.0/building-docker-images/#mounting-folders"
    ! uname -sm|grep Linux || groups|grep docker || id -u|egrep '^0$' || skip "can't dockerize on linux if not root & not in docker group"
    sls --dockerizePip=true --runtime=python2.7 package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
}

@test "pipenv py3.6 can package flask with default options" {
    cd ../pipenv-example
    npm i ..
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
}

@test "pipenv py3.6 can package flask with zip option" {
    cd ../pipenv-example
    npm i ..
    sls --zip=true package
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

@test "pipenv py3.6 doesn't package bottle with noDeploy option" {
    cd ../pipenv-example
    npm i ..
    perl -p -i'.bak' -e 's/(pythonRequirements:$)/\1\n    noDeploy: [bottle]/' serverless.yml
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ! ls puck/bottle.py
}

@test "py3.6 can package flask with zip option and no explicit include" {
    sed -i'.bak' -e 's/include://' -e 's/^.*handler.py//' serverless.yml
    sls --zip=true package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
}

@test "py3.6 can package flask with package individually option" {
    sls --individually=true package
    unzip .serverless/hello.zip -d puck
    unzip .serverless/hello2.zip -d puck2
    unzip .serverless/hello3.zip -d puck3
    ls puck/flask
    ls puck2/flask
    ! ls puck3/flask
}

@test "py2.7 can package flask with package individually option" {
    sls --individually=true --runtime=python2.7 package
    unzip .serverless/hello.zip -d puck
    unzip .serverless/hello2.zip -d puck2
    unzip .serverless/hello3.zip -d puck3
    ls puck/flask
    ls puck2/flask
    ! ls puck3/flask
}

@test "py3.6 can package only requirements of module" {
    cd ../test-indiv
    npm i ..
    sls package
    unzip .serverless/module1.zip -d puck
    unzip .serverless/module2.zip -d puck2
    ls puck/handler1.py
    ls puck2/handler2.py
    ls puck/pyaml
    ls puck2/flask
    ! ls puck/handler2.py
    ! ls puck2/handler1.py
    ! ls puck/flask
    ! ls puck2/pyaml
}
