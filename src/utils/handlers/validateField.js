import * as R from 'ramda'
import * as recordUtils from '../recordUtils'
import validate from '../validation'
import reflectValidationResult from '../validation/reflectors/reflectValidationResult'

/**
 * Валидируем поле и возвращаем fieldProps с отражённым результатом.
 * Если движок валидации не вернул осмысленного результата (expected == null),
 * то для required-полей вычисляем expected сами: expected = !!value.
 */
export default async function validateField(resolverArgs) {
  const { fieldProps } = resolverArgs
  let validationResult

  try {
    validationResult = await validate(resolverArgs)
  } catch (_) {
    // не роняем поток валидации
    validationResult = null
  }

  // Если валидация ничего не вернула или сказала «не требовалась»
  if (!validationResult || validationResult.expected == null) {
    const required = !!fieldProps.required
    const value = recordUtils.getValue(fieldProps)
    const expected = required ? !!value : true
    const errors = required && !expected ? ['required'] : null

    const base = R.mergeDeepRight(fieldProps, {
      expected,
      validated: true,
      validatedSync: true,
      // touched: true,
      errors,
      valid: expected && !!value,
      invalid: !expected,
    })

    return base
  }

  return reflectValidationResult(resolverArgs)(validationResult)
}
