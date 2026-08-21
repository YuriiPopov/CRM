import axios from 'axios'

interface ApiErrorBody {
  message?: string | string[]
}

// Единая точка перевода ответов backend'а (Nest exception filter: {statusCode, message, error})
// в понятные пользователю русские сообщения — используется всеми экранами, не только календарём.
export function getApiErrorMessage(error: unknown, fallback = 'Не удалось выполнить действие'): string {
  if (!axios.isAxiosError(error)) {
    return fallback
  }

  const status = error.response?.status
  const body = error.response?.data as ApiErrorBody | undefined
  const rawMessage = Array.isArray(body?.message) ? body.message.join(', ') : body?.message

  if (status === 409) {
    if (rawMessage?.toLowerCase().includes('overlapping')) {
      return 'На это время у мастера уже есть запись — выберите другой слот.'
    }
    if (rawMessage?.toLowerCase().includes('transition')) {
      return 'Такой переход статуса недопустим для текущего состояния записи.'
    }
    if (rawMessage?.toLowerCase().includes('reschedule')) {
      return 'Эту запись нельзя перенести в её текущем статусе.'
    }
    if (rawMessage?.toLowerCase().includes('no longer available')) {
      return 'Этот слот уже заняли — выберите другое время.'
    }
    if (rawMessage?.toLowerCase().includes('already been erased')) {
      return 'Данные этого клиента уже были удалены/анонимизированы ранее.'
    }
    if (rawMessage?.toLowerCase().includes('already has a payment')) {
      return 'У этой записи уже есть оплата.'
    }
    if (rawMessage?.toLowerCase().includes('existing bookings')) {
      return 'У клиента есть записи — сначала удалите/анонимизируйте историю, либо используйте GDPR-удаление.'
    }
    return rawMessage ?? 'Действие конфликтует с текущим состоянием записи.'
  }

  if (status === 400) {
    return rawMessage ?? 'Проверьте правильность заполнения формы.'
  }

  if (status === 403) {
    return 'Недостаточно прав для этого действия.'
  }

  if (status === 404) {
    if (rawMessage?.toLowerCase().includes('does not offer')) {
      return 'Этот мастер не оказывает выбранную услугу.'
    }
    if (rawMessage?.toLowerCase().includes('client')) {
      return 'Клиент не найден.'
    }
    return rawMessage ?? 'Запись или связанные данные не найдены.'
  }

  if (status === 429) {
    return 'Слишком много запросов подряд — попробуйте через минуту.'
  }

  return rawMessage ?? fallback
}
