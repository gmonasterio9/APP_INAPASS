# Capacitor / WebView
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public <methods>;
}

# Barcode scanner (OutSystems / Capacitor)
-keep class com.outsystems.plugins.barcode.** { *; }
-keep class com.capacitorjs.barcodescanner.** { *; }

# Gson
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn com.google.gson.annotations.SerializedName
-keep class com.google.gson.** { *; }
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# ML Kit / Play Services (escáner)
-keep class com.google.mlkit.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.mlkit.**
-dontwarn com.google.android.gms.**

# CameraX
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# ZXing
-keep class com.google.zxing.** { *; }
-dontwarn com.google.zxing.**

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Debugging (stacktraces útiles en crash)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
