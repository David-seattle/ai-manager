import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Text } from "@fluentui/react-components";

export default function Landing() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      navigate(`/workitem/${trimmed}`);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <header
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 48,
          background: "#106EBE",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600 }}>AI Manager</span>
      </header>

      <Text as="h1" size={900} weight="bold" style={{ marginBottom: 24 }}>
        AI Manager
      </Text>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 480, padding: "0 16px" }}>
        <Input
          type="text"
          value={query}
          onChange={(_e, d) => setQuery(d.value)}
          placeholder="Search work item by ID..."
          aria-label="Work item ID"
          style={{ width: "100%" }}
          size="large"
        />
      </form>
    </div>
  );
}
