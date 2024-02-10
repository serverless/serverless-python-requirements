# Contributing Guidelines

We are always looking to promote good contributors to be maintainers and provide them a front-row seat to serverless innovation.

If you would like to be a maintainer for the [Serverless Framework](https://github.com/serverless/serverless) or any of our plugins, please get started with making code contributions and engaging with open issues/PRs. Also, please reach out to any of [Serverless organization](https://github.com/serverless) members to express your interest.

We'd love to collaborate closely with amazing developers as we drive the development of this open technology into the future.

Welcome, and thanks in advance for your help!

# How to contribute to `serverless-python-requirements`

## Setup

Pre-Reqs:

- Python 3.9
- [poetry](https://python-poetry.org/docs/) (if you use multiple versions of Python be sure to install it with python 3.9)
- Perl (used in the tests)
- Node v14 or v16

Then, to begin development:

1. fork the repository
2. `npm install -g serverless@<VERSION>` (check the peer dependencies in the root `package.json` file for the version)
3. run `npm install` in its root folder
4. run the tests via `npm run test`

## Getting started

A good first step is to search for open [issues](https://github.com/serverless/serverless-python-requirements/issues). Issues are labeled, and some good issues to start with are labeled: [good first issue](https://github.com/serverless/serverless-python-requirements/labels/good%20first%20issue) and [help wanted](https://github.com/serverless/serverless-python-requirements/labels/help%20wanted).

## When you propose a new feature or bug fix

Please make sure there is an open issue discussing your contribution before jumping into a Pull Request!
There are just a few situations (listed below) in which it is fine to submit PR without a corresponding issue:

- Documentation update
- Obvious bug fix
- Maintenance improvement

In all other cases please check if there's an open an issue discussing the given proposal, if there is not, create an issue respecting all its template remarks.

In non-trivial cases please propose and let us review an implementation spec (in the corresponding issue) before jumping into implementation.

Do not submit draft PRs. Submit only finalized work which is ready for merge. If you have any doubts related to implementation work please discuss in the corresponding issue.

Once a PR has been reviewed and some changes are suggested, please ensure to **re-request review** after all new changes are pushed. It's the best and quietest way to inform maintainers that your work is ready to be checked again.

## When you want to work on an existing issue

**Note:** Please write a quick comment in the corresponding issue and ask if the feature is still relevant and that you want to jump into the implementation.

Check out our [help wanted](https://github.com/serverless/serverless-python-requirements/labels/help%20wanted) or [good first issue](https://github.com/serverless/serverless-python-requirements/labels/good%20first%20issue) labels to find issues we want to move forward with your help.

We will do our best to respond/review/merge your PR according to priority. We hope that you stay engaged with us during this period to ensure QA. Please note that the PR will be closed if there hasn't been any activity for a long time (~ 30 days) to keep us focused and keep the repo clean.

## Reviewing Pull Requests

Another really useful way to contribute is to review other people's Pull Requests. Having feedback from multiple people is helpful and reduces the overall time to make a final decision about the Pull Request.

## Providing support

The easiest thing you can do to help us move forward and make an impact on our progress is to simply provide support to other people having difficulties with their projects.

You can do that by replying to [issues on GitHub](https://github.com/serverless/serverless-python-requirements/issues), chatting with other community members in [our Community Slack](https://www.serverless.com/slack), or [GitHub Discussions](https://github.com/serverless/serverless-python-requirements/discussions).

---

# Code Style

We aim for a clean, consistent code style. We're using [Prettier](https://prettier.io/) to confirm one code formatting style and [ESlint](https://eslint.org/) helps us to stay away from obvious issues that can be picked via static analysis.

Ideally, you should have Prettier and ESlint integrated into your code editor, which will help you not think about specific rules and be sure you submit the code that follows guidelines.

## Verifying prettier formatting

```
npm run prettier-check
```

## Verifying linting style

```
npm run lint
```

## Other guidelines

- Minimize [lodash](https://lodash.com/) usage - resort to it, only if given part of logic cannot be expressed easily with native language constructs
- When writing asynchronous code, ensure to take advantage of [async functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function) and native `Promise` API. Do not rely on [Bluebird](http://bluebirdjs.com) even though still large parts of old code rely on it. We're looking forward to drop this dependency in the near future.

# Testing

When proposing a few feature or fixing a bug, it is recommended to also provide sufficient test coverage. All tests live in `./test.js` module.

# Our Code of Conduct

Finally, to make sure you have a pleasant experience while being in our welcoming community, please read our [code of conduct](CODE_OF_CONDUCT.md). It outlines our core values and beliefs and will make working together a happier experience.

Thanks again for being a contributor to the Serverless Community :tada:!

Cheers,

The :zap: [Serverless](http://www.serverless.com) Team
