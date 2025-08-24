import * as R from 'ramda'
import { fromEvent } from 'rxjs/internal/observable/fromEvent'
import camelize from '../camelize'
import * as recordUtils from '../recordUtils'
import createPropsObserver from './createPropsObserver'
import flushFieldRefs from '../flushFieldRefs'

/**
 * refs: Array<Array<string>>
 * Пример: [ ['password','value'], ['login','type'] ]
 * Превращаем в { 'password': ['value'], 'login': ['type'] }
 */
const formatRefs = (fieldsRefs) => {
  return (fieldsRefs || []).reduce((acc, ref) => {
    // ожидаем массив с минимум двумя элементами: [...fieldPath, propName]
    if (!Array.isArray(ref) || ref.length < 2) return acc

    const fieldPath = ref.slice(0, -1)
    const joinedFieldPath = fieldPath.join('.')
    if (!joinedFieldPath) return acc

    const rawPropName = ref[ref.length - 1]
    const propName = typeof rawPropName === 'string' ? rawPropName : String(rawPropName || '')
    if (!propName) return acc

    const prevPropsList = acc[joinedFieldPath] || []
    acc[joinedFieldPath] = prevPropsList.includes(propName) ? prevPropsList : prevPropsList.concat(propName)

    return acc
  }, {})
}

/**
 * Shorthand
 */
function createObserver({ targetFieldPath, props, form, subscribe, observerOptions }) {
  return createPropsObserver({
    targetFieldPath,
    props,
    predicate({ propName, prevTargetRecord, nextTargetRecord }) {
      return prevTargetRecord[propName] !== nextTargetRecord[propName]
    },
    getNextValue({ propName, nextTargetRecord }) {
      return nextTargetRecord[propName]
    },
    eventEmitter: form.eventEmitter,
    ...observerOptions,
  }).subscribe(subscribe) // возвращается Subscription
}

/**
 * Делает метод «наблюдаемым»
 */
export default function makeObservable(method, methodArgs, { initialCall = false, subscribe, observerOptions }) {
  const { fieldProps: subscriberProps, fields, form } = methodArgs

  const flushed = flushFieldRefs(method, methodArgs)
  const refs = Array.isArray(flushed?.refs) ? flushed.refs : []
  const { initialValue } = flushed || {}

  const formattedTargetRefs = formatRefs(refs)

  R.toPairs(formattedTargetRefs).forEach(([joinedFieldPath, props]) => {
    const targetFieldPath = joinedFieldPath ? joinedFieldPath.split('.') : []

    // если путь пустой — пропускаем
    if (targetFieldPath.length === 0) return

    // валидируем подписчика только когда у него есть значение
    const shouldValidate = !!recordUtils.getValue(subscriberProps)
    const isTargetRegistered = R.path(targetFieldPath, fields)

    if (isTargetRegistered) {
      if (initialCall && typeof subscribe === 'function') {
        subscribe({
          nextTargetRecord: subscriberProps,
          shouldValidate,
        })
      }

      return
    }

    const fieldRegisteredEvent = camelize(...targetFieldPath, 'registered')
    const delegated = fromEvent(form.eventEmitter, fieldRegisteredEvent).subscribe((delegatedFieldProps) => {
      delegated.unsubscribe()
      const sub = createObserver({ targetFieldPath, props, form, subscribe, observerOptions })

      if (typeof subscribe === 'function') {
        subscribe({
          nextTargetRecord: delegatedFieldProps,
          shouldValidate,
        })
      }
    })
  })

  return { refs, initialValue }
}
