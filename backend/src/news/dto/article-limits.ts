// Лимиты статьи (item89): исходный файл до 12 МБ, после санитизации и пережатия картинок — до 4 МБ
export const ARTICLE_SOURCE_MAX_BYTES = 12 * 1024 * 1024;
export const ARTICLE_RESULT_MAX_BYTES = 4 * 1024 * 1024;
// Лимит JSON-тела для POST /news и PATCH /news/:id: 12 МБ HTML + экранирование кавычек/переводов строк
export const NEWS_JSON_BODY_LIMIT = '16mb';
