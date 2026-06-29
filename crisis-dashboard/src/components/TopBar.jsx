import { Radio, Bell } from "lucide-react";

export default function TopBar({ crumb, defconActive = true, notifications = 0 }) {
  return (
    <header className="topbar">
      <div className="topbar-crumb mono">{crumb}</div>

      <div className="topbar-defcon">
        <Radio size={13} strokeWidth={2.4} />
        <span>DEFCON-2 · Flood Response Active</span>
      </div>

      <div className="topbar-right">
        <button className="icon-btn" aria-label="Notifications">
          <Bell size={17} strokeWidth={1.8} />
          {notifications > 0 && <span className="badge-dot">{notifications}</span>}
        </button>
        <div className="user-chip">
          <div className="user-avatar">OK</div>
          <div>
            <div className="user-name">Ops Kavya</div>
            <div className="user-role">SENIOR COORDINATOR</div>
          </div>
        </div>
      </div>
    </header>
  );
}