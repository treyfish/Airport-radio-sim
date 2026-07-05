// Template rendering: "{callsign}, runway {rwy}, cleared for takeoff"
// Unknown variables render as "{name}" so validation/tests can spot them.

export type Env = Record<string, string>;

export function renderTemplate(template: string, env: Env): string {
  return template.replace(/\{([a-zA-Z0-9_:]+)\}/g, (whole, name: string) =>
    name in env ? env[name] : whole,
  );
}

export function templateVariables(template: string): string[] {
  const names: string[] = [];
  for (const m of template.matchAll(/\{([a-zA-Z0-9_:]+)\}/g)) {
    names.push(m[1]);
  }
  return names;
}
