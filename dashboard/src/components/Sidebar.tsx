import { NavLink } from "react-router-dom";
import {
  HomeRegular,
  DocumentRegular,
  CheckmarkCircleRegular,
  DesignIdeasRegular,
  QuestionCircleRegular,
  GavelRegular,
  ChatRegular,
  ArrowLeftRegular,
} from "@fluentui/react-icons";
import type { CSSProperties } from "react";

interface Props {
  workItemId: string;
}

const navStyle: CSSProperties = {
  width: 200,
  background: "#f3f3f3",
  borderRight: "1px solid #e0e0e0",
  padding: "12px 0",
  flexShrink: 0,
  overflowY: "auto",
};

const groupLabelStyle: CSSProperties = {
  display: "block",
  padding: "12px 20px 4px",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  color: "#888",
  letterSpacing: "0.05em",
};

function linkStyle(isActive: boolean): CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 20px",
    textDecoration: "none",
    color: isActive ? "#106EBE" : "#333",
    background: isActive ? "#e8f0fe" : "transparent",
    fontWeight: isActive ? 600 : 400,
    fontSize: 14,
  };
}

export default function Sidebar({ workItemId }: Props) {
  const base = `/workitem/${workItemId}`;

  return (
    <nav style={navStyle} aria-label="Work item navigation">
      <NavLink
        to="/"
        style={({ isActive }) => ({
          ...linkStyle(isActive),
          fontSize: 13,
          color: "#666",
          marginBottom: 4,
        })}
      >
        <ArrowLeftRegular />
        Back
      </NavLink>

      <NavLink
        to={`${base}/overview`}
        style={({ isActive }) => linkStyle(isActive)}
        end
      >
        <HomeRegular />
        Overview
      </NavLink>

      <span style={groupLabelStyle}>Requirements</span>
      <NavLink
        to={`${base}/doc/functional`}
        style={({ isActive }) => linkStyle(isActive)}
      >
        <DocumentRegular />
        Functional
      </NavLink>
      <NavLink
        to={`${base}/doc/acceptance-criteria`}
        style={({ isActive }) => linkStyle(isActive)}
      >
        <CheckmarkCircleRegular />
        Acceptance Criteria
      </NavLink>
      <NavLink
        to={`${base}/doc/technical-design`}
        style={({ isActive }) => linkStyle(isActive)}
      >
        <DesignIdeasRegular />
        Technical Design
      </NavLink>

      <NavLink
        to={`${base}/questions`}
        style={({ isActive }) => linkStyle(isActive)}
      >
        <QuestionCircleRegular />
        Questions
      </NavLink>
      <NavLink
        to={`${base}/decisions`}
        style={({ isActive }) => linkStyle(isActive)}
      >
        <GavelRegular />
        Decisions
      </NavLink>
      <NavLink
        to={`${base}/sessions`}
        style={({ isActive }) => linkStyle(isActive)}
      >
        <ChatRegular />
        Sessions
      </NavLink>
    </nav>
  );
}
