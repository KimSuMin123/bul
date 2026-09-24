import { createSmsHandler } from './handler.js';
Deno.serve(createSmsHandler({
 url:Deno.env.get('SUPABASE_URL') || '',serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
 workerSecret:Deno.env.get('LMS_SMS_WORKER_SECRET') || '',provider:Deno.env.get('LMS_SMS_PROVIDER') || 'mock',
 apiKey:Deno.env.get('SOLAPI_API_KEY') || '',apiSecret:Deno.env.get('SOLAPI_API_SECRET') || '',
 sender:Deno.env.get('LMS_SMS_SENDER') || '01047020283',adminPhone:Deno.env.get('LMS_SMS_ADMIN_PHONE') || '01080287565',
 testPhone:Deno.env.get('LMS_SMS_TEST_PHONE') || '',
 siteUrl:Deno.env.get('LMS_SITE_URL') || ''
}));
