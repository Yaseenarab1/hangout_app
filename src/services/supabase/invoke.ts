import { supabase } from './client';

/**
 * Wrapper around supabase.functions.invoke that extracts the real error
 * body from the edge function response instead of swallowing it as
 * "Edge Function returned a non-2xx status code".
 */
export async function invokeFn<T = unknown>(
  name: string,
  body?: unknown,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    name,
    body !== undefined && body !== null ? { body: body as Record<string, unknown> } : undefined,
  );

  if (error) {
    let message = error.message;
    try {
      // FunctionsHttpError carries the raw Response on .context
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const json = await ctx.json();
        const base = json?.error ?? json?.message ?? message;
        const detail = json?.detail ? ` — ${JSON.stringify(json.detail).slice(0, 200)}` : '';
        message = base + detail;
      }
    } catch {
      // couldn't parse body — fall back to original message
    }
    console.error(`[edge:${name}]`, message);
    throw new Error(message);
  }

  // Some functions return { error: string } in a 200 body
  if (data?.error) {
    console.error(`[edge:${name}]`, data.error);
    throw new Error(data.error as string);
  }

  return data as T;
}
