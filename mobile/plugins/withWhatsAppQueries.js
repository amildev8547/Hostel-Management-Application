const { withAndroidManifest } = require('expo/config-plugins');

// Android 11+ hides other apps' package info (including whether WhatsApp is
// installed) from Linking.canOpenURL() unless declared in <queries>. Without
// this, the app reports "WhatsApp is not installed" even when it is.
module.exports = function withWhatsAppQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    if (!manifest.queries) {
      manifest.queries = [{}];
    }
    const queries = manifest.queries[0];

    queries.package = [
      { $: { 'android:name': 'com.whatsapp' } },
      { $: { 'android:name': 'com.whatsapp.w4b' } },
    ];

    queries.intent = [
      {
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        category: [{ $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
        data: [{ $: { 'android:scheme': 'https' } }],
      },
    ];

    return config;
  });
};
