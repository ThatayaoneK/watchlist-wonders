import { z } from "zod";

export const RequestContextSchema = z.object({
  requestId: z.string().uuid(),
}).strict();
export type RequestContext = z.infer<typeof RequestContextSchema>;
