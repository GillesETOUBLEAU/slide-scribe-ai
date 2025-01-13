import { corsHeaders } from "../utils.ts";

export function createSuccessResponse(data: unknown) {
  return new Response(
    JSON.stringify({ success: true, data }),
    { headers: corsHeaders }
  );
}

export function createErrorResponse(error: Error, status = 500) {
  return new Response(
    JSON.stringify({
      error: 'Processing failed',
      details: error.message
    }),
    { 
      status,
      headers: corsHeaders
    }
  );
}

export function createCorsPreflightResponse() {
  return new Response(null, { 
    status: 204,
    headers: corsHeaders 
  });
}