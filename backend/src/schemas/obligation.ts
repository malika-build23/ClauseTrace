import { z } from "zod";

// Shared obligation schema (mirrors ai-service/app/schemas.py).
// Used to validate AI-service output before anything is stored.

export const Modality = z.enum(["must", "must_not", "may", "should"]);
export const Operator = z.enum([">=", ">", "<=", "<", "==", "!="]);
export const ObligationStatus = z.enum(["proposed", "approved", "edited", "rejected"]);

export const Threshold = z.object({
  metric: z.string().min(1),
  operator: Operator,
  value: z.number(),
  unit: z.string().min(1).nullable(),
});

export const Source = z.object({
  document: z.string().min(1),
  document_version: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  clause: z.string().min(1),
  page: z.number().int().positive(),
  quote: z.string().min(1),
});

export const ExtractedObligation = z
  .object({
    obligation_id: z.string().min(1),
    source: Source,
    subject: z.string().min(1),
    modality: Modality,
    action: z.string().min(1),
    condition: z.string().nullable(),
    threshold: Threshold.nullable(),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    evidence: z.string().nullable(),
    ambiguity_flag: z.boolean(),
    ambiguity_reason: z.string().nullable(),
    machine_checkable: z.boolean(),
    confidence: z.number().min(0).max(1),
    status: ObligationStatus.default("proposed"),
    approved_by: z.string().nullable().default(null),
    version: z.number().int().positive().default(1),
  })
  .superRefine((o, ctx) => {
    if (o.ambiguity_flag && !o.ambiguity_reason) {
      ctx.addIssue({ code: "custom", path: ["ambiguity_reason"], message: "required when ambiguity_flag is true" });
    }
    // machine_checkable only when something explicit can be checked.
    if (o.machine_checkable && !o.threshold && !o.deadline) {
      ctx.addIssue({
        code: "custom",
        path: ["machine_checkable"],
        message: "machine_checkable requires an explicit threshold or deadline",
      });
    }
  });

export type ExtractedObligation = z.infer<typeof ExtractedObligation>;
