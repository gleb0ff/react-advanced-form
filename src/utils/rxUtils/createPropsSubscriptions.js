import * as R from 'ramda'
import dispatch from '../dispatch'
import * as recordUtils from '../recordUtils'
import createRuleResolverArgs from '../validation/createRuleResolverArgs'
import makeObservable from './makeObservable'

/**
 * Creates Observable for the reactive props of the given field.
 * @param {Object} fieldProps
 * @param {Object} fields
 * @param {Object} form
 */
export default function createPropsSubscriptions({ fieldProps, fields, form }) {
  const { reactiveProps } = fieldProps
  if (!reactiveProps) return

  const subscriberFieldPath = fieldProps.fieldPath

  Object.keys(reactiveProps).forEach((propName) => {
    const resolver = reactiveProps[propName]

    makeObservable(resolver, createRuleResolverArgs({ fieldProps, fields, form }), {
      initialCall: true,
      // nextTargetRecord может быть не передан на initialCall — делаем дефолт-аргументы
      subscribe({ nextTargetRecord, shouldValidate = true } = {}) {
        const currFields = form.state.fields || {}

        // Текущая запись подписчика из state или исходная (fallback)
        const prevSubscriber = Array.isArray(subscriberFieldPath) ? R.path(subscriberFieldPath, currFields) : null
        const baseSubscriber = prevSubscriber || fieldProps

        // Если есть целевое поле-источник, временно «вшиваем» его в снапшот полей
        const targetPath = nextTargetRecord && nextTargetRecord.fieldPath
        const fieldsForResolver = Array.isArray(targetPath)
          ? R.assocPath(targetPath, nextTargetRecord, currFields)
          : currFields

        // Считаем следующее значение реактивного пропса на актуальном снапшоте
        const nextResolverArgs = createRuleResolverArgs({
          fieldProps: baseSubscriber,
          fields: fieldsForResolver,
          form,
        })

        const raw = dispatch(resolver, nextResolverArgs)

        // Нормализация типов
        const nextPropValue = propName === 'required' ? Boolean(raw) : raw

        // Пересобираем ПОЛНУЮ запись подписчика
        const nextSubscriberState = R.compose(
          recordUtils.resetValidityState,
          recordUtils.resetValidationState,
          R.assoc(propName, nextPropValue),
        )(baseSubscriber)

        // Кладём запись подписчика обратно в снапшот
        const fieldsWithSubscriber = Array.isArray(subscriberFieldPath)
          ? R.assocPath(subscriberFieldPath, nextSubscriberState, fieldsForResolver)
          : fieldsForResolver

        // Обновляем/валидируем именно полноценной записью (никаких «голых» патчей)
        if (shouldValidate) {
          return form.validateField({
            forceProps: true,
            fieldProps: nextSubscriberState,
            fields: fieldsWithSubscriber,
            form,
          })
        }

        return form.updateFieldsWith(nextSubscriberState)
      },
    })
  })
}
