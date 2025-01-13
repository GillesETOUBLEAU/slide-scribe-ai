const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

export function createSuccessResponse(data: unknown) {
  return new Response(
    JSON.stringify(data),
    { 
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
}

export function createErrorResponse(error: Error | unknown, status = 500) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
  console.error("Error response:", errorMessage);
  
  return new Response(
    JSON.stringify({
      error: 'Processing failed',
      message: errorMessage
    }),
    { 
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
}

export function createCorsPreflightResponse() {
  return new Response(
    null,
    { 
      status: 204,
      headers: corsHeaders
    }
  );
}