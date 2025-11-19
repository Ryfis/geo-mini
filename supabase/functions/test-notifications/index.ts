Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        
        const testUserId = '69ed70c5-cdc1-448d-a7ad-724bc70a77f9';

        // Test HEAD request to count unread messages
        const countResponse = await fetch(`${supabaseUrl}/rest/v1/private_messages?receiver_id=eq.${testUserId}&read=eq.false&select=*`, {
            method: 'HEAD',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'count=exact'
            }
        });

        const countHeader = countResponse.headers.get('content-range');
        console.log('Count header:', countHeader);
        
        // Also test as GET request to see actual data
        const selectResponse = await fetch(`${supabaseUrl}/rest/v1/private_messages?receiver_id=eq.${testUserId}&read=eq.false&select=*`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        const messages = await selectResponse.json();
        console.log('Messages:', messages);

        // Test friendships count
        const friendCountResponse = await fetch(`${supabaseUrl}/rest/v1/friendships?friend_id=eq.${testUserId}&status=eq.pending&select=*`, {
            method: 'HEAD',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'count=exact'
            }
        });

        const friendCountHeader = friendCountResponse.headers.get('content-range');
        console.log('Friend count header:', friendCountHeader);

        const result = {
            data: {
                unreadMessages: {
                    countHeader,
                    messagesCount: messages.length,
                    messages
                },
                friendRequests: {
                    countHeader: friendCountHeader
                },
                timestamp: new Date().toISOString()
            }
        };

        return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Test notifications error:', error);

        const errorResponse = {
            error: {
                code: 'TEST_NOTIFICATIONS_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});