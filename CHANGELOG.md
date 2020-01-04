# Change Log

## [Unreleased]

[Unreleased]: https://github.com/sounisi5011/metalsmith-netlify-published-date/compare/v0.3.0...master

## [0.3.0] (2020-01-04 UTC)

### Breaking Changes

* [#120] -
    The object passed to [the `previewPageResponse` property](https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.0/src/plugin.ts#L77) of the `metadata` argument has been changed from [the `got`'s Response](https://www.npmjs.com/package/got/v/9.6.0#response) to [the `MultiFetchResult`](https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.0/src/utils/fetch.ts#L133-L241).
    This change affects the following plugin options:
    * [`metadataUpdater`](https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.0/src/plugin.ts#L46-L51) -
        [The third argument is the `metadata` argument](https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.0/src/plugin.ts#L49-L50).
    * [`contentsConverter`](https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.0/src/plugin.ts#L52-L57) -
        [The second argument is the `metadata` argument](https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.0/src/plugin.ts#L54-L56).
    * [`contentsEquals`](https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.0/src/plugin.ts#L58-L63) -
        [The third argument is the `metadata` argument](https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.0/src/plugin.ts#L61-L62).

### Updated Dependencies

#### devDependencies

* `@typescript-eslint/eslint-plugin`
    * [#109] - `2.1.0` -> `2.14.0`
* `@typescript-eslint/parser`
    * [#109] - `2.1.0` -> `2.14.0`
* `ava`
    * [#111] - `2.3.0` -> `2.4.0`
* `can-npm-publish`
    * [#110] - `1.3.1` -> `1.3.2`
* `del-cli`
    * [#112] - `2.0.0` -> `3.0.0`
* `eslint`
    * [#109] - `6.3.0` -> `6.8.0`
* `eslint-config-prettier`
    * [#109] - `6.2.0` -> `6.9.0`
* `eslint-plugin-import`
    * [#109] - `2.18.2` -> `2.19.1`
* `eslint-plugin-node`
    * [#113] - `10.0.0` -> `11.0.0`
* `eslint-plugin-prettier`
    * [#109] - `3.1.0` -> `3.1.2`
* `eslint-plugin-simple-import-sort`
    * [#113] - `4.0.0` -> `5.0.0`
* `git-branch-is`
    * [#110] - `3.0.0` -> `3.1.0`
* `husky`
    * [#108] - `3.0.5` -> `3.1.0`
* `lint-staged`
    * [#108] - `9.2.5` -> `9.5.0`
* `mustache`
    * [#111] - `3.0.3` -> `3.2.1`
* `nock`
    * [#111] - `11.3.3` -> `11.7.0`
    * [#119] - `11.7.0` -> `11.7.1`
* `package-version-git-tag`
    * [#112] - `1.1.1` -> `2.0.2`
* `prettier`
    * [#108] - `1.18.2` -> `1.19.1`
* `prettier-package-json`
    * [#108] - `2.1.0` -> `2.1.3`
* `sort-package-json`
    * [#108] - `1.22.1` -> `1.35.0`
    * [#121] - `1.35.0` -> `1.36.0`
* `ts-node`
    * [#111] - `8.3.0` -> `8.5.4`
* `typescript`
    * [#91] - `3.5.3` -> `3.7.4`

### Added Dependencies

#### dependencies

* [#116] - `object-rollback@1.0.0`

#### devDependencies

* [#122] - `@types/node@12.x`

### Removed Dependencies

#### dependencies

* [#120] - `@types/got`
* [#120] - `got`

### Internal API

* [#116] - Introduce `object-rollback` package
* [#120] - Migrate from [`got`](https://www.npmjs.com/package/got) package to [`http`](https://nodejs.org/api/http.html) / [`https`](https://nodejs.org/api/https.html) modules

### Others

* [#98] - Uppdate example / Add `metalsmith-build-date`
* [#107] - Renovate package groups
* [#117] - Migrate from Travis CI to Azure Pipelines

[0.3.0]: https://github.com/sounisi5011/metalsmith-netlify-published-date/compare/v0.2.0...v0.3.0
[#98]:  https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/98
[#107]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/107
[#116]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/116
[#117]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/117
[#108]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/108
[#109]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/109
[#91]:  https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/91
[#111]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/111
[#113]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/113
[#112]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/112
[#110]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/110
[#120]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/120
[#119]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/119
[#121]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/121
[#122]: https://github.com/sounisi5011/metalsmith-netlify-published-date/pull/122

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

[0.1.0]: https://github.com/sounisi5011/metalsmith-netlify-published-date/compare/13ffdc1b10f0550f5adb50674dc19997d2b50454...v0.1.0
