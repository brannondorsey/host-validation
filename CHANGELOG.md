# Host Validation CHANGELOG

## v2.0.0

- Add custom error handler ([#1](https://github.com/brannondorsey/host-validation/issues/1))
- Change several error messages (this change required the breaking semver bump)
- Add tests to improve testing coverage

## v1.2.0

- Add CI with `.travis.yml`.
- Add test coverage with Coveralls.
- Add `coverage` and `coveralls` npm tasks.
- Fix missing "," syntax error in `example.js` and README.

## v1.1.0

- Server now responds to invalid Host/Referer requests with `403 Forbidden` instead of `401 Unauthorized` per [this discussion](https://stackoverflow.com/questions/49481293/what-is-the-most-appropriate-http-status-code-for-invalid-host-referer-request-h).
- Add `CODE_OF_CONDUCT.md`
- Remove commented-out code in `index.js`

## v1.0.1

- Update README
- Update `tests.js`, server now closes.

## v1.0.0

Initial release. Supports Host and Referer validation via string matches and regular expressions.