import { createContext } from "react";
import type { WorkItem } from "../types/api";

export interface WorkItemContextValue {
  item: WorkItem | null;
  loading: boolean;
  error: string | null;
}

export const WorkItemContext = createContext<WorkItemContextValue>({
  item: null,
  loading: true,
  error: null,
});
