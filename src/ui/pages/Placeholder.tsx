export function Placeholder({ title }: { title: string }) {
  return (
    <section className="page">
      <h1>{title}</h1>
      <p className="muted">Próximamente.</p>
    </section>
  );
}
