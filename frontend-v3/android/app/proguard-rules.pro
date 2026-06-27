# ============================================================
# ProGuard / R8 规则 — class_mansys (Capacitor + Vue 3)
# ============================================================

# ── 基本 Android 保留规则 ──
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keepattributes JavascriptInterface
-keepattributes Signature
-keepattributes Exceptions

# 保留崩溃堆栈中的行号信息（方便排错）
-keep,allowobfuscation,allowshrinking class com.clamansys.app.BuildConfig

# ── Capacitor 核心引擎 ──
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.plugin.** { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.annotation.PluginMethod public <methods>;
}
-keep class * extends com.getcapacitor.Plugin { *; }

# ── Capacitor 插件 ──
-keep class com.getcapacitor.plugin.filesystem.** { *; }
-keep class com.getcapacitor.plugin.splashscreen.** { *; }
-keep class com.getcapacitor.plugin.statusbar.** { *; }

# ── Capacitor Cordova 兼容层 ──
-keep class org.apache.cordova.** { *; }
-keep class * extends org.apache.cordova.CordovaPlugin { *; }
-keepclassmembers class * extends org.apache.cordova.CordovaPlugin {
    public <methods>;
}

# ── WebView / JavaScript 桥接 ──
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── AndroidX / 系统组件 ──
-keep class androidx.core.app.** { *; }
-keep class androidx.appcompat.app.** { *; }
-keep class androidx.fragment.app.** { *; }
-keep class android.support.v4.** { *; }

# ── 序列化（Gson / JSON）──
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep class com.google.gson.** { *; }
-keepattributes EnclosingMethod

# ── 保留 XML / 资源引用的类 ──
-keep class com.clamansys.app.** { *; }

# ── 避免混淆反射依赖的类 ──
-keepclassmembers,allowobfuscation class * {
    public <init>(...);
    public <fields>;
}

# ── R8 全模式压缩（保留边界的源文件属性）──
-renamesourcefileattribute SourceFile
