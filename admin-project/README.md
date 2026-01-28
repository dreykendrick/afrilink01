# AfriLink Admin Portal

Admin application for managing the AfriLink marketplace.

## Setup Instructions

1. **Create a new Lovable project** (WITHOUT enabling Cloud)

2. **Copy all files** from this `admin-project` folder to your new project

3. **Copy UI components** from the marketplace project:
   - `src/components/ui/` (all shadcn components)
   - `src/lib/utils.ts`
   - `src/hooks/use-toast.ts`

4. **Configure Supabase connection**:
   - Create a `.env` file in your project root:
   ```
   VITE_SUPABASE_URL=your_external_supabase_url
   VITE_SUPABASE_ANON_KEY=your_external_supabase_anon_key
   ```

5. **Install dependencies** (these should already be in package.json):
   - @supabase/supabase-js
   - @tanstack/react-query
   - react-router-dom
   - lucide-react

6. **Create an admin user**:
   - Sign up a user in your external Supabase
   - Add admin role in user_roles table:
   ```sql
   INSERT INTO user_roles (user_id, role) 
   VALUES ('your-user-id', 'admin');
   ```

## Features

- **Dashboard**: Overview stats of the platform
- **Products**: Approve/reject vendor products
- **Users**: View and manage user profiles
- **Applications**: Review vendor/affiliate applications
- **Orders**: View all customer orders
- **Withdrawals**: Process withdrawal requests

## Security

- Only users with `admin` role can access the portal
- Login validates admin role before granting access
