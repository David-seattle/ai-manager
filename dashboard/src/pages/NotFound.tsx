import { Link } from "react-router-dom";
import { Text } from "@fluentui/react-components";

export default function NotFound() {
  return (
    <div style={{ padding: 32 }}>
      <Text as="h1" size={700} weight="bold" block style={{ marginBottom: 8 }}>
        Page not found
      </Text>
      <Text block style={{ color: "#666", marginBottom: 16 }}>
        The page you requested does not exist.
      </Text>
      <Link to="/" style={{ color: "#106EBE", textDecoration: "none" }}>
        Back to home
      </Link>
    </div>
  );
}
