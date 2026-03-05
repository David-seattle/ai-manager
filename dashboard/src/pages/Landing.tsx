import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Landing.module.css";

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
    <div className={styles.container}>
      <h1 className={styles.title}>AI Manager</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search work item by ID..."
          className={styles.input}
          aria-label="Work item ID"
        />
      </form>
    </div>
  );
}
