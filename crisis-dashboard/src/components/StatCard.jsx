export default function StatCard({ icon: Icon, label, value, sub, tone = "neutral" }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <Icon size={16} strokeWidth={2} className={`stat-icon stat-icon--${tone}`} />
      </div>
      <div className={`stat-value stat-value--${tone}`}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}