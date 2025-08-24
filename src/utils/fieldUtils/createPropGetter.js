// @flow
import * as R from 'ramda'

/**
 * A thunk to generate a field prop getter function.
 * The latter is used for reactive props implementation and allows to flush
 * field prop references into a single source using a callback function.
 */
export default function createPropGetter(fields, callback) {
  return (propPath) => {
    if (!Array.isArray(propPath) || propPath.length === 0) return undefined
    const value = R.path(propPath, fields)
    if (callback) callback(propPath, value)
    return value
  }
}
