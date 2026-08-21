export function PageStub({ title, description }: { title: string; description?: string }) {
  return (
    <section>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      <p className="stub-note">Раздел в разработке.</p>
    </section>
  )
}
