# GlobalRetail Checkout & Order Processing System Requirements

## 1. System Overview & User Roles
GlobalRetail is an omnichannel commerce platform. This specification outlines the checkout workflow, discount validation, order lifecycle transitions, and refund management.

The system defines four core operational roles:
- **Guest**: An unauthenticated shopper browsing and purchasing items.
- **Registered Customer**: An authenticated customer with saved billing, shipping profiles, and order history.
- **Admin**: Operations manager with full operational oversight, status overrides, and refund authorization.
- **Support Agent**: Customer support representative handling inquiries and initiating claims.

---

## 2. Cart Constraints & Limits
- **Item Quantity**: A shopping cart holds between 1 and 10 units per distinct item.
- **Item Variety**: A cart may contain a maximum of 20 distinct items.
- **Performance Expectation**: The system should respond quickly during item quantity adjustments in the cart.

| Field | Minimum Constraint | Maximum Constraint | Error Behavior |
| :--- | :--- | :--- | :--- |
| Units per Item | 1 unit | 10 units | Display validation alert if outside range |
| Distinct Line Items | 1 line item | 20 line items | Block addition of 21st item |
| Guest Order Total | $0.01 | $499.99 | Prompt registration for orders >= $500 |

---

## 3. Promotion & Coupon Rules
- **Coupon Application**: Only one coupon code may be applied per order.
- **Case Sensitivity**: Coupon codes are case-insensitive (e.g., `SAVE20` and `save20` are identical).
- **Minimum Order Value**: Coupons require a minimum order value of $25 before tax and shipping.
- **Expiration Policy**: Active coupons expire precisely at 23:59 UTC on their configured expiration date.
- If an invalid or expired coupon is applied, an appropriate error message is shown to the user.

---

## 4. Checkout & Payment Processing
- **Guest Checkout Eligibility**: Guest checkout is permitted strictly for orders with a grand total under $500. Orders totaling $500 or more require authentication as a Registered Customer.
- **Supported Payment Methods**:
  1. Credit / Debit Card (Visa, MasterCard, Amex)
  2. Unified Payments Interface (UPI)
  3. Digital Wallet
- **Security Lockout**: Three consecutive failed payment attempts lock the checkout payment step for 15 minutes. During this lockout period, subsequent payment submissions must be rejected.

---

## 5. Order State Lifecycle & Cancellation Rules
Orders progress through the following sequential states:
`Cart` -> `Pending Payment` -> `Paid` -> `Shipped` -> `Delivered`

- **Customer Cancellation**: Registered Customers may cancel their order only when the order is in `Pending Payment` or `Paid` status. Once the state transitions to `Shipped` or `Delivered`, customer cancellation is forbidden.
- **Admin Cancellation**: Administrators may cancel an order at any stage prior to `Shipped`.
- **Operational Override**: Admin can override an order status.

---

## 6. Returns & Refund Authorizations
- **Refund Initiation**: A Support Agent can initiate a refund request on behalf of a customer, but cannot approve it.
- **Refund Approval**: Only an Admin user can approve and issue a financial refund to the original payment method.
- Once approved, funds are returned to the originating payment instrument within 3-5 business days.

# Commit ref: 26
