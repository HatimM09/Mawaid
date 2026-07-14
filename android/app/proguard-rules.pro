# Al-Mawaid ProGuard / R8 Rules
# Optimized for Capacitor + WebView + Firebase apps

# ── Keep Capacitor WebView Bridge ──────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.firebase.** { *; }
-keep class com.google.firebase.ktx.** { *; }
-dontwarn com.google.firebase.ktx.Firebase
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class * extends com.getcapacitor.BridgeActivity { *; }

# ── Keep JavaScript Interface for WebView ───────────────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keepattributes *Annotation*

# ── Keep WebView & networking ───────────────────────────────────
-keep class android.webkit.** { *; }
-keep class org.chromium.** { *; }
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# ── JSON serialization (Gson) ───────────────────────────────────
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# ── Keep Activity lifecycle ─────────────────────────────────────
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider

# ── Keep View system ────────────────────────────────────────────
-keep class android.view.** { *; }
-keep class androidx.** { *; }

# ── Remove debug logs in release ────────────────────────────────
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# ── Keep Capacitor plugins ─────────────────────────────────────
-keep class com.almawaid.** { *; }

# ── Preserve stack traces for crash reporting ───────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
