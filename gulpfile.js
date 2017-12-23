'use strict'

const gulp = require('gulp')
const minimist = require('minimist')

const lint = require('./tasks/lint-task')
const format = require('./tasks/format-task')
const test = require('./tasks/test-task')
const commitlint = require('./tasks/commitlint-task')

const args = minimist(process.argv.slice(2))

const allFiles = args.package
  ? [`packages/${args.package}/{lib,test}/**/*.js`]
  : ['gulpfile.js', '{lib*,tasks,test}/**/*.js', 'packages/*/{lib,test}/**/*.js']
const testFiles = args.package
  ? [`packages/${args.package}/test/**/*-test.js`]
  : ['test/**/*-test.js', 'packages/*/test/**/*-test.js']

const isCodeCoverageEnabled = () => process.env.COVERAGE === 'true' || process.env.CI

gulp.task('lint', () => lint(allFiles))
gulp.task('format', () => format(allFiles))
gulp.task('test', ['lint'], () => test(testFiles, isCodeCoverageEnabled()))
gulp.task('test!', () => test(testFiles, isCodeCoverageEnabled()))
gulp.task('test:watch', () => gulp.watch(allFiles, ['test!']))
gulp.task('commitlint', () => commitlint())

gulp.task('default', ['test'])
