// Ambient types for Supabase Edge Functions (Deno Runtime) for IDE TypeScript checking

declare namespace Deno {
  export interface Env {
    get(key: string): string | undefined
    set(key: string, value: string): void
    has(key: string): boolean
    delete(key: string): void
    toObject(): Record<string, string>
  }
  export const env: Env
}

declare module 'https://deno.land/std@0.177.0/http/server.ts' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(supabaseUrl: string, supabaseKey: string, options?: any): any
}

declare module 'https://*' {
  const content: any
  export default content
  export const serve: any
  export const createClient: any
}

declare module 'npm:*' {
  const content: any
  export default content
}
