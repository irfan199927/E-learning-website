import { describe, expect, it } from "vitest";
import { formatRupees, upiPayLink } from "./payments";
import { decidePaymentSchema, paymentSettingsSchema, submitPaymentSchema } from "./schemas";

describe("manual UPI payments", () => {
  it("formats rupees and builds a UPI pay link", () => {
    expect(formatRupees(150_000)).toBe("₹1,500");
    expect(formatRupees(12_345_650)).toBe("₹1,23,456.50");
    expect(
      upiPayLink({
        upiId: "school@okaxis",
        payeeName: "Sunrise School",
        amountInPaise: 150_000,
        note: "Maths 9-A",
      }),
    ).toBe("upi://pay?pa=school%40okaxis&cu=INR&am=1500.00&tn=Maths%209-A&pn=Sunrise%20School");
  });

  it("validates settings, references and decisions", () => {
    expect(paymentSettingsSchema.parse({ upiId: "school@okaxis", phone: "" })).toEqual({
      upiId: "school@okaxis",
    });
    expect(paymentSettingsSchema.parse({ phone: "+91 98765 43210" })).toMatchObject({
      phone: "+919876543210",
    });
    expect(paymentSettingsSchema.safeParse({ upiId: "", phone: "" }).success).toBe(false);
    expect(paymentSettingsSchema.safeParse({ upiId: "not a upi id" }).success).toBe(false);
    expect(paymentSettingsSchema.safeParse({ phone: "12345" }).success).toBe(false);

    expect(submitPaymentSchema.parse({ reference: " 4123 5678 9012 " }).reference).toBe("412356789012");
    expect(submitPaymentSchema.safeParse({ reference: "abc" }).success).toBe(false);

    expect(decidePaymentSchema.safeParse({ decision: "approve" }).success).toBe(true);
    expect(decidePaymentSchema.safeParse({ decision: "reject" }).success).toBe(false);
    expect(decidePaymentSchema.safeParse({ decision: "reject", note: "No such UTR" }).success).toBe(true);
  });
});
