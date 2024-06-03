# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [6.1.1](https://github.com/UnitedIncome/serverless-python-requirements/compare/v6.1.0...v6.1.1) (2024-06-03)

## [6.1.0](https://github.com/UnitedIncome/serverless-python-requirements/compare/v6.0.1...v6.1.0) (2024-03-27)

### Features

- Support Scaleway provider ([#812](https://github.com/UnitedIncome/serverless-python-requirements/issues/812)) ([1b0faae](https://github.com/UnitedIncome/serverless-python-requirements/commit/1b0faaeb6aadd2bc4b1b53526e35298a98d00aca)) ([Andy Méry](https://github.com/cyclimse))
- Improved pip failure logging ([#813](https://github.com/UnitedIncome/serverless-python-requirements/issues/813)) ([787b479](https://github.com/UnitedIncome/serverless-python-requirements/commit/787b4791306e9a3ded5f0177c304cfbce081c119)) ([Justin Lyons](https://github.com/babyhuey))

### Bug Fixes

- Ensure proper support for mixed runtimes and architectures ([#815](https://github.com/UnitedIncome/serverless-python-requirements/issues/815)) ([27b70f4](https://github.com/UnitedIncome/serverless-python-requirements/commit/27b70f4d6a7e43fd0e9711bbb56752fee2762901)) ([Stijn IJzermans](https://github.com/stijzermans))

### [6.0.1](https://github.com/UnitedIncome/serverless-python-requirements/compare/v6.0.0...v6.0.1) (2023-10-22)

### Bug Fixes

- Add legacy `pipenv` backward compatability ([#742](https://github.com/UnitedIncome/serverless-python-requirements/issues/742)) ([22a1f83](https://github.com/UnitedIncome/serverless-python-requirements/commit/22a1f832ac8051f0963328743f9e768f8e66649e)) ([Randy Westergren](https://github.com/rwestergren))
- Not crash when runtime is not `python` ([#773](https://github.com/UnitedIncome/serverless-python-requirements/issues/773)) ([c1f5ca1](https://github.com/UnitedIncome/serverless-python-requirements/commit/c1f5ca114de815ca19ad213a79e250b5b81f29b3)) ([Jim Kirkbride](https://github.com/jameskbride))
- Remove outdated Pipenv requirements flag ([#780](https://github.com/UnitedIncome/serverless-python-requirements/issues/780)) ([ad40278](https://github.com/UnitedIncome/serverless-python-requirements/commit/ad40278629c63f4d0971637214b4d9bc20dbd288)) ([Jeff Gordon](https://github.com/jfgordon2))

### Maintenance Improvements

- Fix integration test matrix configuration ([#755](https://github.com/UnitedIncome/serverless-python-requirements/issues/755)) ([e8b2e51](https://github.com/UnitedIncome/serverless-python-requirements/commit/e8b2e51c265792046bacc3946f22f7bd842c60e6)) ([Randy Westergren](https://github.com/rwestergren))

## [6.0.0](https://github.com/UnitedIncome/serverless-python-requirements/compare/v5.4.0...v6.0.0) (2022-10-23)

### ⚠ BREAKING CHANGES

- Changes default `dockerImage` used for building dependencies (now uses images from `public.ecr.aws/sam` repository)
- Requires `pipenv` in version `2022-04-08` or higher

### Features

- Introduce `requirePoetryLockFile` flag ([#728](https://github.com/serverless/serverless-python-requirements/pull/728)) ([e81d9e1](https://github.com/UnitedIncome/serverless-python-requirements/commit/e81d9e1824c135f110b4deccae2c26b0cbb26778)) ([François-Michel L'Heureux](https://github.com/FinchPowers))
- Switch to official AWS docker images by default ([#724](https://github.com/UnitedIncome/serverless-python-requirements/issues/724)) ([4ba3bbe](https://github.com/UnitedIncome/serverless-python-requirements/commit/4ba3bbeb9296b4844feb476de695f33ee2a30056)) ([Piotr Grzesik](https://github.com/pgrzesik))

### Bug Fixes

- Adapt to support latest `pipenv` version ([#718](https://github.com/UnitedIncome/serverless-python-requirements/issues/718)) ([853da8d](https://github.com/UnitedIncome/serverless-python-requirements/commit/853da8d39921dc83a23d59fd825b2180814f87ff)) ([Anders Steiner](https://github.com/andidev) & [Randy Westergren](https://github.com/rwestergren) & [Piotr Grzesik](https://github.com/pgrzesik))
- Properly recognize individual function ([#725](https://github.com/UnitedIncome/serverless-python-requirements/issues/725)) ([78795be](https://github.com/UnitedIncome/serverless-python-requirements/commit/78795be24eb08dc78acd7566778b3960c28b263c)) ([Piotr Grzesik](https://github.com/pgrzesik))

### Maintenance Improvements

- Improve error message for docker failures ([#723](https://github.com/serverless/serverless-python-requirements/pull/723))([cc146d0](https://github.com/UnitedIncome/serverless-python-requirements/commit/cc146d088d362187641dd5ae3e9d0129a14c60e2)) ([Piotr Grzesik](https://github.com/pgrzesik))

## [5.4.0](https://github.com/UnitedIncome/serverless-python-requirements/compare/v5.3.1...v5.4.0) (2022-03-14)

### Features

- Support `dockerPrivateKey` to specify path to SSH key ([#674](https://github.com/UnitedIncome/serverless-python-requirements/issues/674)) ([915bcad](https://github.com/UnitedIncome/serverless-python-requirements/commit/915bcadad2f8a3be5434d6e42771bc835271baf8)) ([Marcin Szleszynski](https://github.com/martinezpl))
- Support individual packaging with `poetry` ([#682](https://github.com/UnitedIncome/serverless-python-requirements/issues/682)) ([ebd12cb](https://github.com/UnitedIncome/serverless-python-requirements/commit/ebd12cb14ea352fb08c0957f213bda7dcce800df)) ([Brandon White](https://github.com/BrandonLWhite))

### Maintenance Improvements

- Log child process command output on error ([#679](https://github.com/UnitedIncome/serverless-python-requirements/issues/679)) ([ff11497](https://github.com/UnitedIncome/serverless-python-requirements/commit/ff11497cbcf42fe7f7d73fb2e8e2642c542dd8d7)) ([Andrei Zhemaituk](https://github.com/zhemaituk))
- Replace `lodash.set` with `set-value` ([#676](https://github.com/UnitedIncome/serverless-python-requirements/issues/676)) ([3edf0e0](https://github.com/UnitedIncome/serverless-python-requirements/commit/3edf0e0cabeeb11ffadd9dcac6f198f22aee4a16)) ([Marc Hassan](https://github.com/mhassan1))

### [5.3.1](https://github.com/UnitedIncome/serverless-python-requirements/compare/v5.3.0...v5.3.1) (2022-01-28)

### Bug Fixes

- Address unknown path format error in `wsl2` ([#667](https://github.com/UnitedIncome/serverless-python-requirements/issues/667)) ([b16c82d](https://github.com/UnitedIncome/serverless-python-requirements/commit/b16c82dbdd31ca7f61093bb6b8ed50be31908a24)) ([Shinichi Makino](https://github.com/snicmakino))

## [5.3.0](https://github.com/UnitedIncome/serverless-python-requirements/compare/v5.2.1...v5.3.0) (2021-12-21)

### Features

- Support requirements layer caching ([#644](https://github.com/UnitedIncome/serverless-python-requirements/issues/644)) ([406f6ba](https://github.com/UnitedIncome/serverless-python-requirements/commit/406f6bac1ca934a34387048b5c00242aff3f581b)) ([Maciej Wilczyński](https://github.com/mLupine))

### Bug Fixes

- Ensure cast `toString` before `trim` on buffer ([f60eed1](https://github.com/UnitedIncome/serverless-python-requirements/commit/f60eed1225f091c090f9c253771a12b33fafcab0))

### [5.2.2](https://github.com/UnitedIncome/serverless-python-requirements/compare/v5.2.1...v5.2.2) (2021-12-03)

### Bug Fixes

- Ensure cast `toString` before `trim` on buffer ([#656](https://github.com/serverless/serverless-python-requirements/pull/656)) ([f60eed1](https://github.com/UnitedIncome/serverless-python-requirements/commit/f60eed1225f091c090f9c253771a12b33fafcab0)) ([Piotr Grzesik](https://github.com/pgrzesik))

### [5.2.1](https://github.com/UnitedIncome/serverless-python-requirements/compare/v5.2.0...v5.2.1) (2021-11-30)

### Maintenance Improvements

- Adapt plugin to modern logs ([#646](https://github.com/serverless/serverless-python-requirements/pull/646)) ([8ff97e6](https://github.com/UnitedIncome/serverless-python-requirements/commit/8ff97e6b7c279334e417dbdb65e64d0de2656986)) ([Piotr Grzesik](https://github.com/pgrzesik))
- Adapt to `async` version of `spawn` ([#648](https://github.com/serverless/serverless-python-requirements/pull/648)) ([50c2850](https://github.com/UnitedIncome/serverless-python-requirements/commit/50c2850874ded795fd50ae377f1db817a0212e7d)) ([Piotr Grzesik](https://github.com/pgrzesik))
- Adapt v3 log writing interfaces ([#646](https://github.com/serverless/serverless-python-requirements/pull/646)) ([a79899a](https://github.com/UnitedIncome/serverless-python-requirements/commit/a79899ae5f6f66aa0c65e7fda8e0186d38ff446e)) ([Piotr Grzesik](https://github.com/pgrzesik))
- Ensure proper verbose progress logs ([#646](https://github.com/serverless/serverless-python-requirements/pull/646)) ([44b9591](https://github.com/UnitedIncome/serverless-python-requirements/commit/44b9591f01157a1811e3ca8b43e21265a155a976)) ([Piotr Grzesik](https://github.com/pgrzesik))
- Use `ServerlessError` ([#649](https://github.com/serverless/serverless-python-requirements/pull/649)) ([cdb7111](https://github.com/UnitedIncome/serverless-python-requirements/commit/cdb71110bc9c69b5087b6e18fb353d65962afe4a)) ([Piotr Grzesik](https://github.com/pgrzesik))

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.
