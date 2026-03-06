import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

interface Props {
  workItemId: string;
}

export default function Layout({ workItemId }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          height: 48,
          background: "#106EBE",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600 }}>AI Manager</span>
        <span
          style={{
            fontSize: 13,
            opacity: 0.85,
            fontWeight: 400,
            marginLeft: 12,
          }}
        >
          Work Item: {workItemId}
        </span>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <Sidebar workItemId={workItemId} />
        <main style={{ flex: 1, overflow: "auto", padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
