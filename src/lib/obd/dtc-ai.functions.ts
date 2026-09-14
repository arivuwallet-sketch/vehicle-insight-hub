import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  code: z.string().regex(/^[PBCU][0-3][0-9A-F]{3}$/i, "Not a valid OBD-II fault code"),
  make: z.string().max(40).optional(),
  model: z.string().max(60).optional(),
  year: z.union([z.string(), z.number()]).optional(),
});

export interface DtcDetail {
  code: string;
  title: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  meaning: string;
  symptoms: string[];
  causes: string[];
  diagnosis: string[];
  repair: string[];
  driveable: string;
  vehicleNote?: string;
}

const SCHEMA = {
  name: "dtc_detail",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      code: { type: "string" },
      title: { type: "string" },
      severity: { type: "string", enum: ["info", "low", "medium", "high", "critical"] },
      meaning: { type: "string" },
      symptoms: { type: "array", items: { type: "string" } },
      causes: { type: "array", items: { type: "string" } },
      diagnosis: { type: "array", items: { type: "string" } },
      repair: { type: "array", items: { type: "string" } },
      driveable: { type: "string" },
      vehicleNote: { type: ["string", "null"] },
    },
    required: [
      "code",
      "title",
      "severity",
      "meaning",
      "symptoms",
      "causes",
      "diagnosis",
      "repair",
      "driveable",
      "vehicleNote",
    ],
  },
  strict: true,
} as const;

/**
 * Full workshop-manual style detail for any OBD-II fault code, including the
 * manufacturer-specific ranges the built-in library cannot enumerate.
 */
export const lookupDtcDetail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<DtcDetail> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI lookup is not configured for this project.");

    const code = data.code.toUpperCase();
    const car = [data.year, data.make, data.model].filter(Boolean).join(" ").trim();

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a master automotive diagnostic technician writing service-manual entries for OBD-II diagnostic trouble codes. Be accurate and specific to the exact code number. Use plain English a competent DIY mechanic understands, with real component names, typical measured values and test procedures in order of likelihood and cost. If the code is manufacturer-specific, say what it means on that make. Never invent a code definition you are unsure of — if the code is not standardised, say so in the meaning field and describe the range it belongs to.",
          },
          {
            role: "user",
            content: `Fault code: ${code}${car ? `\nVehicle: ${car}` : ""}\nGive the definition, symptoms, likely causes (most likely first), step-by-step diagnosis with the actual tests and specs to check, the repair steps, how severe it is and whether the car is safe to drive.`,
          },
        ],
        response_format: { type: "json_schema", json_schema: SCHEMA },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI lookup is busy right now — try again in a moment.");
      if (res.status === 402)
        throw new Error("The workspace is out of AI credits, so deep code lookups are paused.");
      if (res.status === 403) throw new Error("AI lookups are blocked by a workspace setting.");
      throw new Error(`AI lookup failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI lookup returned nothing for this code.");

    const parsed = JSON.parse(content) as DtcDetail;
    return { ...parsed, code };
  });
