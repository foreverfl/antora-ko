'use strict'

const semverCompare = require('semver-compare')

/**
 * A modified semantic version comparison function.
 *
 * Based on a semantic version comparison algorithm with the following enhancements:
 *
 * * Drops the leading "v" character from a semantic version, if present.
 * * Compares semantic versions in descending order (e.g., 2.0.0 comes before 1.0.0).
 * * Bubbles non-semantic versions to the top (e.g., dev, master).
 * * Compares non-semantic versions as strings.
 *
 * This function assumes the string is a semantic version if it contains a "." character.
 *
 * @param {String} a - The left version string.
 * @param {String} b - The right version string.
 * @returns 0 if the versions match, -1 if a is greater, or 1 if b is greater.
 */
function versionCompareDesc (a, b) {
  if (a === b) return 0
  if (~a.indexOf('.')) {
    if (~b.indexOf('.')) {
      return -1 * semverCompare(a.charAt() === 'v' ? a.substr(1) : a, b.charAt() === 'v' ? b.substr(1) : b)
    } else {
      return 1
    }
  } else {
    return ~b.indexOf('.') ? -1 : a.localeCompare(b)
  }
}

module.exports = versionCompareDesc
