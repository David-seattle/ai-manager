import { useContext } from "react";
import { WorkItemContext } from "../context/WorkItemContext";

export function useWorkItem() {
  return useContext(WorkItemContext);
}
