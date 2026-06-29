import { Hammer } from "lucide-react";

export default function ComingSoon({ title, blurb }) {
  return (
    <div className="page">
      <div className="coming-soon">
        <Hammer size={28} strokeWidth={1.6} />
        <h2>{title}</h2>
        <p>{blurb || "This section isn't built yet — it's next on the roadmap."}</p>
      </div>
    </div>
  );
}