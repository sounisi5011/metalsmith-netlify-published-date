# @sounisi5011/metalsmith-netlify-published-date

[![Go to the latest release page on npm](https://img.shields.io/npm/v/@sounisi5011/metalsmith-netlify-published-date.svg)][npm]
[![License: MIT](https://img.shields.io/static/v1?label=license&message=MIT&color=green)][github-license]
![Supported Node.js version: >=8.3.0](https://img.shields.io/static/v1?label=node&message=%3E%3D8.3.0&color=brightgreen)
[![Install Size Details](https://packagephobia.now.sh/badge?p=@sounisi5011/metalsmith-netlify-published-date@0.3.2)](https://packagephobia.now.sh/result?p=@sounisi5011/metalsmith-netlify-published-date@0.3.2)
[![Dependencies Status](https://david-dm.org/sounisi5011/metalsmith-netlify-published-date/status.svg)](https://david-dm.org/sounisi5011/metalsmith-netlify-published-date)
[![Build Status](https://dev.azure.com/sounisi5011/npm%20projects/_apis/build/status/sounisi5011.metalsmith-netlify-published-date?branchName=master)](https://dev.azure.com/sounisi5011/npm%20projects/_build/latest?definitionId=7&branchName=master)
[![Maintainability Status](https://api.codeclimate.com/v1/badges/913d0fe6324ac84907d6/maintainability)](https://codeclimate.com/github/sounisi5011/metalsmith-netlify-published-date/maintainability)

[npm]: https://www.npmjs.com/package/@sounisi5011/metalsmith-netlify-published-date
[github-license]: https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.2/LICENSE

Get published date and modified date of the each page published by Netlify.

## Install

```sh
npm install @sounisi5011/metalsmith-netlify-published-date@0.3.2
```

## Usage

There is an example of a working configuration in the `./example/` directory.  
Please check: https://github.com/sounisi5011/metalsmith-netlify-published-date/tree/v0.3.2/example

## Options

**This release is unstable. Some options may be change or remove before version 1.x is released.**

To see a list of the latest commit options, see the type definition in the `./src/plugin.ts` file: https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.2/src/plugin.ts#L32-L64

Also check the test code in the `./test/options/` directory for options available in the JSON file: https://github.com/sounisi5011/metalsmith-netlify-published-date/tree/v0.3.2/test/options

### `pattern`

Only files that match this pattern will be processed.  
Specify a glob expression string or an array of strings as the pattern.  
Pattern are verified using [multimatch v4.0.0][npm-multimatch-used].

[npm-multimatch-used]: https://www.npmjs.com/package/multimatch/v/4.0.0

### `siteID`

[Site ID](https://docs.netlify.com/api/get-started/#get-site) that indicates the website to lookup on Netlify.  
When building on Netlify, this value is automatically set from [the environment variable `URL`](https://docs.netlify.com/configure-builds/environment-variables/#deploy-urls-and-metadata).  
When building in the development environment, you need to specify the `siteID` option or add the environment variable `URL`.

### `accessToken`

If you are building a private website on Netlify, you need to specify the `accessToken` option.  
The value to specify for this option can be generated on the following page (Note: you must be logged into Netlify): https://app.netlify.com/user/applications

### `plugins`

Specify the Metalsmith plugins that generate the content to be deployed to Netlify using the date metadata obtained.

Only set plugins that are fast in this option.  
A simple plugins that only has the function to convert files using date metadata is ideal.  
This is because the plug-ins specified in this option are executed many times to compare with the preview on Netlify.

### `filename2urlPath`

Specify the function of the following features: convert the file name of the before convert files into the path of the Web page published on Netlify.

e.g. If a file with extension `.pug` is converted to a file with extension `.html`, the following function should be set:

```js
const netlifyPublishedDate = require('@sounisi5011/metalsmith-netlify-published-date');

netlifyPublishedDate({
    ...
    filename2urlPath: filename => filename.replace(/\.pug$/, '.html'),
    ...
})
```

Note: The return value of the function is [delimited by the path delimiter and then URL escaped](https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.2/src/plugin.ts#L144-L150). That is, the value that this function must return is not a URL, but a file path before it is converted to a URL.

### `metadataUpdater`

Use `metadataUpdater` option if you want to update [Metalsmith metadata](https://metalsmith.io/#how-does-it-work-in-more-detail-) just before executing the build process to determine the modified date.  
Content converted with the function specified in this option is used for content comparison.

The page data obtained from the Netlify preview is passed to the first argument. Parse this data and update the Metalsmith metadata passed in the second argument.

See the `set-datetime.js` file in the `./example/` directory for verbose usage: https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.2/example/set-datetime.js

### `contentsConverter`

This function converts the content generated by the plugin specified in the `plugins` option and the content of the web page obtained from the Netlify preview.  
Content converted with the function specified in this option is used for content comparison.

In other words, this function is used to remove HTML elements that should be excluded in the comparison.  
See the `remove-time-elem.js` file in the `./example/` directory for verbose usage: https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/v0.3.2/example/remove-time-elem.js

### `cacheDir`

Specify the directory to save the cache file that holds the response data obtained from Netlify.

If set `null`, an in-memory cache using [the `Map` object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map) is used.

By default, it is set in the directory where the package is installed.  
In a normal configuration, this package is installed under the `node_modules/` directory.  
For this reason, Netlify probably keep the cache generated by the production build.

## Debug mode

This plugin supports debugging output.  
To enable, use the following command when running your build script:

```sh
DEBUG=@sounisi5011/metalsmith-netlify-published-date,@sounisi5011/metalsmith-netlify-published-date:* node my-website-build.js
```

For more details, please check the description of [debug v4.1.1][npm-debug-used].

[npm-debug-used]: https://www.npmjs.com/package/debug/v/4.1.1

## Tests

To run the test suite, first install the dependencies, then run `npm test`:

```sh
npm install
npm test
```

## Contributing

see [CONTRIBUTING.md](https://github.com/sounisi5011/metalsmith-netlify-published-date/blob/master/CONTRIBUTING.md)
