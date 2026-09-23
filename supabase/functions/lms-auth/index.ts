import { createHandler } from './handler.js';

Deno.serve(createHandler({
  url: Deno.env.get('SUPABASE_URL') || '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
  anonKey: Deno.env.get('SUPABASE_ANON_KEY') || '',
  allowedOrigins: (Deno.env.get('LMS_ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean)
}));
