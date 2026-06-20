export default function EmptyState({ title, text }) {
  return (
    <div className="empty-state">
      <div className="orb-small" />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
