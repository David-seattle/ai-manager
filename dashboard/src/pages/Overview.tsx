import Markdown from "react-markdown";
import { useWorkItem } from "../hooks/useWorkItem";
import styles from "./Overview.module.css";

export default function Overview() {
  const { item } = useWorkItem();
  if (!item) return null;

  return (
    <div>
      <h1>{item.title}</h1>
      <div className={styles.meta}>
        {item.status && <span className={styles.badge}>Status: {item.status}</span>}
        {item.priority && <span className={styles.badge}>Priority: {item.priority}</span>}
        {item.assignee && <span className={styles.badge}>Assignee: {item.assignee}</span>}
        <span className={styles.badge}>ID: {item.id}</span>
      </div>
      {item.description && (
        <div className={styles.description}>
          <Markdown>{item.description}</Markdown>
        </div>
      )}
    </div>
  );
}
