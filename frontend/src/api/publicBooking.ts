import { apiClient } from './client'

export interface AvailableSlot {
  startTime: string
  endTime: string
}

export interface AvailableSlotsResponse {
  date: string
  masterId: string
  serviceId: string
  slots: AvailableSlot[]
}

// Публичный, не требующий авторизации эндпоинт бэкенда — переиспользуем его же и для внутреннего
// календаря (создание записи админом/мастером), т.к. отдельного авторизованного аналога нет:
// расчёт свободных слотов (рабочие часы + overlap-логика) уже полностью реализован там.
export async function getAvailableSlots(
  masterId: string,
  serviceId: string,
  date: string,
): Promise<AvailableSlotsResponse> {
  const response = await apiClient.get<AvailableSlotsResponse>('/public/booking/slots', {
    params: { masterId, serviceId, date },
  })
  return response.data
}
