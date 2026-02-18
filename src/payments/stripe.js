const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const prisma = new PrismaClient();

async function handleStripeWebhook(req, res) {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            // Fulfillment
            await fulfillOrder(session);
            break;
        case 'customer.subscription.deleted':
            const subscription = event.data.object;
            await cancelSubscription(subscription);
            break;
        // ... handle other event types
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.send();
}

async function fulfillOrder(session) {
    const customerEmail = session.customer_details.email;
    const customerId = session.customer;

    // We need to link this to our user.
    // Ideally, we passed `client_reference_id` (chatId) when creating the session.
    // Or we use the email to match if we collected email locally (we didn't).
    // Or we use metadata.

    const chatId = session.client_reference_id || session.metadata.chatId;

    if (chatId) {
        await prisma.user.update({
            where: { telegram_chat_id: chatId },
            data: {
                subscription_status: 'active',
                stripe_customer_id: customerId
            }
        });
        console.log(`Subscription activated for ${chatId}`);
        // TODO: Send bot message confirming subscription
    } else {
        console.error("No chatId found in session metadata");
    }
}

async function cancelSubscription(subscription) {
    const customerId = subscription.customer;
    // Find user by stripe customer id
    // We need to add stripe_customer_id to unique index or findFirst
    const user = await prisma.user.findFirst({ where: { stripe_customer_id: customerId } });
    if (user) {
        await prisma.user.update({
            where: { id: user.id },
            data: { subscription_status: 'cancelled' }
        });
        console.log(`Subscription cancelled for ${user.telegram_chat_id}`);
    }
}

module.exports = { handleStripeWebhook };
