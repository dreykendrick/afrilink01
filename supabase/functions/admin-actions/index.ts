import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminActionRequest {
  action: string;
  targetTable: string;
  targetId?: string;
  data?: Record<string, unknown>;
  notes?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify admin role - get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: userId });
    
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, targetTable, targetId, data, notes } = await req.json() as AdminActionRequest;

    let result;
    let oldData = null;
    let newData = null;

    switch (action) {
      case 'approve_product': {
        // Get current product data
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', targetId)
          .single();
        oldData = product;

        // Update product status
        const { data: updated, error } = await supabase
          .from('products')
          .update({ status: 'approved' })
          .eq('id', targetId)
          .select()
          .single();

        if (error) throw error;
        newData = updated;
        result = { success: true, product: updated };
        break;
      }

      case 'reject_product': {
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', targetId)
          .single();
        oldData = product;

        const { data: updated, error } = await supabase
          .from('products')
          .update({ status: 'rejected' })
          .eq('id', targetId)
          .select()
          .single();

        if (error) throw error;
        newData = updated;
        result = { success: true, product: updated };
        break;
      }

      case 'approve_takedown': {
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', targetId)
          .single();
        oldData = product;

        const { data: updated, error } = await supabase
          .from('products')
          .update({ status: 'taken_down' })
          .eq('id', targetId)
          .select()
          .single();

        if (error) throw error;
        newData = updated;
        result = { success: true, product: updated };
        break;
      }

      case 'reject_takedown': {
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', targetId)
          .single();
        oldData = product;

        const { data: updated, error } = await supabase
          .from('products')
          .update({ status: 'approved' })
          .eq('id', targetId)
          .select()
          .single();

        if (error) throw error;
        newData = updated;
        result = { success: true, product: updated };
        break;
      }

      case 'approve_application': {
        const { data: application } = await supabase
          .from('applications')
          .select('*')
          .eq('id', targetId)
          .single();
        oldData = application;

        // Update application status
        const { data: updated, error: appError } = await supabase
          .from('applications')
          .update({ status: 'approved' })
          .eq('id', targetId)
          .select()
          .single();

        if (appError) throw appError;

        // Add role to user_roles
        if (application) {
          await supabase
            .from('user_roles')
            .insert({
              user_id: application.user_id,
              role: application.role
            });

          // Create profile based on role
          if (application.role === 'vendor') {
            await supabase
              .from('vendor_profiles')
              .upsert({
                user_id: application.user_id,
                business_name: application.business_name
              });
          } else if (application.role === 'affiliate') {
            await supabase
              .from('affiliate_profiles')
              .upsert({
                user_id: application.user_id,
                display_name: application.full_name
              });
          }
        }

        newData = updated;
        result = { success: true, application: updated };
        break;
      }

      case 'reject_application': {
        const { data: application } = await supabase
          .from('applications')
          .select('*')
          .eq('id', targetId)
          .single();
        oldData = application;

        const { data: updated, error } = await supabase
          .from('applications')
          .update({ status: 'rejected' })
          .eq('id', targetId)
          .select()
          .single();

        if (error) throw error;
        newData = updated;
        result = { success: true, application: updated };
        break;
      }

      case 'process_withdrawal': {
        const { data: withdrawal } = await supabase
          .from('withdrawals')
          .select('*')
          .eq('id', targetId)
          .single();
        oldData = withdrawal;

        const newStatus = data?.status || 'approved';
        const { data: updated, error } = await supabase
          .from('withdrawals')
          .update({ status: newStatus })
          .eq('id', targetId)
          .select()
          .single();

        if (error) throw error;

        // If approved, deduct from wallet and create transaction
        if (newStatus === 'approved' && withdrawal) {
          await supabase
            .from('profiles')
            .update({ 
              wallet_balance: supabase.rpc('subtract_balance', { 
                user_id: withdrawal.user_id, 
                amount: withdrawal.amount 
              }) 
            })
            .eq('id', withdrawal.user_id);

          await supabase
            .from('transactions')
            .insert({
              user_id: withdrawal.user_id,
              amount: -withdrawal.amount,
              type: 'withdrawal',
              description: `Withdrawal processed via ${withdrawal.payment_method}`,
              reference_id: withdrawal.id
            });
        }

        newData = updated;
        result = { success: true, withdrawal: updated };
        break;
      }

      case 'update_order_status': {
        const { data: order } = await supabase
          .from('orders')
          .select('*')
          .eq('id', targetId)
          .single();
        oldData = order;

        const { data: updated, error } = await supabase
          .from('orders')
          .update({ status: data?.status })
          .eq('id', targetId)
          .select()
          .single();

        if (error) throw error;
        newData = updated;
        result = { success: true, order: updated };
        break;
      }

      case 'verify_user': {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetId)
          .single();
        oldData = profile;

        const { data: updated, error } = await supabase
          .from('profiles')
          .update({ 
            verification_status: 'verified',
            photo_verified: true 
          })
          .eq('id', targetId)
          .select()
          .single();

        if (error) throw error;
        newData = updated;
        result = { success: true, profile: updated };
        break;
      }

      case 'get_dashboard_stats': {
        const [
          { count: totalUsers },
          { count: totalVendors },
          { count: totalAffiliates },
          { count: totalProducts },
          { count: pendingProducts },
          { count: totalOrders },
          { count: pendingWithdrawals },
          { count: pendingApplications }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'vendor'),
          supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'affiliate'),
          supabase.from('products').select('*', { count: 'exact', head: true }),
          supabase.from('products').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('orders').select('*', { count: 'exact', head: true }),
          supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'pending')
        ]);

        result = {
          success: true,
          stats: {
            totalUsers,
            totalVendors,
            totalAffiliates,
            totalProducts,
            pendingProducts,
            totalOrders,
            pendingWithdrawals,
            pendingApplications
          }
        };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Log admin action (except for read-only actions)
    if (action !== 'get_dashboard_stats') {
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: userId,
          action_type: action,
          target_table: targetTable,
          target_id: targetId,
          old_data: oldData,
          new_data: newData,
          notes: notes
        });
    }

    console.log(`Admin action completed: ${action} by ${userId}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Admin action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
