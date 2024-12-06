const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../config/database');
const { subscriptionPlans } = require('../../models/Subscription');

exports.getPlans = async (req, res) => {
    try {
        res.json(subscriptionPlans);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.createSubscription = async (req, res) => {
    try {
        const { planId, paymentMethodId } = req.body;
        const userId = req.userData.userId;

        // Get user
        const [users] = await db.execute(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );
        const user = users[0];

        // Create or get Stripe customer
        let customer;
        if (user.stripe_customer_id) {
            customer = await stripe.customers.retrieve(user.stripe_customer_id);
        } else {
            customer = await stripe.customers.create({
                email: user.email,
                payment_method: paymentMethodId,
                invoice_settings: {
                    default_payment_method: paymentMethodId,
                },
            });

            // Save Stripe customer ID
            await db.execute(
                'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
                [customer.id, userId]
            );
        }

        // Create subscription
        const subscription = await stripe.subscriptions.create({
            customer: customer.id,
            items: [{ price: planId }],
            expand: ['latest_invoice.payment_intent'],
        });

        // Save subscription details
        await db.execute(
            `INSERT INTO subscriptions (
                user_id, 
                stripe_subscription_id, 
                plan_id, 
                status
            ) VALUES (?, ?, ?, ?)`,
            [userId, subscription.id, planId, subscription.status]
        );

        res.json({
            subscriptionId: subscription.id,
            clientSecret: subscription.latest_invoice.payment_intent.client_secret,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.cancelSubscription = async (req, res) => {
    try {
        const userId = req.userData.userId;
        
        // Get subscription
        const [subscriptions] = await db.execute(
            'SELECT * FROM subscriptions WHERE user_id = ? AND status = "active"',
            [userId]
        );

        if (subscriptions.length === 0) {
            return res.status(404).json({ message: 'No active subscription found' });
        }

        // Cancel Stripe subscription
        await stripe.subscriptions.del(subscriptions[0].stripe_subscription_id);

        // Update subscription status
        await db.execute(
            'UPDATE subscriptions SET status = "cancelled" WHERE id = ?',
            [subscriptions[0].id]
        );

        res.json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
}; 