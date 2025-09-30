import { MsdsSection, SectionKey } from "./msds-types";

// Load config for API settings
import { readFileSync } from 'fs';
let config: any = null;
try {
  config = JSON.parse(readFileSync('config.json', 'utf8'));
} catch (e) {
  console.warn('Could not load config.json, using environment variables');
}

const MODEL = config?.apiSettings?.llmModel || process.env.MSDS_LLM_MODEL || "mistral-large-latest";
const API_KEY = config?.apiSettings?.mistralApiKey || process.env.MSDS_LLM_API_KEY || "";

async function callLLMJson(prompt: string): Promise<any> {
  // Using Mistral API for JSON extraction
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { 
      "Authorization": `Bearer ${API_KEY}`, 
      "Content-Type": "application/json" 
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    })
  });
  
  if (!res.ok) {
    throw new Error(`LLM API error: ${res.status} ${res.statusText}`);
  }
  
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}

function sectionSchema(secKey: SectionKey) {
  // minimal schema per section; expand as needed
  switch (secKey) {
    case "s01_identification": return { manufacturer:"", address:"", tel:"", fax:"", email:"", emergency:"" };
    case "s02_hazards": return { ghs_classification:"", pictogram:"", signal_word:"", hazard_statements:[] as string[] };
    case "s03_composition": return { cas:"", einecs:"", synonym:"", purity:"" };
    case "s08_exposure_ppe": return { respiratory:"", eye_face:"", skin:"", exposure_limits:"" };
    case "s09_physchem": return { appearance:"", hygroscopicity:"", ph:"", melting_point_c:"", boiling_point_c:"", solubility:"" };
    case "s14_transport": return { un:"", proper_shipping_name:"", class:"", packing_group:"", notDangerousGoods:false };
    default: return {};
  }
}

export async function extractLLM(secKey: SectionKey, sec: MsdsSection): Promise<Partial<MsdsSection>> {
  const schema = sectionSchema(secKey);
  const prompt = [
    "Extract fields from the SDS section text into JSON. Rules:",
    "- Do NOT invent data. If absent, use empty string or false.",
    "- Preserve numerics and units (°C, pH, %, UN).",
    "- Return ONLY JSON matching the given schema keys.",
    "",
    "SCHEMA KEYS:",
    JSON.stringify(schema, null, 2),
    "",
    "SECTION TEXT:",
    "```",
    sec.raw || sec.text || "",
    "```"
  ].join("\n");

  try {
    const obj = await callLLMJson(prompt);
    return { fields: obj, text: sec.text };
  } catch (error) {
    console.warn(`LLM extraction failed for ${secKey}:`, error);
    return { fields: {}, text: sec.text };
  }
}
