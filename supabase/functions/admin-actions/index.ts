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

// Helper function to create notifications
async function createNotification(
  supabase: any, 
  userId: string, 
  title: string, 
  message: string, 
  type: string = 'info',
  link?: string
) {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type,
        link,
        read: false
      });
    
    if (error) {
      console.error('Failed to create notification:', error);
    } else {
      console.log(`Notification created for user ${userId}: ${title}`);
    }
  } catch (err) {
    console.error('Notification creation error:', err);
  }
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Use anon key with auth header for admin verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Use service role for database operations (to bypass RLS for notifications)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role - get user from token
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const adminUserId = user.id;

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: adminUserId });
    
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

        // Send notification to vendor
        if (product?.vendor_id) {
          await createNotification(
            supabase,
            product.vendor_id,
            '🎉 Product Approved!',
            `Your product "${product.title}" has been approved and is now live on the marketplace.`,
            'success',
            '/dashboard'
          );
        }
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

        // Send notification to vendor
        if (product?.vendor_id) {
          const reason = notes || 'Please review our product guidelines and resubmit.';
          await createNotification(
            supabase,
            product.vendor_id,
            '❌ Product Not Approved',
            `Your product "${product.title}" was not approved. Reason: ${reason}`,
            'error',
            '/dashboard'
          );
        }
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

        // Send notification to vendor
        if (product?.vendor_id) {
          await createNotification(
            supabase,
            product.vendor_id,
            '⚠️ Product Taken Down',
            `Your product "${product.title}" has been removed from the marketplace. ${notes || 'Please contact support for more details.'}`,
            'warning',
            '/dashboard'
          );
        }
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

        // Send notification to vendor
        if (product?.vendor_id) {
          await createNotification(
            supabase,
            product.vendor_id,
            '✅ Takedown Request Rejected',
            `The takedown request for "${product.title}" was rejected. Your product remains live on the marketplace.`,
            'info',
            '/dashboard'
          );
        }
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

          // Send notification to user
          const roleLabel = application.role === 'vendor' ? 'Vendor' : 'Affiliate';
          await createNotification(
            supabase,
            application.user_id,
            `🎉 ${roleLabel} Application Approved!`,
            `Congratulations! Your ${roleLabel.toLowerCase()} application has been approved. You can now access your ${roleLabel.toLowerCase()} dashboard.`,
            'success',
            '/dashboard'
          );
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

        // Send notification to user
        if (application) {
          const roleLabel = application.role === 'vendor' ? 'Vendor' : 'Affiliate';
          const reason = notes || 'Please ensure all requirements are met and try again.';
          await createNotification(
            supabase,
            application.user_id,
            `❌ ${roleLabel} Application Not Approved`,
            `Your ${roleLabel.toLowerCase()} application was not approved. Reason: ${reason}`,
            'error',
            undefined
          );
        }
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
          // Get current balance and update
          const { data: profile } = await supabase
            .from('profiles')
            .select('wallet_balance')
            .eq('id', withdrawal.user_id)
            .single();

          if (profile) {
            const newBalance = (profile.wallet_balance || 0) - withdrawal.amount;
            await supabase
              .from('profiles')
              .update({ wallet_balance: newBalance })
              .eq('id', withdrawal.user_id);
          }

          await supabase
            .from('transactions')
            .insert({
              user_id: withdrawal.user_id,
              amount: -withdrawal.amount,
              type: 'withdrawal',
              description: `Withdrawal processed via ${withdrawal.payment_method}`,
              reference_id: withdrawal.id
            });

          // Send approval notification
          await createNotification(
            supabase,
            withdrawal.user_id,
            '💰 Withdrawal Approved!',
            `Your withdrawal of ${withdrawal.amount} TZS has been approved and will be processed via ${withdrawal.payment_method}.`,
            'success',
            '/dashboard'
          );
        } else if (newStatus === 'rejected' && withdrawal) {
          // Send rejection notification
          const reason = notes || 'Please contact support for more details.';
          await createNotification(
            supabase,
            withdrawal.user_id,
            '❌ Withdrawal Rejected',
            `Your withdrawal request of ${withdrawal.amount} TZS was rejected. Reason: ${reason}`,
            'error',
            '/dashboard'
          );
        }

        newData = updated;
        result = { success: true, withdrawal: updated };
        break;
      }

      case 'update_order_status': {
        const { data: order } = await supabase
          .from('orders')
          .select('*, order_items(*, products(vendor_id, title))')
          .eq('id', targetId)
          .single();
        oldData = order;

        const newOrderStatus = data?.status as string;
        const { data: updated, error } = await supabase
          .from('orders')
          .update({ status: newOrderStatus })
          .eq('id', targetId)
          .select()
          .single();

        if (error) throw error;
        newData = updated;
        result = { success: true, order: updated };

        // Notify vendors about order status changes
        if (order?.order_items) {
          const vendorIds = new Set<string>();
          order.order_items.forEach((item: any) => {
            if (item.products?.vendor_id) {
              vendorIds.add(item.products.vendor_id);
            }
          });

          for (const vendorId of vendorIds) {
            await createNotification(
              supabase,
              vendorId,
              `📦 Order Status Updated`,
              `Order #${order.id.slice(0, 8)} status changed to: ${newOrderStatus}`,
              'info',
              '/dashboard'
            );
          }
        }
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

        // Send verification approved notification
        await createNotification(
          supabase,
          targetId!,
          '✅ Verification Approved!',
          'Your identity has been verified successfully. You now have full access to all platform features.',
          'success',
          '/dashboard'
        );
        break;
      }

      case 'reject_verification': {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', targetId)
          .single();
        oldData = profile;

        const { data: updated, error } = await supabase
          .from('profiles')
          .update({ 
            verification_status: 'rejected',
            photo_verified: false 
          })
          .eq('id', targetId)
          .select()
          .single();

        if (error) throw error;
        newData = updated;
        result = { success: true, profile: updated };

        // Send verification rejected notification
        const reason = notes || 'Please ensure your photo is clear and matches our guidelines.';
        await createNotification(
          supabase,
          targetId!,
          '❌ Verification Not Approved',
          `Your identity verification was not approved. Reason: ${reason}. Please resubmit your verification photo.`,
          'error',
          '/dashboard/settings'
        );
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
          admin_id: adminUserId,
          action_type: action,
          target_table: targetTable,
          target_id: targetId,
          old_data: oldData,
          new_data: newData,
          notes: notes
        });
    }

    console.log(`Admin action completed: ${action} by ${adminUserId}`);

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
