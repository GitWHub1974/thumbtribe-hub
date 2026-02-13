

## Fix: Missing Profile and Project Assignment for Invited Users

### Problem Summary

When a user is invited, the `invite-user` edge function creates the user in `auth.users`, but the database trigger (`handle_new_user`) that should auto-create a `profiles` row sometimes fails silently. Since `client_projects.client_id` has a foreign key referencing `profiles.id`, the project assignment also fails. This leaves the user able to log in but with no profile and no data.

### Plan

#### 1. Fix the existing broken data (one-time)

Insert the missing profile for `stephenod74@gmail.com` and create their project assignment. This will be done via a data insert operation (not a migration).

#### 2. Make the `invite-user` edge function resilient

Update `supabase/functions/invite-user/index.ts` to explicitly ensure a profile exists after creating or finding the user, rather than relying solely on the database trigger. This prevents the issue from recurring.

Changes:
- After determining `newUserId`, upsert into the `profiles` table with the user's email and full name using the admin (service role) client
- Only then proceed to insert `user_roles` and `client_projects`

### Technical Details

**Data fix** (insert operation):
```sql
INSERT INTO profiles (id, email, full_name)
VALUES ('4c850dcb-606a-4d2a-b84f-921cc8c60a5c', 'stephenod74@gmail.com', '')
ON CONFLICT (id) DO NOTHING;

INSERT INTO client_projects (client_id, project_id)
VALUES ('4c850dcb-606a-4d2a-b84f-921cc8c60a5c', '1f98da34-8605-48e5-85bb-b2928fcf26f0')
ON CONFLICT DO NOTHING;
```
(The project ID `1f98da34-...` is the only project currently in the system.)

**Edge function change** (`invite-user/index.ts`):

After the block that determines `newUserId` (around line 141), add a profile upsert:

```typescript
// Ensure profile exists (trigger may have failed)
const { error: profileError } = await adminClient
  .from("profiles")
  .upsert(
    { id: newUserId, email: sanitizedEmail, full_name: sanitizedName },
    { onConflict: "id" }
  );
if (profileError) console.error("Profile upsert error:", profileError.message);
```

This guarantees the profile row exists before the `client_projects` insert, which has a foreign key dependency on `profiles.id`.

