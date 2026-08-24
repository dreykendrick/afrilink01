import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Use anon key with user's Auth header to verify identity
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: User verification failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    let photoUrl: string | undefined;

    // Parse body only if method is POST/PUT and has content
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        photoUrl = body.photoUrl;
      } catch (err) {
        console.warn('Request body parse failed or is empty');
      }
    }

    // Use service role for database update (to bypass client revokes)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (photoUrl) {
      // Validate that photoUrl belongs to the user's own path in the verification-photos bucket
      try {
        const parsedUrl = new URL(photoUrl);
        const pathDecoded = decodeURIComponent(parsedUrl.pathname);

        const expectedPrefix = `/storage/v1/object/public/verification-photos/${userId}_`;
        const expectedPrefixFallback = `/storage/v1/object/public/verification-photos/${userId}.`;

        if (!pathDecoded.includes(expectedPrefix) && !pathDecoded.includes(expectedPrefixFallback)) {
          console.warn(`Path validation failed. Expected prefix matching ${userId} in path: ${pathDecoded}`);
          return new Response(
            JSON.stringify({ error: 'Forbidden: photo URL does not belong to the user' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (e) {
        return new Response(
          JSON.stringify({ error: 'Invalid photoUrl format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update profiles with verification photo details
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          verification_photo_url: photoUrl,
          photo_verified: false,
          verification_status: 'pending_review'
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      console.log(`Successfully updated verification photo for user ${userId}`);
    } else {
      // Re-verification status reset (no new photo)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          photo_verified: false,
          verification_status: 'pending'
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      console.log(`Successfully reset verification status to pending for user ${userId}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Submit verification photo error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
