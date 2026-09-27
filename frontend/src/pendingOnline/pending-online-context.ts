import { createContext } from 'react'

export interface PendingOnlineCountContextValue {
  // Будущие онлайн-записи в статусе CREATED (item61); всегда 0 для MASTER — счётчик не грузится
  count: number
  // Внеплановое обновление — после «Подтвердить»/«Отклонить», не дожидаясь очередного опроса
  refresh: () => void
}

export const PendingOnlineCountContext = createContext<PendingOnlineCountContextValue | undefined>(undefined)
