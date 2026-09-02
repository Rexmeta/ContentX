export class PIIRedactor {
  private static emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  private static creditCardRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
  private static phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/g;

  static redact(text: string): string {
    if (!text) return text;
    return text
      .replace(this.emailRegex, "[REDACTED_EMAIL]")
      .replace(this.creditCardRegex, "[REDACTED_CARD]")
      .replace(this.phoneRegex, "[REDACTED_PHONE]");
  }

  static redactObject<T>(obj: T): T {
    if (!obj || typeof obj !== "object") {
      if (typeof obj === "string") {
        return this.redact(obj) as unknown as T;
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactObject(item)) as unknown as T;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.redactObject(value);
    }
    return result as T;
  }
}
