import Markdown from "react-markdown";
import { Text, Badge } from "@fluentui/react-components";
import { useWorkItem } from "../hooks/useWorkItem";

export default function Overview() {
  const { item } = useWorkItem();
  if (!item) return null;

  return (
    <div>
      <Text as="h1" size={700} weight="bold" block>
        {item.title}
      </Text>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          margin: "12px 0 24px",
        }}
      >
        {item.status && <Badge appearance="outline">Status: {item.status}</Badge>}
        {item.priority && <Badge appearance="outline">Priority: {item.priority}</Badge>}
        {item.assignee && <Badge appearance="outline">Assignee: {item.assignee}</Badge>}
        <Badge appearance="outline">ID: {item.id}</Badge>
      </div>
      {item.description && (
        <div style={{ lineHeight: 1.6, color: "#1a1a1a" }}>
          <Markdown>{item.description}</Markdown>
        </div>
      )}
    </div>
  );
}
