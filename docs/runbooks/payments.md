# Checking UPI payments

Paid courses use manual UPI (no gateway): students pay to the school's UPI ID or number and report the
transaction reference (UTR). Nothing is confirmed until an admin approves it.

## Daily check

1. Open **Admin → Payments**. **To check** lists reported payments, oldest first: student, course, amount, UPI
   reference (UTR), note and **View screenshot** if they attached one. Admins also get an in-app notification
   for each new report.
2. In your bank or UPI app, find a credit with that **UTR** and the **same amount**.
3. Found and the amount matches → **Approve**. The student is enrolled at once and notified.
4. Not found, or the amount is wrong → **Reject** with a reason the student will read, e.g. "No payment with this
   UTR — check the 12-digit number in your UPI app" or "Received ₹1,000, the course is ₹1,500". The student can
   report again.

## Special cases

- **Same UTR twice:** the app refuses a UTR that's already been reported (by anyone), so a payment can't be used
  for two enrolments. If a student says their UTR is "already used", look it up under Approved/Rejected.
- **Paid but reported the wrong number:** reject with a note; they report the right one.
- **Paid twice / refund needed:** refunds happen outside the app (your bank or UPI app). Note it in the
  rejection reason or keep your own record.
- **Price changed after they paid:** the report keeps the amount at the time they reported it.
- **Student removed from the course later:** approving a new payment re-enrols them.

## Settings

- **Where students pay:** Admin → Payments → UPI ID and/or UPI number, the name students see, instructions,
  and an optional QR code image. Without a UPI ID or number, paid courses can't be bought.
- **Price:** Edit course → Price (admins only). 0 makes the course free again (students ask to join instead).

## Records

Every setting change, report, approval and rejection is in `AuditLog` (`payment.*`, `course.price`). Payment rows
are deleted with a student's account if they ask for deletion (30-day purge): export what you need for your
accounts first.
