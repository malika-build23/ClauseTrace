import { randomUUID } from "node:crypto";
import type { ParsedClause } from "./ai-client.js";

export type ClauseRow = {
  id: string;
  documentVersionId: string;
  clauseNumber: string;
  page: number;
  text: string;
  parentClauseId: string | null;
  position: number;
};

/**
 * Turn the AI service's clause list into DB rows, resolving each `parent`
 * clause number to the parent's generated id. Rows come back in document
 * order, so parents are always inserted before their children.
 */
export function buildClauseRows(documentVersionId: string, clauses: ParsedClause[]): ClauseRow[] {
  const ordered = [...clauses].sort((a, b) => a.position - b.position);
  const idByNumber = new Map<string, string>();
  return ordered.map((c, i) => {
    const id = randomUUID();
    if (!idByNumber.has(c.clause_number)) idByNumber.set(c.clause_number, id);
    const parentClauseId = c.parent ? (idByNumber.get(c.parent) ?? null) : null;
    return { id, documentVersionId, clauseNumber: c.clause_number, page: c.page, text: c.text, parentClauseId, position: i };
  });
}
