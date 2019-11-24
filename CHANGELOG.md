# Change Log

## [Unreleased]

### Others

* [#98] - Uppdate example / Add `metalsmith-build-date`
* [#107] - Renovate package groups

[Unreleased]: https://github.com/sounisi5011/metalsmith-netlify-published-date/compare/v0.2.0...HEAD
[#98]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/98
[#107]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/107

## [0.2.0] (2019-09-07 UTC)

### Features

* [#84] - Add `metadataUpdater` option: Update metadata before build for comparison

### Updated Dependencies

#### devDependencies

* `eslint-plugin-node`
    * [#82] - `9.2.0` -> `10.0.0`
* `nock`
    * [#83] - `11.3.2` -> `11.3.3`

### Tests

* [#85] - Refactoring tests

[0.2.0]: https://github.com/sounisi5011/metalsmith-netlify-published-date/compare/v0.1.2...v0.2.0
[#82]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/82
[#83]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/83
[#84]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/84
[#85]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/85

## [0.1.2] (2019-09-04 UTC)

### Fixed

* [#80] - Recursive object cannot be restored
* [#80] - Getter and setter properties cannot be restored

### Updated Dependencies

#### devDependencies

* `@typescript-eslint/eslint-plugin`
    * [#76] - `2.0.0` -> `2.1.0`
* `@typescript-eslint/parser`
    * [#76] - `2.0.0` -> `2.1.0`
* `del`
    * [#69] - `5.0.0` -> `5.1.0`
* `eslint`
    * [#70] - `6.2.1` -> `6.3.0`
* `eslint-config-prettier`
    * [#79] - `6.1.0` -> `6.2.0`
* `eslint-config-standard`
    * [#68] - `14.0.0` -> `14.1.0`
* `eslint-plugin-node`
    * [#74] - `9.1.0` -> `9.2.0`
* `husky`
    * [#75] - `3.0.4` -> `3.0.5`
* `lint-staged`
    * [#71] - `9.2.3` -> `9.2.5`
* `mustache`
    * [#66] - `3.0.1` -> `3.0.3`
* `nock`
    * [#67] - `11.3.0` -> `11.3.2`
* `package-version-git-tag`
    * [#77] - `1.1.0` -> `1.1.1`

### Others

* [#78] - Exclude branches that update packages that cannot be tested with CI

[0.1.2]: https://github.com/sounisi5011/metalsmith-netlify-published-date/compare/v0.1.1...v0.1.2
[#66]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/66
[#67]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/67
[#68]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/68
[#69]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/69
[#70]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/70
[#71]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/71
[#74]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/74
[#75]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/75
[#76]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/76
[#77]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/77
[#78]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/78
[#79]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/79
[#80]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/80

## [0.1.1] (2019-08-20 UTC / 2019-08-21 UTC+09)

### Updated Dependencies

#### dependencies

* `@types/debug`
    * [#49] - `4.1.4` -> `4.1.5`
* `@types/got`
    * [#54] - `9.6.5` -> `9.6.7`

#### devDependencies

* `@typescript-eslint/eslint-plugin`
    * [#55] - `1.13.0` -> `2.0.0`
* `@typescript-eslint/parser`
    * [#55] - `1.13.0` -> `2.0.0`
* `ava`
    * [#57] - `2.2.0` -> `2.3.0`
* `eslint`
    * [#1] - `5.16.0` -> `6.2.1`
* `eslint-config-prettier`
    * [#58] - `6.0.0` -> `6.1.0`
* `eslint-config-standard`
    * [#59] - `12.0.0` -> `14.0.0`
* `eslint-plugin-standard`
    * [#60] - `4.0.0` -> `4.0.1`
* `git-branch-is`
    * [#53] - `2.1.0` -> `3.0.0`
* `husky`
    * [#50] - `3.0.2` -> `3.0.4`
* `lint-staged`
    * [#56] - `9.2.1` -> `9.2.3`
* `nock`
    * [#8] - `11.0.0-beta.13` -> `11.3.0`

### Moved Dependencies

#### dependencies -> devDependencies

* [#51] - `@types/deep-freeze-strict@1.1.0`
* [#51] - `@types/flat-cache@2.0.0`
* [#51] - `@types/parse-link-header@1.0.0`

### Removed Dependencies

#### devDependencies

* [#8] - `@types/nock`

### Internal API

* [#48] - Fetch Netlify API only when needed

### Others

* [#52] - Fix example / Add `const` keyword to variable definition statement

[0.1.1]: https://github.com/sounisi5011/metalsmith-netlify-published-date/compare/v0.1.0...v0.1.1
[#1]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/1
[#8]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/8
[#48]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/48
[#49]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/49
[#50]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/50
[#51]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/51
[#52]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/52
[#53]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/53
[#54]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/54
[#55]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/55
[#56]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/56
[#57]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/57
[#58]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/58
[#59]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/59
[#60]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/60

## [0.1.0] (2019-08-07)

[0.1.0]: https://github.com/sounisi5011/metalsmith-netlify-published-date/compare/v0.0.0...v0.1.0
