import type { DimensionCategory, DimensionDataType } from "./dimensionModel";

/**
 * Seed dimension set (v1) — ~50 core dimensions across all 9 categories.
 * The registry is extensible at runtime; this is the starting vocabulary
 * for character attributes and (later) population distributions.
 */

export interface SeedDimension {
  name: string;
  category: DimensionCategory;
  dataType: DimensionDataType;
  allowedValues?: string[];
  description: string;
}

const LEVELS_5 = ["very_low", "low", "medium", "high", "very_high"];

export const SEED_DIMENSIONS: SeedDimension[] = [
  // demographic (7)
  { name: "age", category: "demographic", dataType: "number", description: "Age in years" },
  { name: "gender", category: "demographic", dataType: "enum", allowedValues: ["male", "female", "nonbinary", "unspecified"], description: "Gender identity" },
  { name: "nationality", category: "demographic", dataType: "string", description: "Nationality / citizenship" },
  { name: "location", category: "demographic", dataType: "string", description: "Primary place of residence" },
  { name: "education_level", category: "demographic", dataType: "enum", allowedValues: ["none", "primary", "secondary", "bachelor", "master", "doctorate"], description: "Highest completed education" },
  { name: "marital_status", category: "demographic", dataType: "enum", allowedValues: ["single", "married", "divorced", "widowed", "partnered"], description: "Marital status" },
  { name: "household_size", category: "demographic", dataType: "number", description: "Number of people in household" },

  // professional (8)
  { name: "occupation", category: "professional", dataType: "string", description: "Job / profession" },
  { name: "job_title", category: "professional", dataType: "string", description: "Formal job title" },
  { name: "industry", category: "professional", dataType: "string", description: "Industry sector" },
  { name: "years_experience", category: "professional", dataType: "number", description: "Years of professional experience" },
  { name: "authority_level", category: "professional", dataType: "enum", allowedValues: LEVELS_5, description: "Decision-making authority at work" },
  { name: "income_bracket", category: "professional", dataType: "enum", allowedValues: ["low", "lower_middle", "middle", "upper_middle", "high"], description: "Income bracket" },
  { name: "employment_type", category: "professional", dataType: "enum", allowedValues: ["full_time", "part_time", "self_employed", "unemployed", "student", "retired"], description: "Employment type" },
  { name: "team_size", category: "professional", dataType: "number", description: "Size of team managed or worked in" },

  // psychological (10)
  { name: "openness", category: "psychological", dataType: "enum", allowedValues: LEVELS_5, description: "Big Five: openness to experience" },
  { name: "conscientiousness", category: "psychological", dataType: "enum", allowedValues: LEVELS_5, description: "Big Five: conscientiousness" },
  { name: "extraversion", category: "psychological", dataType: "enum", allowedValues: LEVELS_5, description: "Big Five: extraversion" },
  { name: "agreeableness", category: "psychological", dataType: "enum", allowedValues: LEVELS_5, description: "Big Five: agreeableness" },
  { name: "neuroticism", category: "psychological", dataType: "enum", allowedValues: LEVELS_5, description: "Big Five: neuroticism" },
  { name: "risk_tolerance", category: "psychological", dataType: "enum", allowedValues: LEVELS_5, description: "Willingness to take risks" },
  { name: "stress_tolerance", category: "psychological", dataType: "enum", allowedValues: LEVELS_5, description: "Ability to function under stress" },
  { name: "core_values", category: "psychological", dataType: "array", description: "Core personal values" },
  { name: "fears", category: "psychological", dataType: "array", description: "Significant fears / anxieties" },
  { name: "self_esteem", category: "psychological", dataType: "enum", allowedValues: LEVELS_5, description: "Self-esteem level" },

  // behavioral (8)
  { name: "communication_style", category: "behavioral", dataType: "enum", allowedValues: ["direct", "diplomatic", "analytical", "expressive", "reserved"], description: "Dominant communication style" },
  { name: "conflict_style", category: "behavioral", dataType: "enum", allowedValues: ["competing", "collaborating", "compromising", "avoiding", "accommodating"], description: "Thomas-Kilmann conflict mode" },
  { name: "decision_style", category: "behavioral", dataType: "enum", allowedValues: ["rational", "intuitive", "dependent", "avoidant", "spontaneous"], description: "Decision-making style" },
  { name: "leadership_style", category: "behavioral", dataType: "enum", allowedValues: ["authoritative", "democratic", "coaching", "pacesetting", "laissez_faire", "none"], description: "Leadership style if any" },
  { name: "work_style", category: "behavioral", dataType: "enum", allowedValues: ["structured", "flexible", "collaborative", "independent"], description: "Preferred way of working" },
  { name: "negotiation_style", category: "behavioral", dataType: "enum", allowedValues: ["hard", "soft", "principled"], description: "Negotiation approach" },
  { name: "habits", category: "behavioral", dataType: "array", description: "Notable recurring habits" },
  { name: "assertiveness", category: "behavioral", dataType: "enum", allowedValues: LEVELS_5, description: "Assertiveness level" },

  // social (6)
  { name: "social_role", category: "social", dataType: "string", description: "Role in social groups (e.g. mediator, leader)" },
  { name: "network_size", category: "social", dataType: "enum", allowedValues: ["isolated", "small", "moderate", "large", "very_large"], description: "Size of social network" },
  { name: "trust_propensity", category: "social", dataType: "enum", allowedValues: LEVELS_5, description: "Default tendency to trust others" },
  { name: "influence", category: "social", dataType: "enum", allowedValues: LEVELS_5, description: "Social influence over others" },
  { name: "group_orientation", category: "social", dataType: "enum", allowedValues: ["individualist", "collectivist", "mixed"], description: "Individual vs group orientation" },
  { name: "empathy", category: "social", dataType: "enum", allowedValues: LEVELS_5, description: "Empathy level" },

  // preference (5)
  { name: "interests", category: "preference", dataType: "array", description: "Hobbies and interests" },
  { name: "brand_loyalty", category: "preference", dataType: "enum", allowedValues: LEVELS_5, description: "Loyalty to preferred brands" },
  { name: "price_sensitivity", category: "preference", dataType: "enum", allowedValues: LEVELS_5, description: "Sensitivity to price" },
  { name: "quality_orientation", category: "preference", dataType: "enum", allowedValues: LEVELS_5, description: "Preference for quality over other factors" },
  { name: "novelty_seeking", category: "preference", dataType: "enum", allowedValues: LEVELS_5, description: "Preference for new experiences/products" },

  // capability (6)
  { name: "analytical_skill", category: "capability", dataType: "enum", allowedValues: LEVELS_5, description: "Analytical / problem-solving skill" },
  { name: "verbal_skill", category: "capability", dataType: "enum", allowedValues: LEVELS_5, description: "Verbal communication skill" },
  { name: "technical_skill", category: "capability", dataType: "enum", allowedValues: LEVELS_5, description: "General technical proficiency" },
  { name: "creativity", category: "capability", dataType: "enum", allowedValues: LEVELS_5, description: "Creative ability" },
  { name: "languages", category: "capability", dataType: "array", description: "Spoken languages" },
  { name: "domain_expertise", category: "capability", dataType: "array", description: "Areas of deep expertise" },

  // technology (4)
  { name: "tech_adoption", category: "technology", dataType: "enum", allowedValues: ["innovator", "early_adopter", "early_majority", "late_majority", "laggard"], description: "Technology adoption segment" },
  { name: "digital_literacy", category: "technology", dataType: "enum", allowedValues: LEVELS_5, description: "Digital literacy level" },
  { name: "primary_devices", category: "technology", dataType: "array", description: "Primary devices used" },
  { name: "ai_attitude", category: "technology", dataType: "enum", allowedValues: ["enthusiastic", "pragmatic", "skeptical", "resistant"], description: "Attitude toward AI tools" },

  // domain (4)
  { name: "domain_context", category: "domain", dataType: "string", description: "Domain-specific context tag (e.g. retail, healthcare)" },
  { name: "customer_segment", category: "domain", dataType: "string", description: "Domain-specific customer segment" },
  { name: "regulatory_awareness", category: "domain", dataType: "enum", allowedValues: LEVELS_5, description: "Awareness of domain regulations" },
  { name: "domain_tenure", category: "domain", dataType: "number", description: "Years active in the domain" },
];
