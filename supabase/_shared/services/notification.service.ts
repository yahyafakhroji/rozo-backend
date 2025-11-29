/**
 * Notification Service
 * Firebase push notifications and Pusher real-time notifications
 */

import {
  initializeApp,
  cert,
  getApps,
  App,
} from "npm:firebase-admin@12.0.0/app";
import {
  getMessaging,
  Message,
  MulticastMessage,
} from "npm:firebase-admin@12.0.0/messaging";
import Pusher from "npm:pusher";

let firebaseApp: App | null = null;

// ============================================================================
// Firebase Push Notifications
// ============================================================================

/**
 * Initialize Firebase Admin SDK (singleton pattern)
 */
export function initFirebase(): App {
  if (firebaseApp && getApps().length > 0) {
    return firebaseApp;
  }

  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase configuration. " +
        "Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY environment variables",
    );
  }

  firebaseApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });

  console.log("Firebase initialized from environment variables");
  return firebaseApp;
}

/**
 * Send push notification to a single device
 */
export async function sendNotificationToDevice(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<string> {
  const messaging = getMessaging(initFirebase());

  const message: Message = {
    token: fcmToken,
    notification: {
      title,
      body,
    },
    data: data || {},
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
        },
      },
    },
    android: {
      priority: "high",
      notification: {
        sound: "default",
      },
    },
  };

  return await messaging.send(message);
}

/**
 * Send push notification to multiple devices (batch operation)
 */
export async function sendNotificationToDevices(
  fcmTokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  if (fcmTokens.length === 0) {
    return null;
  }

  const messaging = getMessaging(initFirebase());

  const message: MulticastMessage = {
    tokens: fcmTokens,
    notification: {
      title,
      body,
    },
    data: data || {},
    apns: {
      payload: {
        aps: {
          alert: {
            title: title,
            body: body,
          },
          sound: "default",
          badge: 1,
        },
      },
      headers: {
        "apns-priority": "10",
      },
    },
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "rozo-notifications",
      },
    },
  };

  return await messaging.sendEachForMulticast(message);
}

// ============================================================================
// Pusher Real-time Notifications
// ============================================================================

let pusherClient: Pusher | null = null;

/**
 * Get or create Pusher client
 */
function getPusherClient(): Pusher {
  if (pusherClient) {
    return pusherClient;
  }

  const appId = Deno.env.get("PUSHER_APP_ID");
  const key = Deno.env.get("PUSHER_KEY");
  const secret = Deno.env.get("PUSHER_SECRET");
  const cluster = Deno.env.get("PUSHER_CLUSTER") || "ap1";

  if (!appId || !key || !secret) {
    throw new Error(
      "Missing Pusher configuration. " +
        "Set PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET environment variables",
    );
  }

  pusherClient = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  });

  return pusherClient;
}

/**
 * Send real-time notification via Pusher
 */
export async function pushNotification(
  merchantId: string,
  event: string,
  data: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const pusher = getPusherClient();
    const channelName = `merchant-${merchantId}`;

    await pusher.trigger(channelName, event, data);

    return { success: true };
  } catch (error) {
    console.error("Pusher notification error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send payment notification to merchant's devices
 */
export async function sendPaymentNotification(
  supabase: unknown,
  merchantId: string,
  order: {
    order_id?: string;
    deposit_id?: string;
    number: string;
    display_currency: string;
    display_amount: number;
  },
): Promise<void> {
  try {
    // Type assertion for supabase client
    const db = supabase as {
      from: (table: string) => {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => Promise<{ data: { fcm_token: string }[] | null; error: unknown }>;
        };
      };
    };

    const { data: devices, error: devicesError } = await db
      .from("devices")
      .select("fcm_token")
      .eq("merchant_id", merchantId);

    if (devicesError || !devices || devices.length === 0) {
      console.error("Failed to fetch devices:", devicesError);
      return;
    }

    const tokens = devices.map((d) => d.fcm_token);
    const orderId = order.order_id || order.deposit_id || "";

    const result = await sendNotificationToDevices(
      tokens,
      "Payment Received",
      `You received ${order.display_currency} ${order.display_amount} from Order #${order.number}`,
      {
        orderId,
        type: "PAYMENT_RECEIVED",
        action: "OPEN_BALANCE",
        deepLink: "rozo://balance",
      },
    );

    if (result?.failureCount && result.failureCount > 0) {
      console.log(
        `Failed to send to ${result.failureCount} devices:`,
        JSON.stringify(result.responses),
      );
    }
  } catch (error) {
    console.error("Failed to send notification:", error);
  }
}
