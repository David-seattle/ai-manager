import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div>
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link to="/">Back to home</Link>
    </div>
  );
}
