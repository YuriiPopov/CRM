export function UpdateRequiredScreen() {
  return (
    <section role="alert" className="update-required">
      <h1>Обновите страницу</h1>
      <p>Доступна новая версия приложения. Перезагрузите страницу, чтобы продолжить работу.</p>
      <button type="button" onClick={() => window.location.reload()}>
        Перезагрузить страницу
      </button>
    </section>
  )
}
