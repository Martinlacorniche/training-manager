export default function Privacy() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-400 via-blue-400 to-blue-600 px-4 py-12">
      <div className="max-w-2xl mx-auto bg-white/95 rounded-3xl shadow-2xl p-8 md:p-12">

        <div className="mb-8">
          <a
            href="/"
            className="text-emerald-600 text-sm font-semibold hover:underline transition"
          >
            ← Retour à l&apos;accueil
          </a>
        </div>

        <h1 className="text-3xl font-extrabold text-gray-800 mb-2">
          Politique de confidentialité
        </h1>
        <p className="text-emerald-600 font-bold text-base mb-1">C&apos;est Ludique</p>
        <p className="text-gray-400 text-sm mb-8">
          Développé par Vitté Martin — Dernière mise à jour : 04 septembre 2025
        </p>

        <hr className="border-gray-200 mb-8" />

        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            1. Quelles données sont collectées ?
          </h2>
          <p className="text-gray-600 text-sm mb-3">
            Nous collectons uniquement les informations nécessaires à la création
            et à l&apos;utilisation de votre compte :
          </p>
          <ul className="list-disc ml-5 space-y-1 text-gray-600 text-sm">
            <li>Adresse email</li>
            <li>Données d&apos;entraînement et de séances</li>
            <li>Informations de profil (nom, prénom, etc.)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            2. Utilisation des données
          </h2>
          <p className="text-gray-600 text-sm mb-3">
            Vos données sont utilisées uniquement pour le fonctionnement de
            l&apos;application :
          </p>
          <ul className="list-disc ml-5 space-y-1 text-gray-600 text-sm">
            <li>Affichage et gestion de votre planning sportif</li>
            <li>Envoi de notifications liées à vos séances</li>
            <li>Amélioration du service</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            3. Partage des données
          </h2>
          <p className="text-gray-600 text-sm mb-2">
            Aucune donnée n&apos;est partagée ou revendue à des tiers.
          </p>
          <p className="text-gray-600 text-sm">
            Vos données restent strictement confidentielles.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3">4. Sécurité</h2>
          <p className="text-gray-600 text-sm">
            Nous mettons en œuvre les mesures techniques appropriées pour
            protéger vos données (stockage sécurisé via Supabase).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            5. Suppression et droits utilisateur
          </h2>
          <p className="text-gray-600 text-sm mb-2">
            À tout moment, vous pouvez demander la suppression de votre compte
            et de toutes vos données en contactant l&apos;adresse suivante :
          </p>
          <a
            href="mailto:martinvitte@gmail.com"
            className="text-emerald-600 font-bold hover:underline text-sm"
          >
            martinvitte@gmail.com
          </a>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3">6. Contact</h2>
          <p className="text-gray-600 text-sm mb-2">
            Pour toute question, merci de contacter :
          </p>
          <a
            href="mailto:martinvitte@gmail.com"
            className="text-emerald-600 font-bold hover:underline text-sm"
          >
            martinvitte@gmail.com
          </a>
        </section>

      </div>
    </main>
  );
}
