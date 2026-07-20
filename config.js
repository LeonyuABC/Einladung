// Couple Space – einzige zentrale Konfiguration.
//
// Die Firebase-Web-Konfiguration darf in einer statischen Website stehen.
// Niemals Admin-SDK-Schlüssel, Service-Account-Dateien oder private Schlüssel
// in dieses Projekt kopieren.
export const CONFIG = {
    firebase: {
        apiKey: "AIzaSyC4k7NNIpq3o6tH7V0DZ4-StpnUjQ8g3bo",
        authDomain: "couple-space-e92ac.firebaseapp.com",
        projectId: "couple-space-e92ac",
        storageBucket: "couple-space-e92ac.firebasestorage.app",
        messagingSenderId: "813830515159",
        appId: "1:813830515159:web:65f99b6d2a4e5f80530392"
    },

    // Beide Geräte lesen und schreiben genau diesen gemeinsamen Firestore-Raum.
    coupleId: "yaoyu-daria",

    // Spielerischer Zugangsschutz für die Personenauswahl.
    // Diese PINs stehen in einer statischen Website und sind daher kein Ersatz
    // für ein echtes Benutzerkonto. Für euren privaten, nicht geteilten Link
    // verhindern sie aber ein versehentliches Auswählen der falschen Person.
    users: {
        Yaoyu: { pin: "0729", avatar: "Y" },
        Daria: { pin: "1016", avatar: "D" }
    }
};
