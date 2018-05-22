#!/usr/bin/env bats


setup() {
    export SLS_DEBUG=t
    if ! [ -z "$CI" ]; then
        export LC_ALL=C.UTF-8
        export LANG=C.UTF-8
    fi
}

teardown() {
    rm -rf puck puck2 puck3 node_modules .serverless .requirements.zip .requirements-cache
    if [ -f serverless.yml.bak ]; then mv serverless.yml.bak serverless.yml; fi
}

@test "py3.6 can package flask with default options" {
    cd tests/base
    npm i $(npm pack ../..)
    sls package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
}

@test "py3.6 can package flask with zip option" {
    cd tests/base
    npm i $(npm pack ../..)
    sls --zip=true package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/.requirements.zip puck/unzip_requirements.py
    ! ls puck/flask
}

@test "py3.6 can package flask with slim options" {
    cd tests/base
    npm i $(npm pack ../..)
    sls --slim=true package
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
    test $(find puck -name "*.pyc" | wc -l) -eq 0
}

@test "py3.6 can package flask with slim & slimPatterns options" {
    cd tests/base
    mv _slimPatterns.yml slimPatterns.yml
    npm i $(npm pack ../..)
    sls --slim=true package
    mv slimPatterns.yml _slimPatterns.yml    
    unzip .serverless/sls-py-req-test.zip -d puck
    ls puck/flask
    test $(find puck -name "*.pyc" | wc -l) -eq 0
    test $(find puck -type d -name "*.egg-info*" | wc -l) -eq 0  
}


