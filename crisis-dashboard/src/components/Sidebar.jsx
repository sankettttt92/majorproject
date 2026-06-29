import { NavLink } from "react-router-dom";
import {
  ShieldCheck, LayoutGrid, AlertTriangle, Truck, Activity,
  Route as RouteIcon, Bot, Smartphone, Circle,
} from "lucide-react";

const opsItems = [
  { to: "/", label: "Command Dashboard", icon: LayoutGrid, end: true },
  { to: "/incidents", label: "Incident Queue", icon: AlertTriangle },
  { to: "/resources", label: "Resource Center", icon: Truck },
  { to: "/missions", label: "Mission Coordination", icon: Activity },
  { to: "/route-optimization", label: "Route Optimization", icon: RouteIcon, disabled: true },
  { to: "/ai-agents", label: "AI Agents", icon: Bot, disabled: true },
];

const fieldItems = [
  { to: "/victim-app", label: "Victim App Preview", icon: Smartphone },
];

function NavItem({ item }) {
  const Icon = item.icon;
  if (item.disabled) {
    return (
      <div className="nav-item nav-item--disabled" title="Coming soon">
        <Icon size={17} strokeWidth={1.8} />
        <span>{item.label}</span>
        <span className="nav-soon">SOON</span>
      </div>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => "nav-item" + (isActive ? " nav-item--active" : "")}
    >
      <Icon size={17} strokeWidth={1.8} />
      <span>{item.label}</span>
    </NavLink>
  );
}

export default function Sidebar({ connected }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <ShieldCheck size={22} strokeWidth={2} color="var(--accent-red)" />
        <div>
          <div className="brand-title">CRISIS CONNECT</div>
          <div className="brand-sub">OPERATIONS CENTER</div>
        </div>
      </div>

      <div className="nav-section">
        <div className="nav-label">OPERATIONS</div>
        {opsItems.map((item) => <NavItem key={item.label} item={item} />)}
      </div>

      <div className="nav-section">
        <div className="nav-label">FIELD</div>
        {fieldItems.map((item) => <NavItem key={item.label} item={item} />)}
      </div>

      <div className="sidebar-footer">
        <span className="mono">v2.4.1</span>
        <span className="status-chip">
          <Circle size={8} fill={connected ? "#1A8754" : "#D93A3A"} color={connected ? "#1A8754" : "#D93A3A"} />
          {connected ? "LIVE" : "OFFLINE"}
        </span>
      </div>
    </aside>
  );
}