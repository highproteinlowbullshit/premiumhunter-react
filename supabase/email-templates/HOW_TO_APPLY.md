# How to apply the email templates in Supabase

Templates in this directory are for version control only.
They must be pasted manually into the Supabase dashboard.

---

## 1. Confirm Signup (confirmation.html)

**Subject line:** `Confirm your Premium Hunter account — then read the guide`

1. Go to https://supabase.com and open the **premiumhunter** project
2. In the left sidebar click **Authentication**
3. Click **Email Templates** in the sub-menu
4. Select **Confirm signup** from the template dropdown
5. Delete all existing content in the template editor
6. Copy the entire contents of `confirmation.html`
7. Paste it into the template editor
8. Set the Subject line as shown above
9. Click **Save**

---

## 2. Magic Link (magic-link.html)

**Subject line:** `Your Premium Hunter sign-in link`

1. In the same Email Templates section, select **Magic Link** from the dropdown
2. Delete all existing content
3. Copy the entire contents of `magic-link.html`
4. Paste it into the template editor
5. Set the Subject line as shown above
6. Click **Save**

---

## 3. Password Reset (password-reset.html)

**Subject line:** `Reset your Premium Hunter password`

1. In the same Email Templates section, select **Reset Password** from the dropdown
2. Delete all existing content
3. Copy the entire contents of `password-reset.html`
4. Paste it into the template editor
5. Set the Subject line as shown above
6. Click **Save**

---

## Important notes

- The `{{ .ConfirmationURL }}` placeholder is automatically replaced by Supabase
  with the real confirmation, magic link, or password reset link. Do not change it.

- The Site URL must be set to `https://premiumhunter.xyz` under
  **Authentication → URL Configuration** for redirect links to work correctly
  in production. Add `http://localhost:5173` to the Redirect URLs allowlist
  for local development.

- Email templates in Supabase do not support external CSS, CSS classes, flexbox,
  or CSS grid. All three templates use inline styles and table-based layout only
  to ensure compatibility across Gmail, Apple Mail, Outlook, and mobile clients.

- To preview a template before saving, use the **Preview** button in the
  Supabase template editor (it renders the HTML with a sample URL injected).
