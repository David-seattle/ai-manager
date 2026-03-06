import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Spinner, Text } from "@fluentui/react-components";
import { useWorkItem } from "../hooks/useWorkItem";
import type { Document } from "../types/api";

const DOC_TITLES: Record<string, string> = {
  functional: "Functional Requirements",
  "acceptance-criteria": "Acceptance Criteria",
  "technical-design": "Technical Design",
};

export default function DocumentPage() {
  const { docType } = useParams<{ docType: string }>();
  const { item } = useWorkItem();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;

    async function fetchDoc() {
      try {
        const url = `/api/ai_manager/documents.json?work_item_id=${item!.id}&doc_type=${docType}&_shape=array`;
        const res = await fetch(url);
        if (!res.ok) {
          if (!cancelled) setError(true);
          return;
        }
        const data: Document[] = await res.json();
        if (!cancelled) setDoc(data.length > 0 ? data[0] ?? null : null);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDoc();
    return () => {
      cancelled = true;
    };
  }, [item, docType]);

  const title = DOC_TITLES[docType ?? ""] ?? docType ?? "Document";

  if (loading) return <Spinner label="Loading..." />;
  if (error) {
    return (
      <Text block style={{ color: "red" }}>
        Failed to load document.
      </Text>
    );
  }
  if (!doc) {
    return (
      <div>
        <Text as="h1" size={700} weight="bold" block>
          {title}
        </Text>
        <Text block style={{ color: "#666" }}>
          No document available.
        </Text>
      </div>
    );
  }

  return (
    <div>
      <Text as="h1" size={700} weight="bold" block style={{ marginBottom: 16 }}>
        {title}
      </Text>
      <Markdown remarkPlugins={[remarkGfm]}>{doc.content}</Markdown>
    </div>
  );
}
