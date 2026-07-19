package com.almawaid.myapp;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.view.animation.AccelerateInterpolator;
import android.view.animation.DecelerateInterpolator;
import androidx.core.splashscreen.SplashScreen;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private BroadcastReceiver actionReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);

        super.onCreate(savedInstanceState);

        splash.setOnExitAnimationListener(splashView -> {
            if (splashView.getIconView() == null) {
                splashView.remove();
                return;
            }

            // Pulse: brief scale-up and back
            ObjectAnimator pulseUp = ObjectAnimator.ofFloat(
                splashView.getIconView(), "scaleX", 1f, 1.08f);
            ObjectAnimator pulseUpY = ObjectAnimator.ofFloat(
                splashView.getIconView(), "scaleY", 1f, 1.08f);
            ObjectAnimator pulseDown = ObjectAnimator.ofFloat(
                splashView.getIconView(), "scaleX", 1.08f, 1f);
            ObjectAnimator pulseDownY = ObjectAnimator.ofFloat(
                splashView.getIconView(), "scaleY", 1.08f, 1f);

            pulseUp.setDuration(200L);
            pulseUpY.setDuration(200L);
            pulseDown.setDuration(200L);
            pulseDownY.setDuration(200L);

            DecelerateInterpolator easeOut = new DecelerateInterpolator();
            AccelerateInterpolator easeIn = new AccelerateInterpolator();
            pulseUp.setInterpolator(easeOut);
            pulseUpY.setInterpolator(easeOut);
            pulseDown.setInterpolator(easeIn);
            pulseDownY.setInterpolator(easeIn);

            AnimatorSet pulseSet = new AnimatorSet();
            pulseSet.play(pulseUp).with(pulseUpY);
            pulseSet.play(pulseDown).with(pulseDownY).after(pulseUp);

            // Exit: scale down + fade out
            ObjectAnimator exitScaleX = ObjectAnimator.ofFloat(
                splashView.getIconView(), "scaleX", 1f, 0.8f);
            ObjectAnimator exitScaleY = ObjectAnimator.ofFloat(
                splashView.getIconView(), "scaleY", 1f, 0.8f);
            ObjectAnimator fadeOut = ObjectAnimator.ofFloat(
                splashView.getIconView(), "alpha", 1f, 0f);

            long exitDuration = 350L;
            exitScaleX.setDuration(exitDuration);
            exitScaleY.setDuration(exitDuration);
            fadeOut.setDuration(exitDuration);

            AccelerateInterpolator exitInterpolator = new AccelerateInterpolator();
            exitScaleX.setInterpolator(exitInterpolator);
            exitScaleY.setInterpolator(exitInterpolator);
            fadeOut.setInterpolator(exitInterpolator);

            AnimatorSet exitSet = new AnimatorSet();
            exitSet.play(exitScaleX).with(exitScaleY).with(fadeOut);

            fadeOut.addListener(new AnimatorListenerAdapter() {
                @Override
                public void onAnimationEnd(Animator animation) {
                    splashView.remove();
                }
            });

            // Run pulse then exit
            AnimatorSet total = new AnimatorSet();
            total.playSequentially(pulseSet, exitSet);
            total.start();
        });

        createNotificationChannels();
        registerActionReceiver();
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        unregisterActionReceiver();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // Handle notification tap when app is already running
        handleNotificationIntent(intent);
    }

    private void registerActionReceiver() {
        actionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                String url = intent.getStringExtra("url");
                String notificationId = intent.getStringExtra("notification_id");

                if ("ACTION_OPEN".equals(action) || "ACTION_VIEW".equals(action)) {
                    if (url != null && !url.isEmpty()) {
                        navigateToUrl(url);
                    }
                }
                // ACTION_DISMISS and ACTION_SNOOZE need no further action
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction("ACTION_OPEN");
        filter.addAction("ACTION_VIEW");
        filter.addAction("ACTION_DISMISS");
        filter.addAction("ACTION_SNOOZE");
        LocalBroadcastManager.getInstance(this).registerReceiver(actionReceiver, filter);
    }

    private void unregisterActionReceiver() {
        if (actionReceiver != null) {
            LocalBroadcastManager.getInstance(this).unregisterReceiver(actionReceiver);
        }
    }

    private void handleNotificationIntent(Intent intent) {
        if (intent == null) return;
        String url = intent.getStringExtra("url");
        String action = intent.getStringExtra("action");

        if (url != null && !url.isEmpty()) {
            navigateToUrl(url);
        }
    }

    private void navigateToUrl(String url) {
        // Send to WebView via Capacitor's deep link handling
        Intent deepLinkIntent = new Intent(this, MainActivity.class);
        deepLinkIntent.setAction(Intent.ACTION_VIEW);
        deepLinkIntent.setData(android.net.Uri.parse(url));
        deepLinkIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(deepLinkIntent);
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager == null) return;

            // Default channel
            NotificationChannel defaultChannel = new NotificationChannel(
                "default",
                "Al-Mawaid Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            defaultChannel.setDescription("Notifications from Al-Mawaid");
            defaultChannel.setShowBadge(true);
            notificationManager.createNotificationChannel(defaultChannel);

            // Broadcasts channel
            NotificationChannel broadcastChannel = new NotificationChannel(
                "broadcasts",
                "Announcements & Menu Updates",
                NotificationManager.IMPORTANCE_HIGH
            );
            broadcastChannel.setDescription("Weekly menu published, admin announcements, and system broadcasts");
            broadcastChannel.setShowBadge(true);
            notificationManager.createNotificationChannel(broadcastChannel);

            // Queries channel
            NotificationChannel queryChannel = new NotificationChannel(
                "queries",
                "Query Replies",
                NotificationManager.IMPORTANCE_HIGH
            );
            queryChannel.setDescription("Replies from Al-Mawaid team to your queries and support tickets");
            queryChannel.setShowBadge(true);
            notificationManager.createNotificationChannel(queryChannel);

            // Requests channel
            NotificationChannel requestChannel = new NotificationChannel(
                "requests",
                "Request Updates",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            requestChannel.setDescription("Updates on your thali requests (resume, stop, extra food)");
            requestChannel.setShowBadge(true);
            notificationManager.createNotificationChannel(requestChannel);

            // Reminders channel
            NotificationChannel reminderChannel = new NotificationChannel(
                "reminders",
                "Reminders",
                NotificationManager.IMPORTANCE_LOW
            );
            reminderChannel.setDescription("Survey reminders and meal timing notifications");
            reminderChannel.setShowBadge(false);
            notificationManager.createNotificationChannel(reminderChannel);

            // Rich media channel (for BigPictureStyle, media notifications)
            NotificationChannel richChannel = new NotificationChannel(
                "rich_media",
                "Rich Media Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            richChannel.setDescription("Notifications with images, media, and action buttons");
            richChannel.setShowBadge(true);
            richChannel.enableVibration(true);
            richChannel.setVibrationPattern(new long[]{0, 200, 100, 200});
            notificationManager.createNotificationChannel(richChannel);
        }
    }
}