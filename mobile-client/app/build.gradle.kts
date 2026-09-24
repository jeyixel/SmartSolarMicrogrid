import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

// The Maps key lives in local.properties, which is gitignored, so it never
// reaches the repository. A missing key must not break the build for a
// teammate who has just cloned: we fall back to an empty string, and the map
// then fails visibly at runtime instead of failing the whole compile.
val mapsApiKey: String = run {
    val localProperties = Properties()
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        localPropertiesFile.inputStream().use { localProperties.load(it) }
    }
    localProperties.getProperty("MAPS_API_KEY") ?: ""
}

android {
    namespace = "com.example.smartsolarmicrogrid"
    compileSdk = 36 // changed from 35 to 36

    defaultConfig {
        applicationId = "com.example.smartsolarmicrogrid"
        minSdk = 24
        targetSdk = 36 // upgraded to 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Substituted into AndroidManifest.xml at build time as ${MAPS_API_KEY}.
        manifestPlaceholders["MAPS_API_KEY"] = mapsApiKey

        // 10.0.2.2 is how the Android emulator reaches localhost on the host
        // machine; "localhost" inside the emulator means the emulator itself.
        buildConfigField(
            "String",
            "API_BASE_URL",
            "\"http://10.0.2.2:5127/\""
        )
    }

    buildFeatures {
        buildConfig = true
        viewBinding = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
}

dependencies {

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.constraintlayout)

    // Member 2 - map, location, REST
    implementation(libs.play.services.maps)
    implementation(libs.play.services.location)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.fragment.ktx)
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.okhttp.logging.interceptor)
    implementation(libs.kotlinx.coroutines.android)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}
