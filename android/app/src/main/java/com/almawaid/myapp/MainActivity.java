package com.almawaid.myapp;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.view.animation.AccelerateDecelerateInterpolator;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Install the Android 12+ SplashScreen API BEFORE super.onCreate
        SplashScreen splash = SplashScreen.installSplashScreen(this);

        super.onCreate(savedInstanceState);

        // Custom subtle & elegant splash exit animation
        splash.setOnExitAnimationListener(splashView -> {
            if (splashView.getIconView() == null) {
                splashView.remove();
                return;
            }
            // Scale the icon down gently while fading out
            ObjectAnimator scaleX = ObjectAnimator.ofFloat(
                splashView.getIconView(), "scaleX", 1f, 0.85f);
            ObjectAnimator scaleY = ObjectAnimator.ofFloat(
                splashView.getIconView(), "scaleY", 1f, 0.85f);
            ObjectAnimator fadeOut = ObjectAnimator.ofFloat(
                splashView.getIconView(), "alpha", 1f, 0f);

            long duration = 380L;
            scaleX.setDuration(duration);
            scaleY.setDuration(duration);
            fadeOut.setDuration(duration);

            AccelerateDecelerateInterpolator interpolator = new AccelerateDecelerateInterpolator();
            scaleX.setInterpolator(interpolator);
            scaleY.setInterpolator(interpolator);
            fadeOut.setInterpolator(interpolator);

            fadeOut.addListener(new AnimatorListenerAdapter() {
                @Override
                public void onAnimationEnd(Animator animation) {
                    splashView.remove();
                }
            });

            scaleX.start();
            scaleY.start();
            fadeOut.start();
        });

        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager == null) return;

            // 1. General Notifications (default - existing)
            NotificationChannel defaultChannel = new NotificationChannel(
                "default",
                "Al-Mawaid Notifications",
                NotificationManager.IMPORTANCE_HIGH
            );
            defaultChannel.setDescription("Notifications from Al-Mawaid");
            defaultChannel.setShowBadge(true);
            notificationManager.createNotificationChannel(defaultChannel);

            // 2. Broadcasts (menu published, admin announcements)
            NotificationChannel broadcastChannel = new NotificationChannel(
                "broadcasts",
                "Announcements & Menu Updates",
                NotificationManager.IMPORTANCE_HIGH
            );
            broadcastChannel.setDescription("Weekly menu published, admin announcements, and system broadcasts");
            broadcastChannel.setShowBadge(true);
            notificationManager.createNotificationChannel(broadcastChannel);

            // 3. Query Replies (admin responds to user ticket)
            NotificationChannel queryChannel = new NotificationChannel(
                "queries",
                "Query Replies",
                NotificationManager.IMPORTANCE_HIGH
            );
            queryChannel.setDescription("Replies from Al-Mawaid team to your queries and support tickets");
            queryChannel.setShowBadge(true);
            notificationManager.createNotificationChannel(queryChannel);

            // 4. Request Updates (thali request approved/rejected)
            NotificationChannel requestChannel = new NotificationChannel(
                "requests",
                "Request Updates",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            requestChannel.setDescription("Updates on your thali requests (resume, stop, extra food)");
            requestChannel.setShowBadge(true);
            notificationManager.createNotificationChannel(requestChannel);

            // 5. Reminders (survey reminders, meal timing)
            NotificationChannel reminderChannel = new NotificationChannel(
                "reminders",
                "Reminders",
                NotificationManager.IMPORTANCE_LOW
            );
            reminderChannel.setDescription("Survey reminders and meal timing notifications");
            reminderChannel.setShowBadge(false);
            notificationManager.createNotificationChannel(reminderChannel);
        }
    }
}
