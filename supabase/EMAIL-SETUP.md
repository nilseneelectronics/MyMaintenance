# Email setup for Vedlikeholdt

These changes are local source code until published. No SMTP passwords belong in this repository.

## Auth: verification and password reset

1. Create `noreply@vedlikeholdt.no` in cPanel.
2. Supabase → Authentication → Email → SMTP Settings: use the mailbox's exact outgoing hostname, port 465 (SSL/TLS), username `noreply@vedlikeholdt.no`, and its mailbox password. Sender email: `noreply@vedlikeholdt.no`; sender name: `Vedlikeholdt`.
3. Enable **Confirm email** for email/password signup in Supabase. This is enforced by Supabase, not only the page.
4. URL Configuration: Site URL `https://vedlikeholdt.no`; add the exact redirect URL `https://vedlikeholdt.no/pages/email-action.html` to the allowlist.
5. Publish `pages/email-action.html`, its CSS/JS, and the updated login/auth code before using the new email links.
6. In Confirm signup and Reset password email templates, keep the button linked to `{{ .ConfirmationURL }}`. The app supplies the redirect URL. Do not replace this with a plain link to the site; it must retain Supabase's verification token.

Auth has one SMTP configuration and default From address per project. Changing it switches Auth emails to the new mailbox; it does not create the mailbox or add another inbox. Use cPanel/Roundcube for receiving email.

## Family invitations

1. Run `supabase/family-invitations.sql` in the project's SQL editor. It creates protected invitation records and server-only reservation/acceptance functions. It does not grant access to homes/documents; those resources retain their existing RLS.
2. In **Edge Functions → Deploy a new function → Via Editor**, name the function `family-invitations`. Replace the template in `index.ts` with the supplied function code and click **Deploy function**. If the function already exists, edit it and deploy updates. In this function's settings, disable **Verify JWT with legacy secret** (gateway verification); this function performs its own user verification as explained below. For CLI deployment instead, from this repository:

   `supabase functions deploy family-invitations --project-ref nrmhojdkoxnlvssdksvf --no-verify-jwt`

   The function validates every caller with Supabase Auth's user endpoint and requires a verified email. Gateway JWT verification is disabled because verification is performed inside the function; anonymous callers are still rejected.
3. In **Edge Functions → Secrets**, enter these values directly. The invitation function does not inherit Authentication SMTP settings. Find the outgoing hostname in **cPanel → Email Accounts → Connect Devices** for your mailbox. Use its secure outgoing server hostname, not a guessed domain:

   | Secret | Value |
   | --- | --- |
   | `SMTP_HOST` | Exact cPanel outgoing hostname |
   | `SMTP_USER` | `noreply@vedlikeholdt.no` |
   | `SMTP_PASSWORD` | Mailbox password |
   | `SMTP_FROM` | `noreply@vedlikeholdt.no` |
   | `INVITE_HOURLY_LIMIT` | `5` initially; adjust only after the host raises its quota |

   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. Never expose the service-role key in website code.
4. Publish the updated profile code and shared profile/auth modules.

Only after SMTP accepts a message does its status become pending. The recipient must sign in or register with the invited email address and explicitly accept. Opening the invitation URL alone does not add a member. Links expire after seven days. Cancel an expired pending invitation before sending a new one. The owner can cancel an invitation or remove an accepted membership.

SMTP acceptance is not proof of inbox delivery. Check cPanel Track Delivery for rejected or delayed messages. Authentication messages and invitation emails share the hosting provider's domain quota, although Supabase Auth and the invitation function have separate rate counters. A timeout can leave delivery uncertain: check logs before retrying. If SMTP accepted a message but saving pending status failed, the link will not activate membership; inspect the record/logs before retrying.

Existing local-only family entries are retained for compatibility and never treated as emailed invitations. Pending invitations have no access-management controls. Accepted memberships are stored on the server; fine-grained family resource sharing still requires resource-specific RLS and is not granted by this migration.

## Verification before launch

- New signup: verify email is required; email button lands on the action page; resend works.
- Reset: generic request confirmation, expired-link handling, mismatch validation, successful Supabase password update.
- Invitation: send to a consenting test recipient; check pending status, wrong-account rejection, acceptance, refresh in the inviter's profile, cancellation, expiry, rate limit and SMTP failure.
- No local automated check proves inbox delivery or that the SQL migration has been applied. Run the above checks after deployment with the configured sender.

Sources: https://supabase.com/docs/guides/auth/auth-smtp and https://supabase.com/docs/guides/functions/limits . Hosted Edge Functions block outbound ports 25 and 587; this function uses TLS on 465.

Dashboard deployment reference: https://supabase.com/docs/guides/functions/quickstart-dashboard . Function configuration reference: https://supabase.com/docs/guides/functions/function-configuration .

